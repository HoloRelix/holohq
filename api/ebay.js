export const config = { runtime: "edge" };

async function getToken(id, secret) {
  const enc = new TextEncoder();
  const bytes = enc.encode(`${id}:${secret}`);
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Authorization": `Basic ${btoa(bin)}`, "Content-Type": "application/x-www-form-urlencoded" },
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
    parts.push('-PSA -BGS -CGC -SGC');
  }
  if (set && set.length < 30) parts.push(`"${set}"`);
  parts.push(category === 'onepiece' ? 'one piece' :
    (category === 'basketball' || category === 'football' || category === 'baseball') ? 'card' : 'pokemon');
  return parts.join(' ');
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

    // Use Browse API with two different offset pages to get variety
    const [page1, page2] = await Promise.all([
      fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=8&sort=price`, {
        headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
      }).then(r => r.json()),
      fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=8&sort=-price`, {
        headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
      }).then(r => r.json()),
    ]);

    const mapItem = i => ({ title: i.title, price: parseFloat(i.price?.value || 0), url: i.itemWebUrl });
    const cheap = (page1.itemSummaries || []).map(mapItem).filter(i => i.price > 0);
    const expensive = (page2.itemSummaries || []).map(mapItem).filter(i => i.price > 0);

    const cheapUrls = new Set(cheap.map(i => i.url));
    const uniqueExpensive = expensive.filter(i => !cheapUrls.has(i.url));

    const prices = cheap.map(i => i.price);
    const sorted = [...prices].sort((a,b) => a-b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const avg = sorted.length ? sorted.reduce((s,p) => s+p, 0) / sorted.length : 0;

    return new Response(JSON.stringify({
      query: q,
      sold: cheap.slice(0, 6),
      listed: uniqueExpensive.length > 0 ? uniqueExpensive.slice(0, 6) : cheap.slice(0, 6),
      stats: sorted.length ? {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round(sorted[0] * 100) / 100,
        high: Math.round(sorted[sorted.length-1] * 100) / 100,
        count: sorted.length
      } : null
    }), { status: 200, headers: hdrs });

  } catch(err) {
    return new Response(JSON.stringify({ error: err.message, sold: [], listed: [], stats: null }), { status: 200, headers: hdrs });
  }
}
