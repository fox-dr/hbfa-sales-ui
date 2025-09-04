// netlify/functions/offer-details.js
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { requireAuth } from "./utils/auth.js";

const s3 = new S3Client({ region: process.env.S3_REGION || process.env.DDB_REGION || "us-east-2" });
const S3_BUCKET = process.env.S3_VAULT_BUCKET;
const S3_PREFIX = process.env.S3_VAULT_PREFIX || "offers/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function handler(event) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });

    // Auth: SA or VP may access PII details
    const auth = requireAuth(event, ["SA", "VP"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });

    const offerId = event.queryStringParameters?.offerId;
    if (!offerId) return json(400, { error: "offerId is required" });
    if (!S3_BUCKET) return json(500, { error: "S3_VAULT_BUCKET not configured" });

    const Key = `${S3_PREFIX}${offerId}.json`;
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
    const bodyText = await streamToString(resp.Body);

    // Body is already JSON (full payload with PII)
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: bodyText,
    };
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode || 500;
    return json(status, { error: err.message || String(err) });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) };
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

