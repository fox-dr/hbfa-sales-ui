import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  ScanCommand,
  UpdateItemCommand,
  DeleteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { splitPayload } from "./utils/splitPayload.js";
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";
import { awsClientConfig } from "./utils/awsClients.js";

const ddb = new DynamoDBClient(awsClientConfig());
const s3 = new S3Client(awsClientConfig());

const TABLE = process.env.DDB_TABLE || "fusion_offers";
const S3_BUCKET = process.env.S3_VAULT_BUCKET;
const S3_PREFIX = process.env.S3_VAULT_PREFIX || "offers/";

// netlify/functions/offers.js
// Route: `/.netlify/functions/offers`
// Methods: POST (create), GET (read), PUT (update), DELETE (delete)
// Purpose: CRUD for offer records; DDB for normalized fields, S3 vault for full payload
// Consumers: `src/pages/TrackingForm.jsx` (PUT save). POST may be used by offer creation flows.
// Env: DDB_TABLE, S3_VAULT_BUCKET, S3_VAULT_PREFIX
// IAM: dynamodb:{PutItem,GetItem,UpdateItem,DeleteItem,Scan}, s3:PutObject on vault prefix
export async function handler(event, context) {
  try {
    const method = event.httpMethod;
    // Require auth for all methods; allow SA and VP
    const rolesAllowed = ["SA", "VP"];
    const auth = requireAuth(event, rolesAllowed);
    if (!auth.ok) return resp(auth.statusCode, { error: auth.message });
    audit(event, { fn: "offers", stage: "invoke", claims: auth.claims, extra: { method } });
    const body = event.body ? JSON.parse(event.body) : {};

    if (method === "POST") {
      // Always set or replace offerId
      const offerId = body.offerId || uuidv4();

      // Split payload according to schema contract
      const { ddbItem, s3Payload } = splitPayload(offerId, body);

      // Write DynamoDB item
      const ddbMarshalled = Object.fromEntries(
        Object.entries(ddbItem).map(([k, v]) => [k, { S: String(v) }])
      );
      await ddb.send(new PutItemCommand({ TableName: TABLE, Item: ddbMarshalled }));

      // Write full payload to S3
      await s3.send(
        new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: `${S3_PREFIX}${offerId}.json`,
          Body: JSON.stringify(s3Payload),
          ContentType: "application/json",
        })
      );

      const out = { offerId };
      audit(event, { fn: "offers", stage: "success", claims: auth.claims, extra: { method, offerId } });
      return resp(200, out);
    }

    else if (method === "GET") {
      if (event.queryStringParameters?.offerId) {
        const { Item } = await ddb.send(
          new GetItemCommand({
            TableName: TABLE,
            Key: { offerId: { S: event.queryStringParameters.offerId } },
          })
        );
        const data = Item ? unmarshall(Item) : {};
        audit(event, { fn: "offers", stage: "success", claims: auth.claims, extra: { method, type: "getOne" } });
        return resp(200, data);
      } else {
        const { Items } = await ddb.send(new ScanCommand({ TableName: TABLE }));
        const list = Items.map(unmarshall);
        audit(event, { fn: "offers", stage: "success", claims: auth.claims, extra: { method, type: "scan", count: list.length } });
        return resp(200, list);
      }
    }

    else if (method === "PUT") {
      if (!body.offerId) return resp(400, { error: "offerId is required" });

      const updates = Object.entries(body)
        .filter(([k]) => k !== "offerId")
        .reduce(
          (acc, [k, v]) => {
            acc.ExpressionAttributeNames[`#${k}`] = k;
            acc.ExpressionAttributeValues[`:${k}`] = { S: String(v) };
            acc.UpdateExpression.push(`#${k} = :${k}`);
            return acc;
          },
          { UpdateExpression: [], ExpressionAttributeNames: {}, ExpressionAttributeValues: {} }
        );

      await ddb.send(
        new UpdateItemCommand({
          TableName: TABLE,
          Key: { offerId: { S: body.offerId } },
          UpdateExpression: "SET " + updates.UpdateExpression.join(", "),
          ExpressionAttributeNames: updates.ExpressionAttributeNames,
          ExpressionAttributeValues: updates.ExpressionAttributeValues,
        })
      );

      audit(event, { fn: "offers", stage: "success", claims: auth.claims, extra: { method, offerId: body.offerId } });
      return resp(200, { offerId: body.offerId });
    }

    else if (method === "DELETE") {
      if (!body.offerId) return resp(400, { error: "offerId is required" });
      await ddb.send(
        new DeleteItemCommand({
          TableName: TABLE,
          Key: { offerId: { S: body.offerId } },
        })
      );
      audit(event, { fn: "offers", stage: "success", claims: auth.claims, extra: { method, offerId: body.offerId, type: "delete" } });
      return resp(200, { offerId: body.offerId });
    }

    return resp(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Error in offers.js:", err);
    audit(event, { fn: "offers", stage: "error", extra: { message: err?.message } });
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

function unmarshall(item) {
  return Object.fromEntries(
    Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]])
  );
}
