// netlify/functions/health.js
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";

const ddb = new DynamoDBClient(awsClientConfig());
const s3 = new S3Client(awsClientConfig());
const TABLE = process.env.DDB_TABLE || "fusion_offers";
const S3_BUCKET = process.env.S3_VAULT_BUCKET || null;
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

    // Any authenticated role can view health
    const auth = requireAuth(event, ["SA", "VP", "EC", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });

    const env = checkEnv();
    const authEnv = {
      hbfaKeyId: Boolean(process.env.HBFA_AWS_ACCESS_KEY_ID),
      hbfaSecret: Boolean(process.env.HBFA_AWS_SECRET_ACCESS_KEY),
      hbfaRegion: process.env.HBFA_AWS_REGION || null,
      ddbRegion: process.env.DDB_REGION || null,
      s3Region: process.env.S3_REGION || null,
    };
    const ddbOk = await checkDdb();
    const s3Ok = await checkS3();

    return json(200, {
      ok: env.ok && ddbOk.ok && s3Ok.ok,
      env,
      auth_env: authEnv,
      dynamodb: ddbOk,
      s3: s3Ok,
    });
  } catch (err) {
    return json(500, { ok: false, error: err.message || String(err) });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

function checkEnv() {
  const required = ["DDB_TABLE", "DDB_REGION", "OIDC_ISSUER", "OIDC_AUDIENCE"];
  const missing = required.filter((k) => !process.env[k]);
  return { ok: missing.length === 0, missing };
}

async function checkDdb() {
  try {
    const resp = await ddb.send(new ScanCommand({ TableName: TABLE, Limit: 1 }));
    return { ok: true, count: (resp?.Count ?? 0) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function checkS3() {
  if (!S3_BUCKET) return { ok: false, error: "S3_VAULT_BUCKET not set" };
  try {
    // Probe a non-existent key to verify permissions (404 implies access allowed)
    const Key = `${S3_PREFIX}__healthcheck__${Date.now()}.json`;
    try {
      await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
      // If it somehow exists and we can read, we’re good
      return { ok: true, bucket: S3_BUCKET, prefix: S3_PREFIX };
    } catch (e) {
      const status = e?.$metadata?.httpStatusCode;
      if (status === 404) return { ok: true, bucket: S3_BUCKET, prefix: S3_PREFIX };
      return { ok: false, error: e.message };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
