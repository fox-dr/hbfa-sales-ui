// netlify/functions/ops-templates.js
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";
import { CORS, json, DEFAULT_TEMPLATE } from "./ops-shared.js";

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });
    if (process.env.OPS_ENABLE !== "true") return json(404, { error: "Not Found" });
    const auth = requireAuth(event, ["OP", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });
    audit(event, { fn: "ops-templates", stage: "invoke", claims: auth.claims });
    return json(200, DEFAULT_TEMPLATE);
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
