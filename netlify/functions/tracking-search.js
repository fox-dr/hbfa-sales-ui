// netlify/functions/tracking-search.js
import { DynamoDBClient, ScanCommand, QueryCommand } from "@aws-sdk/client-dynamodb";
import { requireAuth } from "./utils/auth.js";

const TABLE = process.env.DDB_TABLE || "fusion_offers";
const REGION = process.env.DDB_REGION || "us-east-2";

const ddb = new DynamoDBClient({ region: REGION });

export async function handler(event) {
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

    const q = (event.queryStringParameters?.query || "").trim();
    if (!q) {
      return cors(200, JSON.stringify({ results: [] }));
    }

    const qLower = q.toLowerCase();

    // Prefer GSIs when configured; fallback to scan
    const records = await queryWithGsisFirst(qLower);

    const filtered = records.filter((r) => {
      const buyer = String(r.buyer_name || r.buyer_1_full_name || r.buyer_2_full_name || "").toLowerCase();
      const unit = String(r.unit_number || "").toLowerCase();
      const id = String(r.offerId || "").toLowerCase();
      return (
        buyer.includes(qLower) || unit.includes(qLower) || id.includes(qLower)
      );
    });

    // Keep only fields needed by the UI; include status if present
    const results = filtered.map((r) => ({
      offerId: r.offerId,
      buyer_name: r.buyer_name,
      unit_number: r.unit_number,
      status: r.status,
    }));

    return cors(200, JSON.stringify({ results }));
  } catch (err) {
    console.error("tracking-search error:", err);
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
