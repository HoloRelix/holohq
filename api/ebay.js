const https = require('https');

function httpGet(options) {
  return new Promise((resolve, reject) => {
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { name, set, condition, category } = req.query;
  const appId = process.env.EBAY_CLIENT_ID;

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
  const q = parts.join(' ');

  // Finding API via XML endpoint which has better server support
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.0.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'keywords': q,
    'categoryId': '2536',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true',
    'sortOrder': 'EndTimeSoonest',
    'paginationInput.entriesPerPage': '10',
  });

  const soldResult = await httpGet({
    hostname: 'svcs.ebay.com',
    path: `/services/search/FindingService/v1?${params.toString()}`,
    headers: {
      'User-Agent': 'HoloHQ/1.0 (https://holohq.vercel.app)',
      'Accept': 'application/json',
      'X-EBAY-SOA-OPERATION-NAME': 'findCompletedItems',
      'X-EBAY-SOA-SERVICE-VERSION': '1.0.0',
      'X-EBAY-SOA-SECURITY-APPNAME': appId,
    }
  });

  // Check if HTML error
  if (soldResult.body.startsWith('<') || soldResult.body.startsWith('A server')) {
    // Finding API blocked — fall back to OAuth Browse API
    return res.json({ 
      error: `Finding API unavailable: ${soldResult.body.slice(0, 100)}`,
      sold: [],
      listed: [],
      stats: null
    });
  }

  try {
    const data = JSON.parse(soldResult.body);
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || [];
    const sold = items
      .filter(i => i.sellingStatus?.[0]?.sellingState?.[0] === 'EndedWithSales')
      .map(i => ({
        title: i.title?.[0],
        price: parseFloat(i.sellingStatus?.[0]?.currentPrice?.[0]?.['__value__'] || 0),
        url: i.viewItemURL?.[0],
      }))
      .filter(i => i.price > 0);

    const prices = sold.map(i => i.price).sort((a,b) => a-b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const avg = prices.length ? prices.reduce((s,p) => s+p, 0) / prices.length : 0;

    res.json({
      query: q,
      sold,
      listed: [],
      stats: prices.length ? {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round(prices[0] * 100) / 100,
        high: Math.round(prices[prices.length-1] * 100) / 100,
        count: prices.length
      } : null
    });
  } catch(e) {
    res.status(500).json({ error: e.message, raw: soldResult.body.slice(0, 200) });
  }
};
