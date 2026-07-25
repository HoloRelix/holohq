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

  return new Response(JSON.stringify({
    idLength: id?.length,
    secretLength: secret?.length,
    idFull: id,
    secretFull: secret,
    encoded: encoded
  }), { headers });
}
