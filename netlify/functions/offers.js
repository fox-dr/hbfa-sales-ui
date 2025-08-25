// netlify/functions/offers.js
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

const ddb = new DynamoDBClient({ region: process.env.DDB_REGION || "us-west-1" });
const TABLE = process.env.OFFERS_TABLE || "offers";

export async function handler(event) {
  const method = event.httpMethod;

  try {
    // -----------------------------
    // CREATE or UPDATE OFFER (POST)
    // -----------------------------
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const {
        offer_id,
        project_id,
        buyer_name,
        unit_number,
        price,
        sa_email,
        sa_name,
        docusign_envelope_id,
      } = body;

      if (!offer_id) {
        return { statusCode: 400, body: "Missing offer_id" };
      }

      const now = new Date().toISOString();

      const item = {
        offer_id: { S: offer_id },
        project_id: { S: project_id || "unknown" },
        buyer_name: { S: buyer_name || "" },
        buyer_name_lower: { S: (buyer_name || "").toLowerCase() }, // case-insensitive search key
        price: { S: String(price || "") },
        sa_email: { S: sa_email || "" },
        sa_name: { S: sa_name || "" },
        created_at: { S: now },
        updated_at: { S: now },
      };

      if (unit_number) {
        item.unit_number = { S: unit_number };
        item.unit_number_lower = { S: unit_number.toLowerCase() }; // case-insensitive search key
      }

      if (docusign_envelope_id) {
        item.docusign_envelope_id = { S: docusign_envelope_id };
        item.offer_status = { S: "sent" };
      } else {
        item.offer_status = { S: "draft" };
      }

      const cmd = new PutItemCommand({ TableName: TABLE, Item: item });
      await ddb.send(cmd);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Offer saved", offer_id }),
      };
    }

    // -----------------------------
    // FETCH ONE OFFER BY ID
    // -----------------------------
    if (method === "GET" && event.queryStringParameters?.offer_id) {
      const offerId = event.queryStringParameters.offer_id;

      const cmd = new GetItemCommand({
        TableName: TABLE,
        Key: { offer_id: { S: offerId } },
      });

      const resp = await ddb.send(cmd);
      if (!resp.Item) {
        return { statusCode: 404, body: "Offer not found" };
      }

      const obj = {};
      for (const [k, v] of Object.entries(resp.Item)) {
        obj[k] = Object.values(v)[0]; // unwrap { S: "val" }
      }

      return { statusCode: 200, body: JSON.stringify(obj) };
    }

    // -----------------------------
    // SEARCH OFFERS BY BUYER NAME (case-insensitive)
    // -----------------------------
    if (method === "GET" && event.queryStringParameters?.name) {
      const search = event.queryStringParameters.name.toLowerCase();

      const cmd = new ScanCommand({
        TableName: TABLE,
        FilterExpression: "contains(buyer_name_lower, :n)",
        ExpressionAttributeValues: { ":n": { S: search } },
      });

      const resp = await ddb.send(cmd);
      const items = (resp.Items || []).map((item) => {
        const obj = {};
        for (const [k, v] of Object.entries(item)) {
          obj[k] = Object.values(v)[0];
        }
        return obj;
      });

      return { statusCode: 200, body: JSON.stringify(items) };
    }

    // -----------------------------
    // SEARCH OFFERS BY UNIT NUMBER (case-insensitive)
    // -----------------------------
    if (method === "GET" && event.queryStringParameters?.unit) {
      const unit = event.queryStringParameters.unit.toLowerCase();

      const cmd = new ScanCommand({
        TableName: TABLE,
        FilterExpression: "unit_number_lower = :u",
        ExpressionAttributeValues: { ":u": { S: unit } },
      });

      const resp = await ddb.send(cmd);
      const items = (resp.Items || []).map((item) => {
        const obj = {};
        for (const [k, v] of Object.entries(item)) {
          obj[k] = Object.values(v)[0];
        }
        return obj;
      });

      return { statusCode: 200, body: JSON.stringify(items) };
    }

    // -----------------------------
    // DEFAULT: METHOD NOT ALLOWED
    // -----------------------------
    return { statusCode: 405, body: "Method Not Allowed" };
  } catch (err) {
    console.error("offers error:", err);
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
}
