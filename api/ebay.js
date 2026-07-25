export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "";
  const set = searchParams.get("set") || "";
  const condition = searchParams.get("condition") || "";

  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers });

  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return new Response(JSON.stringify({ error: "credentials not configured" }), { status: 500, headers });

  try {
    // Use TextEncoder based base64 for edge runtime
    const enc = new TextEncoder();
    const credBytes = enc.encode(`${id}:${secret}`);
    let binary = '';
    credBytes.forEach(b => binary += String.fromCharCode(b));
    const encoded = btoa(binary);

    const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${encoded}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
    });

    const tokenText = await tokenRes.text();
    let tokenData;
    try { tokenData = JSON.parse(tokenText); } catch(e) { return new Response(JSON.stringify({ error: `Token parse failed: ${tokenText.slice(0,100)}` }), { status: 500, headers }); }
    if (!tokenData.access_token) return new Response(JSON.stringify({ error: tokenData.error_description || "Token failed", raw: tokenText.slice(0,200) }), { status: 500, headers });

    const token = tokenData.access_token;

    let q = name;
    if (condition.match(/^(PSA|BGS|CGC)\s*\d/)) q += ` ${condition}`;
    else if (condition.startsWith("Raw ")) q += ` ${condition.replace("Raw ", "")}`;
    if (set && set.length < 25) q += ` ${set}`;

    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=20&sort=price`;
    const searchRes = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
    });

    const searchText = await searchRes.text();
    let data;
    try { data = JSON.parse(searchText); } catch(e) { return new Response(JSON.stringify({ error: `Search parse failed (${searchRes.status}): ${searchText.slice(0,200)}` }), { status: 500, headers }); }

    if (data.errors) return new Response(JSON.stringify({ error: data.errors[0]?.longMessage || "Search error" }), { status: 500, headers });

    const items = (data.itemSummaries || [])
      .map(i => ({ title: i.title, price: parseFloat(i.price?.value || 0), url: i.itemWebUrl }))
      .filter(i => i.price > 0)
      .sort((a, b) => a.price - b.price);

    const median = items.length ? items[Math.floor(items.length / 2)].price : 0;
    const filtered = median > 0 ? items.filter(i => i.price >= median * 0.2 && i.price <= median * 4) : items;
    const prices = filtered.map(i => i.price);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;

    return new Response(JSON.stringify({
      query: q, total: data.total || 0, items: filtered.slice(0, 6),
      stats: { avg: Math.round(avg * 100) / 100, median: Math.round(median * 100) / 100, low: Math.round((prices[0]||0) * 100) / 100, high: Math.round((prices[prices.length-1]||0) * 100) / 100, count: prices.length }
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
