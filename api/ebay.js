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

    // Try 130point for sold data (free, no key needed)
    const soldSearch = encodeURIComponent(q.replace(/"/g, ''));
    const [soldRes, activeRes] = await Promise.all([
      fetch(`https://www.130point.com/sales/?query=${soldSearch}`, {
        headers: { 
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html,application/xhtml+xml",
        }
      }),
      fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=8&sort=price`, {
        headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
      })
    ]);

    // Parse 130point HTML for sold listings
    const soldHtml = await soldRes.text();
    const sold = [];
    
    // Extract sold items from 130point HTML
    const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const rows = soldHtml.match(rowRegex) || [];
    for (const row of rows.slice(1, 10)) {
      const priceMatch = row.match(/\$([0-9,.]+)/);
      const titleMatch = row.match(/<td[^>]*>([^<]{10,80})<\/td>/);
      const linkMatch = row.match(/href="([^"]*ebay[^"]*)"/);
      if (priceMatch && titleMatch) {
        const price = parseFloat(priceMatch[1].replace(',', ''));
        if (price > 0) {
          sold.push({
            title: titleMatch[1].trim(),
            price,
            url: linkMatch?.[1] || `https://www.ebay.com/sch/i.html?_nkw=${soldSearch}&LH_Complete=1&LH_Sold=1`
          });
        }
      }
    }

    // Active listings from eBay Browse API
    const activeData = await activeRes.json();
    const listed = (activeData.itemSummaries || [])
      .map(i => ({ title: i.title, price: parseFloat(i.price?.value || 0), url: i.itemWebUrl }))
      .filter(i => i.price > 0)
      .sort((a, b) => a.price - b.price);

    // Stats from sold if available, else active
    const priceSrc = sold.length > 0 ? sold : listed;
    const prices = priceSrc.map(i => i.price).sort((a,b) => a-b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const avg = prices.length ? prices.reduce((s,p) => s+p, 0) / prices.length : 0;

    return new Response(JSON.stringify({
      query: q,
      sold: sold.length > 0 ? sold.slice(0, 6) : [],
      listed: listed.slice(0, 6),
      soldSource: sold.length > 0 ? '130point' : 'none',
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
