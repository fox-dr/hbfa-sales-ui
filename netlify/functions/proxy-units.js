// netlify/functions/proxy-units.js
// Frontend usage:
//   /.netlify/functions/proxy-units?path=/projects/Fusion/units&building_id=...&unit_number=...

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function handler(event) {
  try {
    // 0) Preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }

    const API_BASE = process.env.API_BASE; // e.g. https://.../prod
    if (!API_BASE) return json(500, { error: "API_BASE not configured" });

    // 1) Parse query
    const urlParams = new URLSearchParams(event.rawQueryString || "");
    const rawPath = urlParams.get("path");
    if (!rawPath) return json(400, { error: "Missing 'path' query parameter" });
    urlParams.delete("path");

    // 2) Build upstream URL (normalize slashes)
    const base = API_BASE.replace(/\/+$/, "");        // trim trailing /
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const qs = urlParams.toString();
    const upstreamUrl = `${base}${path}${qs ? `?${qs}` : ""}`;

    // 3) Forward headers (Authorization only by default; add more if needed)
    const headers = {};
    if (event.headers?.authorization) {
      headers.Authorization = event.headers.authorization;
    }

    // 4) Forward method/body (GET in your current usage, but future-proof it)
    const options = {
      method: event.httpMethod || "GET",
      headers,
    };
    if (event.body && options.method !== "GET" && options.method !== "HEAD") {
      options.body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : event.body;
      // If you need to forward content-type for POST/PUT, add it:
      const ct = event.headers?.["content-type"] || event.headers?.["Content-Type"];
      if (ct) options.headers["Content-Type"] = ct;
    }

    const upstream = await fetch(upstreamUrl, options);
    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: {
        ...CORS,
        "Content-Type": contentType,
        "Cache-Control": "no-store", // helpful during dev
      },
      body,
    };
  } catch (err) {
    return json(502, { error: "Upstream fetch failed", details: String(err) });
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}
