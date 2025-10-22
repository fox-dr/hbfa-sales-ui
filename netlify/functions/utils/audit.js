// utils/audit.js
// Lightweight, structured audit logging for Netlify functions.
// Logs function name, method, path, query params, user and roles.

const { rolesFromClaims } = require("./auth.js");

function audit(event, { fn, stage = "invoke", claims, extra } = {}) {
  try {
    const method = event?.httpMethod || "";
    const path = event?.path || event?.rawUrl || "";
    const qs = event?.queryStringParameters || {};
    const user = claims?.email || claims?.sub || null;
    const roles = claims ? rolesFromClaims(claims) : undefined;
    const rec = {
      type: "audit",
      stage, // invoke|success|error
      fn,
      method,
      path,
      qs,
      user,
      roles,
      extra: extra || undefined,
      ts: new Date().toISOString(),
    };
    console.log(JSON.stringify(rec));
  } catch (e) {
    // never throw from audit
  }
}

module.exports = { audit };
