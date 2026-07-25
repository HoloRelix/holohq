export const config = { runtime: "edge" };

async function getToken(id, secret) {
  const enc = new TextEncoder();
  const bytes = enc.encode(`${id}:${secret}`);
  let bin = '';
  bytes.forEach(b => bin += String.fromCharCode(b));
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

async function ebaySearch(token, q, sort) {
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  url.searchParams.set("sort", sort);
  url.searchParams.set("filter", "buyingOptions:{FIXED_PRICE|AUCTION}");
  const res = await fetch(url.toString(), {
    headers: { "Authorization": `Bearer ${token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { itemSummaries: [] }; }
}

function buildQuery(name, set, condition) {
  // Start with card name — use quotes for exact match
  let parts = [`"${name}"`];
  
  // Add grade/condition — very important for accuracy
  if (condition && condition.match(/^(PSA|BGS|CGC)\s*\d/)) {
    parts.push(condition); // e.g. "PSA 10"
  } else if (condition && condition.startsWith("Raw ")) {
    const grade = condition.replace("Raw ", "");
    if (grade !== "NM") parts.push(grade);
  }
  
  // Add set name shortened — helps narrow without being too restrictive
  if (set && set.length < 30) {
    // Strip common generic words that hurt search
    const cleanSet = set.replace(/\b(set|series|collection|edition)\b/gi, "").trim();
    if (cleanSet.length > 2) parts.push(cleanSet);
  }
  
  // Always add "pokemon card" to filter out non-card results
  parts.push("pokemon card");
  
  return parts.join(" ");
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
    
    // Build category-aware query
    let q;
    if (category === "sports" || category === "basketball" || category === "football" || category === "baseball") {
      q = `"${name}"`;
      if (condition?.match(/^(PSA|BGS|CGC)\s*\d/)) q += ` ${condition}`;
      if (set) q += ` "${set}"`;
      q += " trading card";
    } else if (category === "onepiece") {
      q = `"${name}"`;
      if (condition?.match(/^(PSA|BGS|CGC)\s*\d/)) q += ` ${condition}`;
      if (set) q += ` ${set}`;
      q += " one piece card";
    } else {
      q = buildQuery(name, set, condition);
    }

    // Fetch recently sold and currently listed in parallel
    const [soldData, listedData] = await Promise.all([
      ebaySearch(token, q, "-endDate"),
      ebaySearch(token, q, "price"),
    ]);

    const mapItem = i => ({
      title: i.title,
      price: parseFloat(i.price?.value || 0),
      url: i.itemWebUrl,
    });

    const sold = (soldData.itemSummaries || []).map(mapItem).filter(i => i.price > 0);
    const listed = (listedData.itemSummaries || []).map(mapItem).filter(i => i.price > 0).sort((a,b) => a.price - b.price);

    // Remove outliers from listed for stats
    const prices = listed.map(i => i.price);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const filtered = median > 0 ? prices.filter(p => p >= median * 0.2 && p <= median * 5) : prices;
    const avg = filtered.length ? filtered.reduce((s,p) => s+p, 0) / filtered.length : 0;

    return new Response(JSON.stringify({
      query: q,
      sold: sold.slice(0, 6),
      listed: listed.slice(0, 6),
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round((prices[0] || 0) * 100) / 100,
        high: Math.round((prices[prices.length-1] || 0) * 100) / 100,
        count: prices.length
      }
    }), { status: 200, headers: hdrs });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: hdrs });
  }
}
