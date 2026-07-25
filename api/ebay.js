export const config = { runtime: "edge" };

async function getToken(id, secret) {
  const enc = new TextEncoder();
  const bytes = enc.encode(`${id}:${secret}`);
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  const encoded = btoa(bin);
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Authorization": `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || "Token failed");
  return data.access_token;
}

function buildQuery(name, set, condition, category) {
  const isGraded = condition && condition.match(/^(PSA|BGS|CGC)\s*[\d.]+/i);
  let parts = [`"${name}"`];
  if (isGraded) {
    const m = condition.match(/^(PSA|BGS|CGC)\s*([\d.]+|Black Label|Pristine)/i);
    if (m) { parts.push(m[1]); parts.push(m[2]); }
  } else {
    parts.push("-PSA -BGS -CGC -SGC");
  }
  if (set && set.length < 30) parts.push(`"${set}"`);
  if (category === "basketball" || category === "football" || category === "baseball") parts.push("card");
  else if (category === "onepiece") parts.push("one piece");
  else parts.push("pokemon");
  return parts.join(" ");
}

async function ebaySearch(token, q, params = {}) {
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { itemSummaries: [] }; }
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "";
  const set = searchParams.get("set") || "";
  const condition = searchParams.get("condition") || "";
  const category = searchParams.get("category") || "pokemon";
  const hdrs = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers: hdrs });
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return new Response(JSON.stringify({ error: "credentials not configured" }), { status: 500, headers: hdrs });

  try {
    const token = await getToken(id, secret);
    const q = buildQuery(name, set, condition, category);

    // Fetch active listings sorted two ways
    const [byPriceData, byNewData] = await Promise.all([
      // Lowest price first — cheapest current listings
      ebaySearch(token, q, { sort: "price", filter: "buyingOptions:{FIXED_PRICE}" }),
      // Highest price first — most expensive / likely graded/premium
      ebaySearch(token, q, { sort: "-price", filter: "buyingOptions:{FIXED_PRICE}" }),
    ]);

    const mapItem = i => ({
      title: i.title,
      price: parseFloat(i.price?.value || 0),
      url: i.itemWebUrl,
      condition: i.condition,
    });

    const cheap = (byPriceData.itemSummaries || []).map(mapItem).filter(i => i.price > 0);
    const expensive = (byNewData.itemSummaries || []).map(mapItem).filter(i => i.price > 0);

    // Deduplicate — expensive list removes items already in cheap
    const cheapUrls = new Set(cheap.map(i => i.url));
    const uniqueExpensive = expensive.filter(i => !cheapUrls.has(i.url));

    const allPrices = cheap.map(i => i.price).sort((a,b) => a-b);
    const median = allPrices.length ? allPrices[Math.floor(allPrices.length / 2)] : 0;
    const filtered = median > 0 ? allPrices.filter(p => p >= median * 0.15 && p <= median * 5) : allPrices;
    const avg = filtered.length ? filtered.reduce((s,p) => s+p, 0) / filtered.length : 0;

    return new Response(JSON.stringify({
      query: q,
      // "sold" = lowest priced listings (best deals / recent sellers)
      sold: cheap.slice(0, 6),
      // "listed" = higher priced / premium listings
      listed: uniqueExpensive.slice(0, 6).reverse(), // reverse so lowest of expensive comes first
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round((filtered[0] || 0) * 100) / 100,
        high: Math.round((filtered[filtered.length-1] || 0) * 100) / 100,
        count: filtered.length
      }
    }), { status: 200, headers: hdrs });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: hdrs });
  }
}
