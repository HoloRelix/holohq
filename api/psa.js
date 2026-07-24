// Vercel Edge Function — proxies PSA API calls so the token stays server-side
export const config = { runtime: "edge" };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const certNumber = searchParams.get("cert");
  const endpoint = searchParams.get("endpoint") || "cert";

  if (!certNumber) {
    return new Response(JSON.stringify({ error: "cert number required" }), {
      status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  const PSA_TOKEN = process.env.PSA_API_TOKEN;
  if (!PSA_TOKEN) {
    return new Response(JSON.stringify({ error: "PSA_API_TOKEN not set in environment variables" }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  let url;
  if (endpoint === "cert") {
    url = `https://api.psacard.com/publicapi/cert/GetByCertNumber/${certNumber}`;
  } else if (endpoint === "pop") {
    url = `https://api.psacard.com/publicapi/pop/GetPopulationBySubjectAndGrade/${certNumber}`;
  } else {
    return new Response(JSON.stringify({ error: "unknown endpoint" }), {
      status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${PSA_TOKEN}`,
        "Content-Type": "application/json"
      }
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "PSA API fetch failed", detail: err.message }), {
      status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
