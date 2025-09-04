import { DynamoDBClient, PutItemCommand, GetItemCommand, ScanCommand, UpdateItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { v4 as uuidv4 } from "uuid";

const client = new DynamoDBClient({ region: process.env.DDB_REGION || "us-east-2" });
const TABLE = process.env.OFFERS_TABLE || "fusion_offers";

export async function handler(event) {
  try {
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : {};

    if (method === "POST") {
      // Always set or replace offerId
      const offerId = body.offerId || uuidv4();

      const item = {
        offerId: { S: offerId },
        ...Object.fromEntries(
          Object.entries(body).map(([k, v]) => [k, { S: String(v) }])
        ),
      };

      await client.send(new PutItemCommand({ TableName: TABLE, Item: item }));
      return resp(200, { offerId });

    } else if (method === "GET") {
      if (event.queryStringParameters?.offerId) {
        const { Item } = await client.send(
          new GetItemCommand({
            TableName: TABLE,
            Key: { offerId: { S: event.queryStringParameters.offerId } },
          })
        );
        return resp(200, Item ? unmarshall(Item) : {});
      } else {
        const { Items } = await client.send(new ScanCommand({ TableName: TABLE }));
        return resp(200, Items.map(unmarshall));
      }

    } else if (method === "PUT") {
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

      await client.send(
        new UpdateItemCommand({
          TableName: TABLE,
          Key: { offerId: { S: body.offerId } },
          UpdateExpression: "SET " + updates.UpdateExpression.join(", "),
          ExpressionAttributeNames: updates.ExpressionAttributeNames,
          ExpressionAttributeValues: updates.ExpressionAttributeValues,
        })
      );

      return resp(200, { offerId: body.offerId });

    } else if (method === "DELETE") {
      if (!body.offerId) return resp(400, { error: "offerId is required" });
      await client.send(
        new DeleteItemCommand({
          TableName: TABLE,
          Key: { offerId: { S: body.offerId } },
        })
      );
      return resp(200, { offerId: body.offerId });
    }

    return resp(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("Error in offers.js:", err);
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
  return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]]));
}
