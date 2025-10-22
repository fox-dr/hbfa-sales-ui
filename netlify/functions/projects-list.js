// netlify/functions/projects-list.js
// Route: `/.netlify/functions/projects-list`
// Methods: GET, OPTIONS
// Purpose: List available projects (source depends on implementation)
// Consumers: Unit/offer creation UIs (if present)
// Env: (none defined here)
// IAM: (none if static; add notes if calling AWS)
const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");
const { requireAuth } = require("./utils/auth.js");
const { awsClientConfig } = require("./utils/awsClients.js");
const { STSClient, GetCallerIdentityCommand } = require("@aws-sdk/client-sts");

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

async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });

    // Allow common roles to view list
    const auth = requireAuth(event, ["SA", "VP", "EC", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });

    // whoami log to confirm account/role
    try {
      const sts = new STSClient(awsClientConfig());
      const id = await sts.send(new GetCallerIdentityCommand({}));
      console.log(`whoami projects-list account=${id.Account} arn=${id.Arn}`);
    } catch (e) {
      console.log(`whoami projects-list error=${e?.message}`);
    }

    const { Items } = await ddb.send(
      new ScanCommand({ TableName: TABLE, ProjectionExpression: "project_id" })
    );
    const vals = new Set();
    for (const raw of Items || []) {
      const item = unmarshall(raw);
      if (item.project_id) vals.add(String(item.project_id));
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

module.exports = { handler };

