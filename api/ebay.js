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

function buildQuery(name, set, condition, category) {
  const isGraded = condition && condition.match(/^(PSA|BGS|CGC)\s*[\d.]+/);
  const isRaw = !isGraded;

  let parts = [];

  // Card name — quoted for exact match
  parts.push(`"${name}"`);

  // For graded cards, the grade is the most important filter
  if (isGraded) {
    const gradeMatch = condition.match(/^(PSA|BGS|CGC)\s*([\d.]+|Black Label|Pristine)/i);
    if (gradeMatch) {
      parts.push(gradeMatch[1]); // PSA / BGS / CGC
      parts.push(gradeMatch[2]); // 10 / 9 / etc
    }
  }

  // Set name
  if (set && set.length < 30) {
    parts.push(`"${set}"`);
  }

  // Category keyword + raw/graded filter
  if (category === "basketball" || category === "football" || category === "baseball") {
    parts.push("card");
    if (isRaw) parts.push("-PSA -BGS -CGC -SGC"); // exclude graded from raw searches
  } else if (category === "onepiece") {
    parts.push("one piece");
    if (isRaw) parts.push("-PSA -BGS -CGC");
  } else {
    // Pokemon default
    parts.push("pokemon");
    if (isRaw) parts.push("-PSA -BGS -CGC -SGC"); // exclude graded listings
  }

  return parts.join(" ");
}

async function ebaySearch(token, q, sort) {
  const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "10");
  url.searchParams.set("sort", sort);
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

    // Fetch in parallel — different sorts give different results
    const [recentData, cheapData] = await Promise.all([
      ebaySearch(token, q, "-endDate"),  // most recently ended/sold
      ebaySearch(token, q, "price"),      // lowest price first
    ]);

    const mapItem = i => ({
      title: i.title,
      price: parseFloat(i.price?.value || 0),
      url: i.itemWebUrl,
    });

    const recent = (recentData.itemSummaries || []).map(mapItem).filter(i => i.price > 0);
    const cheap = (cheapData.itemSummaries || []).map(mapItem).filter(i => i.price > 0);

    // Deduplicate listed from recent (by URL)
    const recentUrls = new Set(recent.map(i => i.url));
    const listed = cheap.filter(i => !recentUrls.has(i.url));

    const prices = cheap.map(i => i.price);
    const sorted = [...prices].sort((a,b) => a-b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    const filtered = median > 0 ? sorted.filter(p => p >= median * 0.15 && p <= median * 5) : sorted;
    const avg = filtered.length ? filtered.reduce((s,p) => s+p, 0) / filtered.length : 0;

    return new Response(JSON.stringify({
      query: q,
      sold: recent.slice(0, 6),
      listed: listed.slice(0, 6),
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
