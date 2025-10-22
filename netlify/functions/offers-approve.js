// netlify/functions/offers-approve.js
// Route: `/.netlify/functions/offers-approve?offerId=...`
// Methods: POST
// Purpose: VP decision (approve/deny) on offer; writes VP fields to DDB
// Consumers: `src/pages/ApprovalsPage.jsx` (Approve/Not Approve buttons)
// Env: DDB_TABLE, DDB_REGION
// IAM: dynamodb:UpdateItem on the offers table
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { requireAuth } from "./utils/auth.js";
import { awsClientConfig } from "./utils/awsClients.js";
import { audit } from "./utils/audit.js";
import { decodeOfferId } from "../../lib/offer-key.mjs";

// Use the same configured credentials as other functions (HBFA keys if provided)
const ddb = new DynamoDBClient(awsClientConfig());
const TABLE =
  process.env.HBFA_SALES_OFFERS_TABLE ||
  process.env.DDB_TABLE ||
  "hbfa_sales_offers";

export async function handler(event, context) {
  try {
    const method = event.httpMethod;
    if (method !== "POST") {
      return resp(405, { error: "Method Not Allowed" });
    }

    // VP-only endpoint
    const auth = requireAuth(event, ["VP"]);
    if (!auth.ok) return resp(auth.statusCode, { error: auth.message });
    audit(event, { fn: "offers-approve", stage: "invoke", claims: auth.claims });

    const rawOfferId =
      event.pathParameters?.offerId || event.queryStringParameters?.offerId;
    if (!rawOfferId) {
      return resp(400, { error: "offerId is required in path" });
    }
    const { projectId, contractUnitNumber } = decodeOfferId(rawOfferId);
    if (!projectId || !contractUnitNumber) {
      return resp(400, { error: "Invalid offerId" });
    }

    const body = event.body ? JSON.parse(event.body) : {};
    const approved = typeof body.approved === "boolean" ? body.approved : true;
    const vpNotes = body.vp_notes || "";
    const vpId = body.vp_id || auth.claims?.email || auth.claims?.sub || "unknown";
    const now = new Date().toISOString();

    // Update VP approval fields (and status when approved)
    const updateExpr = [
      "vp_approval_status = :status",
      "vp_approval_date = :date",
      "vp_id = :vp",
      "vp_decision = :dec",
      "vp_notes = :notes",
    ];
    if (approved) {
      updateExpr.push("#status = :approvedStatus", "#status_date = :date");
    }

    const cmd = new UpdateItemCommand({
      TableName: TABLE,
      Key: marshall(
        {
          project_id: projectId,
          contract_unit_number: contractUnitNumber,
        },
        { removeUndefinedValues: true }
      ),
      UpdateExpression: "SET " + updateExpr.join(", "),
      ExpressionAttributeValues: {
        ":status": { BOOL: approved },
        ":date": { S: now },
        ":vp": { S: vpId },
        ":dec": { S: approved ? "approved" : "denied" },
        ":notes": { S: String(vpNotes) },
        ":approvedStatus": { S: "approved" },
      },
      ExpressionAttributeNames: approved ? { "#status": "status", "#status_date": "status_date" } : undefined,
      ReturnValues: "ALL_NEW",
    });

    const result = await ddb.send(cmd);

    const bodyOut = {
      message: approved ? "Offer approved" : "Offer not approved",
      offerId: rawOfferId,
      vp_id: vpId,
      vp_approval_date: now,
      vp_decision: approved ? "approved" : "denied",
    };
    audit(event, {
      fn: "offers-approve",
      stage: "success",
      claims: auth.claims,
      extra: { offerId: rawOfferId, decision: bodyOut.vp_decision },
    });
    return resp(200, bodyOut);
  } catch (err) {
    console.error("Error in offers-approve.js:", err);
    audit(event, { fn: "offers-approve", stage: "error", extra: { message: err?.message } });
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
