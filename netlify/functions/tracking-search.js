// netlify/functions/tracking-search.js
// Route: `/.netlify/functions/tracking-search`
// Methods: GET, OPTIONS
// Purpose: Search offers by buyer name, unit number, or offerId (DynamoDB)
// Consumers: `src/pages/TrackingForm.jsx` (search), `src/pages/ApprovalsPage.jsx` (search)
// Env: DDB_TABLE, DDB_REGION
// IAM: dynamodb:Query (if using GSIs) and dynamodb:Scan on the table
// Notes: Returns condensed result set suitable for selection lists
import { DynamoDBClient, ScanCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";

const TABLE = process.env.DDB_TABLE || "fusion_offers";
const REGION = process.env.DDB_REGION || "us-east-2";

const ddb = new DynamoDBClient(awsClientConfig());

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return cors(204, "");
    }

    if (event.httpMethod !== "GET") {
      return cors(405, JSON.stringify({ error: "Method Not Allowed" }));
    }

    // Auth: SA or VP may search
    const auth = requireAuth(event, ["SA", "VP"]);
    if (!auth.ok) return cors(auth.statusCode, JSON.stringify({ error: auth.message }));
    audit(event, { fn: "tracking-search", stage: "invoke", claims: auth.claims });

    const q = (event.queryStringParameters?.query || "").trim();
    if (!q) {
      return cors(200, JSON.stringify({ results: [] }));
    }

    const qLower = q.toLowerCase();

    // Prefer GSIs when configured; fallback to scan
    const records = await queryWithGsisFirst(qLower);

    let filtered;
    const isApprovedQuery = qLower === "approved";
    const isPendingQuery = qLower === "pending" || qLower === "pending approval" || qLower.includes("pending") || qLower.includes("approval");
    const isContractSentQuery = qLower.includes("contract");
    if (isApprovedQuery) {
      // Show items approved in last 30 days
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = records.filter((r) => {
        const decision = String(r.vp_decision || r.status || "").toLowerCase();
        if (decision !== "approved") return false;
        const dateStr = r.vp_approval_date || r.status_date || null;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return false;
        return d >= from && d <= now;
      });
    } else if (isPendingQuery) {
      // Show items pending approval in last 30 days
      const now = new Date();
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = records.filter((r) => {
        const status = String(r.status || "").toLowerCase();
        const isPending = status === "pending" || r.vp_approval_status === false || r.vp_approval_status == null;
        if (!isPending) return false;
        const dateStr = r.status_date || r.vp_approval_date || null;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return false;
        return d >= from && d <= now;
      });
    } else if (isContractSentQuery) {
      const now = new Date();
      const from = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      filtered = records.filter((r) => {
        const status = String(r.status || "").toLowerCase();
        if (status !== "contract_sent") return false;
        const dateStr = r.status_date || null;
        if (!dateStr) return true;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return true;
        return d >= from && d <= now;
      });
    } else {
      filtered = records.filter((r) => {
        const buyer = String(r.buyer_name || r.buyer_1_full_name || r.buyer_2_full_name || "").toLowerCase();
        const unit = String(r.unit_number || "").toLowerCase();
        const id = String(r.offerId || "").toLowerCase();
        return (
          buyer.includes(qLower) || unit.includes(qLower) || id.includes(qLower)
        );
      });
    }

    // Keep only fields needed by the UI; include status if present
    const results = filtered.map((r) => {
      let status = String(r.status || "").toLowerCase();
      if (!status) status = String(r.vp_decision || "").toLowerCase();
      if (!status && (r.vp_approval_status === false || r.vp_approval_status == null)) status = "pending";
      return {
        offerId: r.offerId,
        buyer_name: r.buyer_name || r.buyer_1_full_name || r.buyer_2_full_name || "",
        unit_number: r.unit_number || "",
        status,
      };
    });

    const resBody = { results };
    audit(event, { fn: "tracking-search", stage: "success", claims: auth.claims, extra: { count: results.length } });
    return cors(200, JSON.stringify(resBody));
  } catch (err) {
    console.error("tracking-search error:", err);
    audit(event, { fn: "tracking-search", stage: "error", extra: { message: err?.message } });
    return cors(500, JSON.stringify({ error: err.message || "Server error" }));
  }
}

function cors(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Content-Type": "application/json",
    },
    body,
  };
}

function unmarshall(item) {
  return Object.fromEntries(
    Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]])
  );
}

async function queryWithGsisFirst(qLower) {
  const tryUnit = isLikelyUnit(qLower) && process.env.DDB_GSI_UNIT_NUMBER;
  const tryBuyer = process.env.DDB_GSI_BUYER_NAME;

  // 1) Exact unit match via GSI
  if (tryUnit) {
    try {
      const { Items } = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: process.env.DDB_GSI_UNIT_NUMBER,
          KeyConditionExpression: "#u = :u",
          ExpressionAttributeNames: { "#u": "unit_number" },
          ExpressionAttributeValues: { ":u": { S: qLower } },
          Limit: 50,
        })
      );
      const recs = (Items || []).map(unmarshall);
      if (recs.length) return recs;
    } catch (e) {
      console.warn("unit GSI query failed, falling back to scan:", e?.message);
    }
  }

  // 2) Exact buyer name via GSI (lowercased)
  if (tryBuyer) {
    try {
      const { Items } = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          IndexName: process.env.DDB_GSI_BUYER_NAME,
          KeyConditionExpression: "#b = :b",
          ExpressionAttributeNames: { "#b": "buyer_name" },
          ExpressionAttributeValues: { ":b": { S: qLower } },
          Limit: 50,
        })
      );
      const recs = (Items || []).map(unmarshall);
      if (recs.length) return recs;
    } catch (e) {
      console.warn("buyer GSI query failed, falling back to scan:", e?.message);
    }
  }

  // 3) Fallback: scan
  const { Items } = await ddb.send(new ScanCommand({ TableName: TABLE }));
  return (Items || []).map(unmarshall);
}

function isLikelyUnit(str) {
  // unit numbers tend to be short numeric tokens
  if (!/^[a-z0-9\-]+$/.test(str)) return false;
  const digits = str.replace(/\D+/g, "");
  return digits.length >= 1 && digits.length <= 6;
}
