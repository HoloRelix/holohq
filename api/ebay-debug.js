export const config = { runtime: "edge" };

export default async function handler(req) {
  const id = process.env.EBAY_CLIENT_ID;
  const secret = process.env.EBAY_CLIENT_SECRET;
  
  const credentials = `${id}:${secret}`;
  const encoded = btoa(unescape(encodeURIComponent(credentials)));

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${encoded}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope",
  });

  const text = await res.text();
  
  return new Response(JSON.stringify({
    status: res.status,
    idLength: id?.length,
    secretLength: secret?.length,
    idStart: id?.slice(0, 10),
    secretStart: secret?.slice(0, 10),
    response: text
  }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
