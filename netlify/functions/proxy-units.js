// netlify/functions/proxy-units.js
// Route: `/.netlify/functions/proxy-units`
// Methods: GET, POST, OPTIONS
// Purpose: Authenticated proxy to upstream `API_BASE` for unit data
// Consumers: Any UI proxying unit lookups (if configured)
// Env: API_BASE
// IAM: None (HTTP proxy); relies on upstream auth via forwarded headers
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const { requireAuth } = require("./utils/auth.js");
const { audit } = require("./utils/audit.js");

async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 204, headers: CORS, body: "" };
    }

    // Require auth for proxy usage (SA or VP)
    const auth = requireAuth(event, ["SA", "VP"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });
    audit(event, { fn: "proxy-units", stage: "invoke", claims: auth.claims });

    const API_BASE = process.env.API_BASE; // e.g. https://.../prod
    if (!API_BASE) return json(500, { error: "API_BASE not configured" });

    // --- build upstreamUrl ---
    const params = new URLSearchParams();

    // 1) Take path from query param
    let rawPath = null;
    if (event.queryStringParameters?.path) {
      rawPath = event.queryStringParameters.path;
    }

    // 2) Merge in all other query params
    for (const [k, v] of Object.entries(event.queryStringParameters || {})) {
      if (k !== "path" && v != null) {
        params.set(k, String(v));
      }
    }

    if (!rawPath) {
      return json(400, { error: "Missing 'path' query parameter" });
    }

    const base = API_BASE.replace(/\/+$/, "");
    const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
    const qs = params.toString();
    const upstreamUrl = `${base}${path}${qs ? `?${qs}` : ""}`;

    // --- forward headers ---
    const headers = {};
    const authHeader =
      event.headers?.authorization || event.headers?.Authorization || null;
    if (authHeader) headers.Authorization = authHeader;

    const options = { method: event.httpMethod || "GET", headers };
    if (event.body && options.method !== "GET" && options.method !== "HEAD") {
      options.body = event.isBase64Encoded
        ? Buffer.from(event.body, "base64")
        : event.body;
      const ct =
        event.headers?.["content-type"] || event.headers?.["Content-Type"];
      if (ct) options.headers["Content-Type"] = ct;
    }

    // --- debug logs ---
    console.log("event.headers:", event.headers);
    console.log("authHeader seen:", authHeader);
    console.log("forwarding headers:", headers);
    console.log("upstreamUrl:", upstreamUrl);

    // --- proxy call ---
    const upstream = await fetch(upstreamUrl, options);
    const contentType = upstream.headers.get("content-type") || "application/json";
    const bodyText = await upstream.text();

    console.log(
      "proxy-units:",
      options.method,
      upstreamUrl,
      "→",
      upstream.status
    );

    if (!upstream.ok) {
      return {
        statusCode: upstream.status,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({
          error: true,
          upstreamStatus: upstream.status,
          upstreamUrl,
          upstreamBody: bodyText?.slice(0, 4000) || null,
        }),
      };
    }

    const out = {
      statusCode: upstream.status,
      headers: { ...CORS, "Content-Type": contentType },
      body: bodyText,
    };
    audit(event, { fn: "proxy-units", stage: "success", claims: auth.claims, extra: { upstream: upstreamUrl, status: upstream.status } });
    return out;
  } catch (err) {
    console.error("proxy-units error:", err);
    audit(event, { fn: "proxy-units", stage: "error", extra: { message: String(err) } });
    return json(502, { error: "Upstream fetch failed", details: String(err) });
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

module.exports = { handler };
