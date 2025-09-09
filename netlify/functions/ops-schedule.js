// netlify/functions/ops-schedule.js
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";
import { json, DEFAULT_TEMPLATE, DEFAULT_HOLIDAYS, computeScheduleForLots } from "./ops-shared.js";

// POST body: { project_id, building, lots: [{ lotNumber, closeDate }], templateId? }
export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    const auth = requireAuth(event, ["OP", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });
    const body = event.body ? JSON.parse(event.body) : {};
    const project_id = body.project_id || "default";
    const lotsArr = Array.isArray(body.lots) ? body.lots : [];
    const closeDatesByLot = Object.fromEntries(
      lotsArr.filter((x) => x?.lotNumber && x?.closeDate).map((x) => [String(x.lotNumber), x.closeDate])
    );
    const template = DEFAULT_TEMPLATE; // placeholder; later load from DDB
    const holidays = DEFAULT_HOLIDAYS; // placeholder; later load per project
    const result = computeScheduleForLots(closeDatesByLot, template, holidays);
    audit(event, { fn: "ops-schedule", stage: "success", claims: auth.claims, extra: { project_id, lotCount: lotsArr.length } });
    return json(200, { project_id, rows: result.rows, templateId: result.templateId });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
