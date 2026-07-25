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

  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  const credentials = Buffer.from(`${id}:${secret}`).toString('base64');

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
  const token = tokenData.access_token;

  // Test simple search
  const searchRes = await makeRequest({
    hostname: 'api.ebay.com',
    path: '/buy/browse/v1/item_summary/search?q=charizard&limit=3',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
    }
  });

  res.json({
    tokenOk: !!token,
    searchStatus: searchRes.status,
    searchBody: searchRes.body.slice(0, 500)
  });
};
