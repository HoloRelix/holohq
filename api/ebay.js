// Vercel Edge Function — eBay Browse API proxy for sold listings / price data
export const config = { runtime: "edge" };

async function getEbayToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("eBay credentials not configured");

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || "Failed to get eBay token");
  return data.access_token;
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const condition = searchParams.get("condition") || "";
  const limit = searchParams.get("limit") || "10";

  if (!query) {
    return new Response(JSON.stringify({ error: "query required" }), {
      status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const token = await getEbayToken();

    // Build search query — add condition keywords if graded
    let searchQ = query;
    if (condition.startsWith("PSA")) searchQ += ` ${condition}`;
    else if (condition.startsWith("BGS")) searchQ += ` ${condition}`;
    else if (condition === "Raw NM" || condition === "NM") searchQ += " near mint";

    // Use Finding API (sold listings) for price history
    const soldUrl = new URL("https://api.ebay.com/buy/browse/v1/item_summary/search");
    soldUrl.searchParams.set("q", searchQ);
    soldUrl.searchParams.set("limit", limit);
    soldUrl.searchParams.set("filter", "buyingOptions:{FIXED_PRICE},conditionIds:{1000|2000|3000}");
    soldUrl.searchParams.set("sort", "price");
    soldUrl.searchParams.set("fieldgroups", "EXTENDED");

    const res = await fetch(soldUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      }
    });

    const data = await res.json();

    // Extract price data from results
    const items = (data.itemSummaries || []).map(item => ({
      title: item.title,
      price: parseFloat(item.price?.value || 0),
      currency: item.price?.currency || "USD",
      condition: item.condition,
      url: item.itemWebUrl,
      image: item.image?.imageUrl,
      seller: item.seller?.username,
    }));

    // Calculate market stats
    const prices = items.map(i => i.price).filter(p => p > 0).sort((a, b) => a - b);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const low = prices[0] || 0;
    const high = prices[prices.length - 1] || 0;

    return new Response(JSON.stringify({
      query: searchQ,
      total: data.total || 0,
      items,
      stats: { avg: Math.round(avg * 100) / 100, median: Math.round(median * 100) / 100, low, high, count: prices.length }
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
