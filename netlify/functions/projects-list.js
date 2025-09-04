// netlify/functions/projects-list.js
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
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });

    // Allow common roles to view list
    const auth = requireAuth(event, ["SA", "VP", "EC", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });

    const { Items } = await ddb.send(new ScanCommand({ TableName: TABLE, ProjectionExpression: "project_id" }));
    const vals = new Set();
    for (const it of Items || []) {
      const v = it.project_id ? Object.values(it.project_id)[0] : null;
      if (v) vals.add(String(v));
    }
    const projects = Array.from(vals).sort((a, b) => a.localeCompare(b));
    return json(200, { projects });
  } catch (err) {
    return json(500, { error: err.message || String(err) });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

