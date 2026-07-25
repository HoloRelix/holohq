// Node.js serverless - Finding API works here unlike edge runtime
const https = require('https');

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HoloHQ/1.0)',
        'Accept': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
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
  if (category === 'basketball' || category === 'football' || category === 'baseball') parts.push('card');
  else if (category === 'onepiece') parts.push('one piece');
  else parts.push('pokemon');
  return parts.join(' ');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { name, set, condition, category } = req.query;
  if (!name) return res.status(400).json({ error: 'name required' });

  const appId = process.env.EBAY_CLIENT_ID;
  if (!appId) return res.status(500).json({ error: 'EBAY_CLIENT_ID not set' });

  const q = buildQuery(name, set || '', condition || '', category || 'pokemon');

  try {
    // Finding API - findCompletedItems for sold listings
    const soldUrl = new URL('https://svcs.ebay.com/services/search/FindingService/v1');
    soldUrl.searchParams.set('OPERATION-NAME', 'findCompletedItems');
    soldUrl.searchParams.set('SERVICE-VERSION', '1.0.0');
    soldUrl.searchParams.set('SECURITY-APPNAME', appId);
    soldUrl.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON');
    soldUrl.searchParams.set('REST-PAYLOAD', '');
    soldUrl.searchParams.set('keywords', q);
    soldUrl.searchParams.set('categoryId', '2536'); // Trading Card Games
    soldUrl.searchParams.set('itemFilter(0).name', 'SoldItemsOnly');
    soldUrl.searchParams.set('itemFilter(0).value', 'true');
    soldUrl.searchParams.set('sortOrder', 'EndTimeSoonest');
    soldUrl.searchParams.set('paginationInput.entriesPerPage', '20');

    // Active listings for current prices
    const activeUrl = new URL('https://svcs.ebay.com/services/search/FindingService/v1');
    activeUrl.searchParams.set('OPERATION-NAME', 'findItemsAdvanced');
    activeUrl.searchParams.set('SERVICE-VERSION', '1.0.0');
    activeUrl.searchParams.set('SECURITY-APPNAME', appId);
    activeUrl.searchParams.set('RESPONSE-DATA-FORMAT', 'JSON');
    activeUrl.searchParams.set('keywords', q);
    activeUrl.searchParams.set('categoryId', '2536');
    activeUrl.searchParams.set('itemFilter(0).name', 'ListingType');
    activeUrl.searchParams.set('itemFilter(0).value(0)', 'FixedPrice');
    activeUrl.searchParams.set('itemFilter(0).value(1)', 'Auction');
    activeUrl.searchParams.set('sortOrder', 'PricePlusShippingLowest');
    activeUrl.searchParams.set('paginationInput.entriesPerPage', '10');

    const [soldRes, activeRes] = await Promise.all([
      httpGet(soldUrl.toString()),
      httpGet(activeUrl.toString()),
    ]);

    // Parse sold
    let soldItems = [];
    try {
      const soldData = JSON.parse(soldRes.body);
      const items = soldData?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
      soldItems = items
        .filter(i => i.sellingStatus?.[0]?.sellingState?.[0] === 'EndedWithSales')
        .map(i => ({
          title: i.title?.[0],
          price: parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0),
          url: i.viewItemURL?.[0],
          endDate: i.listingInfo?.[0]?.endTime?.[0],
        }))
        .filter(i => i.price > 0);
    } catch(e) {
      // Finding API returned HTML — fallback
      soldItems = [];
    }

    // Parse active
    let activeItems = [];
    try {
      const activeData = JSON.parse(activeRes.body);
      const items = activeData?.findItemsAdvancedResponse?.[0]?.searchResult?.[0]?.item || [];
      activeItems = items.map(i => ({
        title: i.title?.[0],
        price: parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0),
        url: i.viewItemURL?.[0],
      })).filter(i => i.price > 0);
    } catch(e) {
      activeItems = [];
    }

    // Stats from sold prices
    const soldPrices = soldItems.map(i => i.price).sort((a,b) => a-b);
    const median = soldPrices.length ? soldPrices[Math.floor(soldPrices.length / 2)] : 0;
    const filtered = median > 0 ? soldPrices.filter(p => p >= median * 0.15 && p <= median * 5) : soldPrices;
    const avg = filtered.length ? filtered.reduce((s,p) => s+p, 0) / filtered.length : 0;

    res.json({
      query: q,
      sold: soldItems.slice(0, 8),
      listed: activeItems.slice(0, 8),
      soldRaw: soldRes.status !== 200 ? soldRes.body.slice(0, 100) : null,
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round((filtered[0] || 0) * 100) / 100,
        high: Math.round((filtered[filtered.length-1] || 0) * 100) / 100,
        count: filtered.length
      }
    });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
