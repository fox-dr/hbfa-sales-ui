// netlify/functions/ops-calendars.js
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";
import { json, DEFAULT_HOLIDAYS } from "./ops-shared.js";

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });
    if (process.env.OPS_ENABLE !== "true") return json(404, { error: "Not Found" });
    const auth = requireAuth(event, ["OP", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });
    const project_id = event.queryStringParameters?.project_id || "default";
    audit(event, { fn: "ops-calendars", stage: "invoke", claims: auth.claims, extra: { project_id } });
    // For now, return a single seeded calendar per project.
    return json(200, { project_id, holidays: DEFAULT_HOLIDAYS });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
