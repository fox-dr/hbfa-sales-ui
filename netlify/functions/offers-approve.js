import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({ region: process.env.DDB_REGION || "us-east-2" });
const TABLE = process.env.DDB_TABLE || "fusion_offers";

export async function handler(event) {
  try {
    const method = event.httpMethod;
    if (method !== "POST") {
      return resp(405, { error: "Method Not Allowed" });
    }

    const offerId = event.pathParameters?.offerId;
    if (!offerId) return resp(400, { error: "offerId is required in path" });

    const body = event.body ? JSON.parse(event.body) : {};
    const vpId = body.vp_id || "unknown"; // fallback if JWT not wired yet
    const now = new Date().toISOString();

    // Update VP approval fields
    const cmd = new UpdateItemCommand({
      TableName: TABLE,
      Key: { offerId: { S: offerId } },
      UpdateExpression:
        "SET vp_approval_status = :status, vp_approval_date = :date, vp_id = :vp",
      ExpressionAttributeValues: {
        ":status": { BOOL: true },
        ":date": { S: now },
        ":vp": { S: vpId },
      },
      ReturnValues: "ALL_NEW",
    });

    const result = await ddb.send(cmd);

    return resp(200, {
      message: "Offer approved",
      offerId,
      vp_id: vpId,
      vp_approval_date: now,
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
