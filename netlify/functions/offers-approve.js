import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { requireAuth } from "./utils/auth.js";

const ddb = new DynamoDBClient({ region: process.env.DDB_REGION || "us-east-2" });
const TABLE = process.env.DDB_TABLE || "fusion_offers";

export async function handler(event) {
  try {
    const method = event.httpMethod;
    if (method !== "POST") {
      return resp(405, { error: "Method Not Allowed" });
    }

    // VP-only endpoint
    const auth = requireAuth(event, ["VP"]);
    if (!auth.ok) return resp(auth.statusCode, { error: auth.message });

    const offerId = event.pathParameters?.offerId || event.queryStringParameters?.offerId;
    if (!offerId) return resp(400, { error: "offerId is required in path" });

    const body = event.body ? JSON.parse(event.body) : {};
    const approved = typeof body.approved === "boolean" ? body.approved : true;
    const vpNotes = body.vp_notes || "";
    const vpId = body.vp_id || auth.claims?.email || auth.claims?.sub || "unknown";
    const now = new Date().toISOString();

    // Update VP approval fields
    const cmd = new UpdateItemCommand({
      TableName: TABLE,
      Key: { offerId: { S: offerId } },
      UpdateExpression:
        "SET vp_approval_status = :status, vp_approval_date = :date, vp_id = :vp, vp_decision = :dec, vp_notes = :notes",
      ExpressionAttributeValues: {
        ":status": { BOOL: approved },
        ":date": { S: now },
        ":vp": { S: vpId },
        ":dec": { S: approved ? "approved" : "denied" },
        ":notes": { S: String(vpNotes) },
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await ddb.send(cmd);

    return resp(200, {
      message: approved ? "Offer approved" : "Offer not approved",
      offerId,
      vp_id: vpId,
      vp_approval_date: now,
      vp_decision: approved ? "approved" : "denied",
    });
  } catch (err) {
    console.error("Error in offers-approve.js:", err);
    return resp(500, { error: err.message });
  }
}

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
