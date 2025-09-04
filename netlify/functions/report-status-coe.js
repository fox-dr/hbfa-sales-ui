// netlify/functions/report-status-coe.js
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { requireAuth } from "./utils/auth.js";

const ddb = new DynamoDBClient({ region: process.env.DDB_REGION || "us-east-2" });
const TABLE = process.env.DDB_TABLE || "fusion_offers";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return cors(204, "");
    if (event.httpMethod !== "GET") return cors(405, JSON.stringify({ error: "Method Not Allowed" }));

    // Allow SA, VP, EC (Escrow Coordinator), ADMIN
    const auth = requireAuth(event, ["SA", "VP", "EC", "ADMIN"]);
    if (!auth.ok) return cors(auth.statusCode, JSON.stringify({ error: auth.message }));

    const qs = event.queryStringParameters || {};
    const project = (qs.project_id || qs.project || "").trim().toLowerCase();
    const status = (qs.status || "").trim().toLowerCase();
    const from = parseDate(qs.from);
    const to = parseDate(qs.to);
    const format = (qs.format || "json").toLowerCase();

    // Fallback: scan and filter in-memory for now (GSI upgrade later)
    const { Items } = await ddb.send(new ScanCommand({ TableName: TABLE }));
    const rows = (Items || []).map(unmarshall);

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
      offerId: r.offerId,
      project_id: r.project_id || null,
      unit_number: r.unit_number || null,
      buyer_name: r.buyer_name || null,
      status: r.status || null,
      status_date: r.status_date || null,
      coe_date: r.coe_date || null,
      projected_closing_date: r.projected_closing_date || null,
      final_price: r.final_price || r.price || null,
      total_credits: r.total_credits || null,
    }));

    if (format === "csv") {
      const csv = toCsv(data);
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=report.csv" },
        body: csv,
      };
    }

    return cors(200, JSON.stringify({ count: data.length, items: data }));
  } catch (err) {
    console.error("report-status-coe error:", err);
    return cors(500, JSON.stringify({ error: err.message || String(err) }));
  }
}

function cors(statusCode, body) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body };
}

function unmarshall(item) {
  return Object.fromEntries(
    Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]])
  );
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

