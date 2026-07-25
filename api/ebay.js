export const config = { runtime: "edge" };

async function getToken(id, secret) {
  const enc = new TextEncoder();
  const bytes = enc.encode(`${id}:${secret}`);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
  const encoded = btoa(bin);

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || "Token failed");
  return data.access_token;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "";
  const set = searchParams.get("set") || "";
  const condition = searchParams.get("condition") || "";
  const hdrs = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: hdrs });

  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return new Response(JSON.stringify({ error: "credentials not configured" }), { status: 500, headers: hdrs });

  try {
    const token = await getToken(id, secret);

    let q = name;
    if (condition.match(/^(PSA|BGS|CGC)\s*\d/)) q += ` ${condition}`;
    else if (condition.startsWith("Raw ")) q += ` ${condition.replace("Raw ", "")}`;
    if (set && set.length < 25) q += ` ${set}`;

    // Browse API with filter for sold/completed items
    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "20");
    url.searchParams.set("sort", "-endDate");
    url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE|AUCTION},conditions:{USED|LIKE_NEW|VERY_GOOD|GOOD|ACCEPTABLE}");
    url.searchParams.set("fieldgroups", "EXTENDED");

    const res = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "X-EBAY-C-ENDUSERCTX": "contextualLocation=country%3DUS",
      }
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { return new Response(JSON.stringify({ error: `eBay parse error (${res.status}): ${text.slice(0,300)}` }), { status: 500, headers: hdrs }); }

    if (data.errors) return new Response(JSON.stringify({ error: data.errors[0]?.longMessage || "Search error", details: data.errors }), { status: 500, headers: hdrs });

    const items = (data.itemSummaries || [])
      .map(i => ({
        title: i.title,
        price: parseFloat(i.price?.value || 0),
        url: i.itemWebUrl,
        condition: i.condition,
      }))
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
    }), { status: 200, headers: hdrs });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: hdrs });
  }
}
