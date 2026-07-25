export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name") || "";
  const set = searchParams.get("set") || "";
  const condition = searchParams.get("condition") || "";
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };

  if (!name) return new Response(JSON.stringify({ error: "name required" }), { status: 400, headers });

  const id = process.env.EBAY_CLIENT_ID;
  if (!id) return new Response(JSON.stringify({ error: "credentials not configured" }), { status: 500, headers });

  try {
    // Build search query
    let q = name;
    if (condition.match(/^(PSA|BGS|CGC)\s*\d/)) q += ` ${condition}`;
    else if (condition.startsWith("Raw ")) q += ` ${condition.replace("Raw ", "")}`;
    if (set && set.length < 25) q += ` ${set}`;

    // Finding API - findCompletedItems returns SOLD listings
    // This uses the App ID directly (no OAuth needed for Finding API)
    const findingUrl = new URL("https://svcs.ebay.com/services/search/FindingService/v1");
    findingUrl.searchParams.set("OPERATION-NAME", "findCompletedItems");
    findingUrl.searchParams.set("SERVICE-VERSION", "1.0.0");
    findingUrl.searchParams.set("SECURITY-APPNAME", id);
    findingUrl.searchParams.set("RESPONSE-DATA-FORMAT", "JSON");
    findingUrl.searchParams.set("keywords", q);
    findingUrl.searchParams.set("paginationInput.entriesPerPage", "20");
    findingUrl.searchParams.set("sortOrder", "EndTimeSoonest");
    // Filter to sold items only
    findingUrl.searchParams.set("itemFilter(0).name", "SoldItemsOnly");
    findingUrl.searchParams.set("itemFilter(0).value", "true");
    // Trading cards category
    findingUrl.searchParams.set("categoryId", "2536");

    const res = await fetch(findingUrl.toString());
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch(e) {
      return new Response(JSON.stringify({ error: `Parse failed: ${text.slice(0,200)}` }), { status: 500, headers });
    }

    const results = data?.findCompletedItemsResponse?.[0];
    if (results?.ack?.[0] === "Failure") {
      return new Response(JSON.stringify({ error: results?.errorMessage?.[0]?.error?.[0]?.message?.[0] || "eBay error" }), { status: 500, headers });
    }

    const soldItems = results?.searchResult?.[0]?.item || [];

    const items = soldItems
      .filter(i => i.sellingStatus?.[0]?.sellingState?.[0] === "EndedWithSales")
      .map(i => ({
        title: i.title?.[0],
        price: parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.["__value__"] || 0),
        url: i.viewItemURL?.[0],
        endDate: i.listingInfo?.[0]?.endTime?.[0],
      }))
      .filter(i => i.price > 0)
      .sort((a, b) => a.price - b.price);

    const median = items.length ? items[Math.floor(items.length / 2)].price : 0;
    const filtered = median > 0 ? items.filter(i => i.price >= median * 0.2 && i.price <= median * 4) : items;
    const prices = filtered.map(i => i.price);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;

    return new Response(JSON.stringify({
      query: q,
      total: parseInt(results?.paginationOutput?.[0]?.totalEntries?.[0] || 0),
      items: filtered.slice(0, 6),
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round((prices[0] || 0) * 100) / 100,
        high: Math.round((prices[prices.length - 1] || 0) * 100) / 100,
        count: prices.length
      }
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
