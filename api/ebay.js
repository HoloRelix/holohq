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

// Keywords that indicate non-card junk listings
const JUNK_KEYWORDS = ['keychain', 'custom', 'slab holder', 'case', 'sleeve', 'binder', 
  'display', 'frame', 'print', 'reprint', 'proxy', 'lot', 'bundle', 'collection',
  'mini slab', 'holographic custom', 'sticker', 'patch', 'pin', 'plush'];

function isJunk(title) {
  const t = title.toLowerCase();
  return JUNK_KEYWORDS.some(k => t.includes(k));
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
    const gradeMatch = isGraded ? condition.match(/^(PSA|BGS|CGC)\s*([\d.]+|Black Label|Pristine)/i) : null;

    // Try progressively looser queries until we get results
    const queries = [];
    
    if (gradeMatch) {
      // Map shorthand grades to full search terms
      const gradeCompany = gradeMatch[1]; // PSA, BGS, CGC
      let gradeLabel = gradeMatch[2]; // 10, 9, BL, Pristine, etc
      if (gradeLabel === 'BL') gradeLabel = 'Black Label';
      const gradeStr = `${gradeCompany} ${gradeLabel}`;
      // Graded: try with set first, then without
      queries.push(`${name} "${gradeStr}" ${set} pokemon`);
      queries.push(`${name} "${gradeStr}" pokemon`);
      queries.push(`${name} "${gradeStr}"`);
    } else {
      // Raw: exclude graded
      queries.push(`${name} ${set} pokemon -PSA -BGS -CGC -SGC`);
      queries.push(`${name} pokemon -PSA -BGS -CGC -SGC`);
    }

    let items = [];
    let usedQuery = '';

    for (const q of queries) {
      const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=20&sort=price`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
      });
      const data = await res.json();
      const raw = (data.itemSummaries || [])
        .map(i => ({ title: i.title, price: parseFloat(i.price?.value || 0), url: i.itemWebUrl }))
        .filter(i => i.price > 0 && !isJunk(i.title));
      
      if (raw.length >= 3) {
        items = raw.sort((a, b) => a.price - b.price);
        usedQuery = q;
        break;
      }
    }

    // Remove price outliers
    const prices = items.map(i => i.price).sort((a,b) => a-b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const filtered = median > 0 ? items.filter(i => i.price >= median * 0.2 && i.price <= median * 5) : items;
    const filteredPrices = filtered.map(i => i.price);
    const avg = filteredPrices.length ? filteredPrices.reduce((s,p) => s+p, 0) / filteredPrices.length : 0;

    return new Response(JSON.stringify({
      query: usedQuery,
      sold: [],
      listed: filtered.slice(0, 8),
      stats: filteredPrices.length ? {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round(filteredPrices[0] * 100) / 100,
        high: Math.round(filteredPrices[filteredPrices.length-1] * 100) / 100,
        count: filteredPrices.length
      } : null
    }), { status: 200, headers: hdrs });

  } catch(err) {
    return new Response(JSON.stringify({ error: err.message, sold: [], listed: [], stats: null }), { status: 200, headers: hdrs });
  }
}
