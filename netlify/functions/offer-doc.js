// netlify/functions/offer-doc.js
// Route: `/.netlify/functions/offer-doc`
// Methods: POST
// Purpose: Handoff mode — generate offer HTML from template, store in S3 vault, and return content + key
// Access: SA, VP, ADMIN
// Env: S3_VAULT_BUCKET, S3_VAULT_PREFIX (will write to `${prefix}docs/${offerId}-YYYYMMDDHHmmss.html`)
// IAM: s3:PutObject on prefix, s3:GetObject not required here

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";
import fs from "fs";
import path from "path";

const s3 = new S3Client(awsClientConfig());
const S3_BUCKET = process.env.S3_VAULT_BUCKET;
const S3_PREFIX = (process.env.S3_VAULT_PREFIX || "offers/").replace(/^\/+|\/+$/g, "");
const S3_KMS_KEY_ARN = process.env.S3_VAULT_KMS_KEY_ARN || process.env.S3_VAULT_KMS_KEY_ID || null;

function renderOfferTemplate(offer) {
  const projectId = offer.project_id || "Fusion";
  const templatePath = path.join(process.cwd(), "netlify", "pdf-templates", projectId, "offer-template.html");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found for project_id=${projectId} at ${templatePath}`);
  }
  let html = fs.readFileSync(templatePath, "utf8");
  for (const [key, val] of Object.entries(offer || {})) {
    const safeVal = val == null ? "" : String(val);
    html = html.replace(new RegExp(`{{${key}}}`, "g"), safeVal);
  }
  return html;
}

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
    const auth = requireAuth(event, ["SA", "VP", "ADMIN"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });
    if (!S3_BUCKET) return json(500, { error: "S3_VAULT_BUCKET not configured" });

    const body = event.body ? JSON.parse(event.body) : {};
    const offer = body.offer || body;
    const offerId = offer.offerId || offer.offer_id || "unknown";

    // Enrich convenience fields (non-breaking if already present)
    if (offer.price && !offer.priceFmt) offer.priceFmt = `$${offer.price}`;
    if (offer.final_price && !offer.final_priceFmt) offer.final_priceFmt = `$${offer.final_price}`;
    // Alias placeholders similar to offer-pdf for template compatibility
    if (typeof offer.cash === 'undefined') offer.cash = offer.cash_purchase ? 'Yes' : 'No';
    // Map Qualification/Lender Notes to canonical template key: {{offer_notes_1}}
    if (!offer.offer_notes_1 && offer.lender_notes) offer.offer_notes_1 = offer.lender_notes;
    if (!offer.bldg) offer.bldg = offer.building_info || offer.bldg || '';
    if (!offer.plan) offer.plan = offer.plan_info || offer.plan_type || offer.plan || '';
    if (!offer.addr) {
      const addr1 = offer.address || offer.address_1 || '';
      const addr2 = offer.address_2 || '';
      offer.addr = `${addr1} ${addr2}`.trim();
    }
    if (!offer.l_o_contact_email) offer.l_o_contact_email = offer.loan_officer_email || offer.broker_email || '';
    if (!offer.l_o_phone) offer.l_o_phone = offer.loan_officer_phone || offer.broker_phone || '';

    const html = renderOfferTemplate(offer);
    const key = `${S3_PREFIX}/docs/${offerId}-${ts()}.html`.replace(/\/+/, "/");

    const putParams = {
      Bucket: S3_BUCKET,
      Key: key,
      Body: html,
      ContentType: "text/html; charset=utf-8",
    };
    if (S3_KMS_KEY_ARN) {
      putParams.ServerSideEncryption = "aws:kms";
      putParams.SSEKMSKeyId = S3_KMS_KEY_ARN;
    }
    await s3.send(new PutObjectCommand(putParams));

    return json(200, { key, html });
  } catch (err) {
    console.error("offer-doc error:", err);
    return json(500, { error: err.message || String(err) });
  }
}

function json(statusCode, body) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
