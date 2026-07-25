const https = require('https');

function makeRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const { name, set, condition } = req.query;
  if (!name) return res.status(400).json({ error: 'name required' });

  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return res.status(500).json({ error: 'credentials not configured' });

  const credentials = Buffer.from(`${id}:${secret}`).toString('base64');

  try {
    // Get token
    const tokenBody = 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope';
    const tokenRes = await makeRequest({
      hostname: 'api.ebay.com',
      path: '/identity/v1/oauth2/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenBody),
      }
    }, tokenBody);

    const tokenData = JSON.parse(tokenRes.body);
    if (!tokenData.access_token) {
      return res.status(500).json({ error: tokenData.error_description || 'Token failed' });
    }

    const token = tokenData.access_token;

    // Build query
    let q = name;
    if (condition && condition.match(/^(PSA|BGS|CGC)\s*\d/)) q += ` ${condition}`;
    else if (condition && condition.startsWith('Raw ')) q += ` ${condition.replace('Raw ', '')}`;
    if (set && set.length < 25) q += ` ${set}`;

    // Use keyword search without category restriction first
    const qs = new URLSearchParams({
      q,
      limit: '20',
      sort: 'price',
    }).toString();

    const searchRes = await makeRequest({
      hostname: 'api.ebay.com',
      path: `/buy/browse/v1/item_summary/search?${qs}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        'Content-Type': 'application/json',
      }
    });

    let data;
    try { data = JSON.parse(searchRes.body); }
    catch(e) { return res.status(500).json({ error: `eBay parse error: ${searchRes.body.slice(0, 200)}` }); }

    if (data.errors) return res.status(500).json({ error: data.errors[0]?.longMessage || 'Search error' });

    const items = (data.itemSummaries || [])
      .map(i => ({ title: i.title, price: parseFloat(i.price?.value || 0), url: i.itemWebUrl }))
      .filter(i => i.price > 0)
      .sort((a, b) => a.price - b.price);

    const median = items.length ? items[Math.floor(items.length / 2)].price : 0;
    const filtered = median > 0 ? items.filter(i => i.price >= median * 0.2 && i.price <= median * 4) : items;
    const prices = filtered.map(i => i.price);
    const avg = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0;

    res.json({
      query: q,
      total: data.total || 0,
      items: filtered.slice(0, 6),
      stats: {
        avg: Math.round(avg * 100) / 100,
        median: Math.round(median * 100) / 100,
        low: Math.round((prices[0] || 0) * 100) / 100,
        high: Math.round((prices[prices.length - 1] || 0) * 100) / 100,
        count: prices.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
