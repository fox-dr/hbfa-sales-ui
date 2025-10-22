// netlify/functions/report-status-coe.js
// Route: `/.netlify/functions/report-status-coe`
// Methods: GET, OPTIONS (supports `format=csv`)
// Purpose: COE status report filtered by project/status/date window
// Consumers: Reports tooling (CSV/JSON export)
// Env: DDB_TABLE
// IAM: dynamodb:Scan on the offers table
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";
import { encodeOfferId } from "../../lib/offer-key.mjs";

const ddb = new DynamoDBClient(awsClientConfig());
const TABLE =
  process.env.HBFA_SALES_OFFERS_TABLE ||
  process.env.DDB_TABLE ||
  "hbfa_sales_offers";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") return cors(204, "");
    if (event.httpMethod !== "GET") return cors(405, JSON.stringify({ error: "Method Not Allowed" }));

    // Allow SA, VP, EC (Escrow Coordinator), ADMIN
    const auth = requireAuth(event, ["SA", "VP", "EC", "ADMIN"]);
    if (!auth.ok) return cors(auth.statusCode, JSON.stringify({ error: auth.message }));
    // whoami log
    try {
      const sts = new STSClient(awsClientConfig());
      const id = await sts.send(new GetCallerIdentityCommand({}));
      console.log(`whoami report-status-coe account=${id.Account} arn=${id.Arn}`);
    } catch (e) {
      console.log(`whoami report-status-coe error=${e?.message}`);
    }
    audit(event, { fn: "report-status-coe", stage: "invoke", claims: auth.claims });

    const qs = event.queryStringParameters || {};
    const project = (qs.project_id || qs.project || "").trim().toLowerCase();
    const status = (qs.status || "").trim().toLowerCase();
    const from = parseDate(qs.from);
    const to = parseDate(qs.to);
    const format = (qs.format || "json").toLowerCase();

    // Fallback: scan and filter in-memory for now (GSI upgrade later)
    const { Items } = await ddb.send(new ScanCommand({ TableName: TABLE }));
    const rows = (Items || []).map((raw) => unmarshall(raw));

    const filtered = rows.filter((r) => {
      if (project && String(r.project_id || "").toLowerCase() !== project) return false;
      if (status && String(r.status || "").toLowerCase() !== status) return false;
      // Choose COE date (actual first, projected second)
      const dateStr = r.coe_date || r.projected_closing_date || null;
      if (!from && !to) return true;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return false;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });

    const data = filtered.map((r) => ({
      offerId: encodeOfferId(r.project_id, r.contract_unit_number),
      project_id: r.project_id || null,
      unit_number: r.unit_number || null,
      buyer_name:
        r.buyers_combined ||
        r.buyer_name ||
        r.buyer_1__full_name ||
        r.buyer_1_full_name ||
        null,
      status: r.status || null,
      status_date: r.status_date || null,
      coe_date: r.coe_date || null,
      projected_closing_date: r.projected_closing_date || null,
      final_price: r.final_price || r.base_price || null,
      total_credits: r.total_credits || null,
    }));

    if (format === "csv") {
      const csv = toCsv(data);
      const response = {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=report.csv" },
        body: csv,
      };
      audit(event, { fn: "report-status-coe", stage: "success", claims: auth.claims, extra: { format, count: data.length } });
      return response;
    }

    const body = { count: data.length, items: data };
    audit(event, { fn: "report-status-coe", stage: "success", claims: auth.claims, extra: { format, count: data.length } });
    return cors(200, JSON.stringify(body));
  } catch (err) {
    console.error("report-status-coe error:", err);
    audit(event, { fn: "report-status-coe", stage: "error", extra: { message: err?.message } });
    return cors(500, JSON.stringify({ error: err.message || String(err) }));
  }
}

function cors(statusCode, body) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body };
}

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toCsv(rows) {
  const headers = [
    "offerId",
    "project_id",
    "unit_number",
    "buyer_name",
    "status",
    "status_date",
    "coe_date",
    "projected_closing_date",
    "final_price",
    "total_credits",
  ];
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\n");
}
