export const config = { runtime: "edge" };

async function getToken() {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("eBay credentials not configured");

  // Use TextEncoder for reliable base64 in edge runtime
  const credentials = `${id}:${secret}`;
  const encoded = btoa(unescape(encodeURIComponent(credentials)));

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });

  const text = await res.text();
  let d;
  try { d = JSON.parse(text); } catch { throw new Error(`Token parse failed: ${text.slice(0,100)}`); }
  if (!d.access_token) throw new Error(d.error_description || d.error || `Token failed: ${text.slice(0,100)}`);
  return d.access_token;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "";
  const set = searchParams.get("set") || "";
  const condition = searchParams.get("condition") || "";

  if (!name) return new Response(JSON.stringify({ error: "name required" }), {
    status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });

  try {
    const token = await getToken();

    let q = name;
    if (condition.match(/^(PSA|BGS|CGC)\s*\d/)) q += ` ${condition}`;
    else if (condition.startsWith("Raw ")) q += ` ${condition.replace("Raw ", "")}`;
    if (set && set.length < 25) q += ` ${set}`;

    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "20");
    url.searchParams.set("sort", "price");
    url.searchParams.set("category_ids", "2536");

    const res = await fetch(url.toString(), {
      headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
    });
    const data = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.longMessage || "eBay search error");

    const items = (data.itemSummaries || [])
      .map(i => ({ title: i.title, price: parseFloat(i.price?.value || 0), url: i.itemWebUrl }))
      .filter(i => i.price > 0)
      .sort((a, b) => a.price - b.price);

    const median = items.length ? items[Math.floor(items.length / 2)].price : 0;
    const filtered = median > 0 ? items.filter(i => i.price >= median * 0.2 && i.price <= median * 4) : items;
    const prices = filtered.map(i => i.price);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;

    return new Response(JSON.stringify({
      query: q,
      total: data.total || 0,
      items: filtered.slice(0, 6),
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round((prices[0] || 0) * 100) / 100,
        high: Math.round((prices[prices.length - 1] || 0) * 100) / 100,
        count: prices.length
      }
    }), { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
