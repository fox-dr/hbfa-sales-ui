// netlify/functions/proxy-units.js
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }

    const API_BASE = process.env.API_BASE; // e.g., https://.../prod
    if (!API_BASE) return json(500, { error: "API_BASE not configured" });

    const urlParams = new URLSearchParams(event.rawQueryString || "");
    const rawPath = urlParams.get("path");
    if (!rawPath) return json(400, { error: "Missing 'path' query parameter" });
    urlParams.delete("path");

    const base = API_BASE.replace(/\/+$/, "");
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const qs = urlParams.toString();
    const upstreamUrl = `${base}${path}${qs ? `?${qs}` : ""}`;

    const headers = {};
    if (event.headers?.authorization) headers.Authorization = event.headers.authorization;

    const options = { method: event.httpMethod || "GET", headers };
    if (event.body && options.method !== "GET" && options.method !== "HEAD") {
      options.body = event.isBase64Encoded ? Buffer.from(event.body, "base64") : event.body;
      const ct = event.headers?.["content-type"] || event.headers?.["Content-Type"];
      if (ct) options.headers["Content-Type"] = ct;
    }

    const upstream = await fetch(upstreamUrl, options);
    const contentType = upstream.headers.get("content-type") || "application/json";
    const bodyText = await upstream.text();

    // Helpful logging (shows in Netlify deploy logs)
    console.log("proxy-units upstream:", options.method, upstreamUrl, "→", upstream.status);

    if (!upstream.ok) {
      // Return structured error so you can read it in the browser Network tab
      return {
        statusCode: upstream.status,
        headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({
          error: true,
          upstreamStatus: upstream.status,
          upstreamUrl,
          upstreamBody: bodyText?.slice(0, 4000) || null,
        }),
      };
    }

    return {
      statusCode: upstream.status,
      headers: { ...CORS, "Content-Type": contentType, "Cache-Control": "no-store" },
      body: bodyText,
    };
  } catch (err) {
    console.error("proxy-units error:", err);
    return json(502, { error: "Upstream fetch failed", details: String(err) });
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify(obj),
  };
}
