export const config = { runtime: "edge" };

async function getEbayToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("eBay credentials not configured");
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || "Failed to get token");
  return data.access_token;
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
    const token = await getEbayToken();

    // Build a tight search query
    let q = name;
    // Add grading company + grade if graded
    if (condition.match(/^(PSA|BGS|CGC)\s*\d/)) {
      q += ` ${condition}`;
    } else if (condition.startsWith("Raw ")) {
      const rawGrade = condition.replace("Raw ", "");
      q += ` ${rawGrade}`;
    }
    // Add set if it helps narrow (not too generic)
    if (set && set.length < 30) q += ` ${set}`;

    // Search ACTIVE listings via Browse API (most reliable with client credentials)
    const url = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "20");
    url.searchParams.set("sort", "price");
    // Category 2536 = Trading Card Games, 183454 = Sports Trading Cards
    url.searchParams.set("category_ids", "2536,183454");

    const res = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      }
    });

    const data = await res.json();
    const items = (data.itemSummaries || []).map(item => ({
      title: item.title,
      price: parseFloat(item.price?.value || 0),
      currency: item.price?.currency || "USD",
      condition: item.condition,
      url: item.itemWebUrl,
      image: item.image?.imageUrl,
      buyingOptions: item.buyingOptions,
    })).filter(i => i.price > 0);

    // Remove outliers — exclude anything more than 3x the median
    const sorted = [...items].sort((a, b) => a.price - b.price);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)].price : 0;
    const filtered = sorted.filter(i => i.price <= median * 3 && i.price >= median * 0.25);

    const prices = filtered.map(i => i.price);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
    const low = prices[0] || 0;
    const high = prices[prices.length - 1] || 0;

    return new Response(JSON.stringify({
      query: q,
      total: data.total || 0,
      items: filtered.slice(0, 6),
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round(low * 100) / 100,
        high: Math.round(high * 100) / 100,
        count: prices.length
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
