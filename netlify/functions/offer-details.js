// netlify/functions/offer-details.js
// Route: `/.netlify/functions/offer-details`
// Methods: GET, OPTIONS
// Purpose: Return full offer payload with PII from S3 vault
// Consumers: `src/pages/TrackingForm.jsx` (contact panel), `src/pages/ApprovalsPage.jsx` (details pane)
// Env: S3_VAULT_BUCKET, S3_VAULT_PREFIX
// IAM: s3:GetObject on the vault prefix (and KMS decrypt if bucket encrypted)
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";
import { encodeOfferId } from "../../lib/offer-key.js";

const s3 = new S3Client(awsClientConfig());
const S3_BUCKET = process.env.S3_VAULT_BUCKET;
const S3_PREFIX = process.env.S3_VAULT_PREFIX || "offers/";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });

    // Auth: SA or VP (and ADMIN) may access PII details
    const auth = requireAuth(event, ["SA", "VP", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });
    audit(event, { fn: "offer-details", stage: "invoke", claims: auth.claims });

    const offerId = resolveOfferId(event.queryStringParameters || {});
    if (!offerId) return json(400, { error: "offerId is required" });
    if (!S3_BUCKET) return json(500, { error: "S3_VAULT_BUCKET not configured" });

    const Key = `${S3_PREFIX}${offerId}.json`;
    const resp = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key }));
    const bodyText = await streamToString(resp.Body);

    // Body is already JSON (full payload with PII)
    const response = {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: bodyText,
    };
    audit(event, { fn: "offer-details", stage: "success", claims: auth.claims });
    return response;
  } catch (err) {
    const status = err?.$metadata?.httpStatusCode || 500;
    audit(event, { fn: "offer-details", stage: "error", extra: { status, message: err?.message } });
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

function resolveOfferId(qs = {}) {
  if (qs.offerId) {
    return String(qs.offerId);
  }
  const projectId =
    qs.project_id || qs.projectId || qs.project || qs.pk || undefined;
  const contractUnitNumber =
    qs.contract_unit_number ||
    qs.contractUnitNumber ||
    qs.unit_number ||
    qs.unit ||
    undefined;
  if (projectId && contractUnitNumber) {
    return encodeOfferId(String(projectId), String(contractUnitNumber));
  }
  return "";
}
