// Netlify Function: proxies /api/* -> AWS API, adds CORS for browser and hides AWS origin
export const handler = async (event) => {
  try {
    const { path } = event; // e.g., "/.netlify/functions/proxy-units/unit_info_v2?unit_number=1"
    const upstreamPath = path.replace("/.netlify/functions/proxy-units", "").replace(/^\/+/, "");
    const qs = event.rawQueryString ? `?${event.rawQueryString}` : "";

    // Use env var in Netlify UI: API_BASE=https://lyj4zmurck.execute-api.us-east-2.amazonaws.com/prod
    const base = process.env.API_BASE;
    if (!base) {
      return {
        statusCode: 500,
        headers: cors(),
        body: JSON.stringify({ error: "API_BASE not configured" })
      };
    }

    const url = `${base}/${upstreamPath}${qs}`; // e.g., .../unit_info_v2?unit_number=1
    const res = await fetch(url, { method: event.httpMethod });

    // Bubble through JSON or text
    const contentType = res.headers.get("content-type") || "application/json";
    const body = contentType.includes("application/json") ? JSON.stringify(await res.json()) : await res.text();

    return {
      statusCode: res.status,
      headers: { ...cors(), "content-type": contentType },
      body
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: cors(),
      body: JSON.stringify({ error: "Upstream fetch failed", details: String(err) })
    };
  }
};

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization"
  };
}
