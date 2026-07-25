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
    const isGraded = condition.match(/^(PSA|BGS|CGC)\s*[\d.]+/i);

    // Build query — don't quote the name, it's too strict
    let q = name;
    if (isGraded) {
      const m = condition.match(/^(PSA|BGS|CGC)\s*([\d.]+|Black Label|Pristine)/i);
      if (m) q += ` ${m[1]} ${m[2]}`;
    } else {
      q += ' -PSA -BGS -CGC -SGC';
    }
    // Don't quote set — too restrictive
    if (set && set.length < 25) q += ` ${set}`;
    if (category === 'onepiece') q += ' one piece';
    else if (category === 'basketball' || category === 'football' || category === 'baseball') q += ' card';
    else q += ' pokemon';

    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=10&sort=price`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
    });
    const data = await res.json();

    const items = (data.itemSummaries || [])
      .map(i => ({ title: i.title, price: parseFloat(i.price?.value || 0), url: i.itemWebUrl }))
      .filter(i => i.price > 0)
      .sort((a, b) => a.price - b.price);

    const prices = items.map(i => i.price);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const avg = prices.length ? prices.reduce((s,p) => s+p, 0) / prices.length : 0;

    return new Response(JSON.stringify({
      query: q,
      sold: [],
      listed: items.slice(0, 8),
      total: data.total || 0,
      stats: prices.length ? {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round(prices[0] * 100) / 100,
        high: Math.round(prices[prices.length-1] * 100) / 100,
        count: prices.length
      } : null
    }), { status: 200, headers: hdrs });

  } catch(err) {
    return new Response(JSON.stringify({ error: err.message, sold: [], listed: [], stats: null }), { status: 200, headers: hdrs });
  }
}
