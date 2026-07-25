export const config = { runtime: "edge" };

export default async function handler(req) {
  const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;

  const enc = new TextEncoder();
  const credBytes = enc.encode(`${id}:${secret}`);
  let binary = '';
  credBytes.forEach(b => binary += String.fromCharCode(b));
  const encoded = btoa(binary);

  const tokenRes = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Authorization": `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });
  const tokenText = await tokenRes.text();
  let tokenData;
  try { tokenData = JSON.parse(tokenText); } catch(e) { return new Response(JSON.stringify({ step: "token_parse_failed", raw: tokenText.slice(0,300) }), { headers }); }
  if (!tokenData.access_token) return new Response(JSON.stringify({ step: "token_failed", data: tokenData }), { headers });

  const searchRes = await fetch("https://api.ebay.com/buy/browse/v1/item_summary/search?q=charizard&limit=3", {
    headers: { "Authorization": `Bearer ${tokenData.access_token}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" }
  });
  const searchText = await searchRes.text();

  return new Response(JSON.stringify({
    tokenOk: true,
    searchStatus: searchRes.status,
    searchRaw: searchText.slice(0, 500)
  }), { headers });
}
