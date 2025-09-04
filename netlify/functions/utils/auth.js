// netlify/functions/utils/auth.js

export function getAuthHeader(event) {
  return event.headers?.authorization || event.headers?.Authorization || "";
}

export function decodeJwt(token) {
  try {
    const [, payload] = token.split(".");
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function validateClaims(claims) {
  if (!claims) return { ok: false, error: "Invalid token" };
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && now > claims.exp) return { ok: false, error: "Token expired" };
  const iss = process.env.OIDC_ISSUER;
  if (iss && claims.iss && iss !== claims.iss) return { ok: false, error: "Issuer mismatch" };
  const aud = process.env.OIDC_AUDIENCE;
  if (aud && claims.aud && aud !== claims.aud) return { ok: false, error: "Audience mismatch" };
  return { ok: true };
}

export function rolesFromClaims(claims) {
  const maybeArrays = [
    claims?.roles,
    claims?.groups,
    claims?.permissions,
    claims?.["cognito:groups"],
  ].filter(Boolean);
  for (const m of maybeArrays) {
    if (Array.isArray(m)) return m;
    if (typeof m === "string") return m.split(/[,\s]+/);
  }
  return [];
}

export function hasAnyRole(claims, allowed) {
  const have = new Set(rolesFromClaims(claims).map((r) => String(r).toUpperCase()));
  return allowed.some((r) => have.has(String(r).toUpperCase()));
}

export function requireAuth(event, allowedRoles = []) {
  const hdr = getAuthHeader(event);
  if (!hdr || !/^bearer\s+/i.test(hdr)) {
    return { ok: false, statusCode: 401, message: "Unauthorized" };
  }
  const token = hdr.split(/\s+/)[1];
  const claims = decodeJwt(token);
  const v = validateClaims(claims);
  if (!v.ok) return { ok: false, statusCode: 401, message: v.error };
  if (allowedRoles.length && !hasAnyRole(claims, allowedRoles)) {
    return { ok: false, statusCode: 403, message: "Forbidden" };
  }
  return { ok: true, claims };
}

