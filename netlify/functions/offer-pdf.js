// netlify/functions/offer-pdf.js
// Route: `/.netlify/functions/offer-pdf`
// Methods: POST
// Purpose: Render offer HTML template to real PDF via headless Chrome and store to S3 (handoff)
// Env: S3_VAULT_BUCKET, S3_VAULT_PREFIX, S3_VAULT_KMS_KEY_ARN (optional)
// IAM: s3:PutObject on `${prefix}/docs/*`; kms:Encrypt/GenerateDataKey (and Decrypt if reading)

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";
import fs from "fs";
import path from "path";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const s3 = new S3Client(awsClientConfig());
const S3_BUCKET = process.env.S3_VAULT_BUCKET;
const S3_PREFIX = (process.env.S3_VAULT_PREFIX || "offers/").replace(/^\/+|\/+$/g, "");
const S3_KMS_KEY_ARN = process.env.S3_VAULT_KMS_KEY_ARN || null;

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

function footerHtml(logoDataUrl) {
  // Signature lines and centered logo
  return `
    <div style="width: 100%; margin-top: 24px; padding-top: 16px; border-top: 1px solid #ddd;">
      <div style="display:flex; justify-content:space-between; gap:24px; margin-bottom: 16px;">
        <div style="flex:1;">Signature ________________________ Date: ____________</div>
        <div style="flex:1;">Signature ________________________ Date: ____________</div>
      </div>
      <div style="text-align:center; margin-top:8px;">
        <img src="${logoDataUrl}" alt="HBFA" style="height:36px; opacity:0.9;" />
      </div>
    </div>
  `;
}

export async function handler(event) {
  let browser = null;
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
    const auth = requireAuth(event, ["SA", "VP", "ADMIN"]);
    if (!auth.ok) return { statusCode: auth.statusCode, body: JSON.stringify({ error: auth.message }) };
    if (!S3_BUCKET) return { statusCode: 500, body: JSON.stringify({ error: "S3_VAULT_BUCKET not configured" }) };

    const body = event.body ? JSON.parse(event.body) : {};
    const offer = body.offer || body;
    const offerId = offer.offerId || offer.offer_id || "unknown";

    // Enrich convenience fields
    const enrich = { ...offer };
    if (offer.price && !offer.priceFmt) enrich.priceFmt = `$${offer.price}`;
    if (offer.final_price && !offer.final_priceFmt) enrich.final_priceFmt = `$${offer.final_price}`;

    const htmlCore = renderOfferTemplate(enrich);
    const logoPath = path.join(process.cwd(), "src", "assets", "hbfa-logo.png");
    const logoDataUrl = fs.existsSync(logoPath)
      ? `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`
      : "";
    const htmlFull = `<!doctype html><html><head><meta charset='utf-8'><style>body{font-family:Arial,Helvetica,sans-serif;}</style></head><body>${htmlCore}${footerHtml(logoDataUrl)}</body></html>`;

    // Launch headless Chrome for Lambda
    const executablePath = await chromium.executablePath();
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.setContent(htmlFull, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "Letter", printBackground: true, margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" } });

    const key = `${S3_PREFIX}/docs/${offerId}-${ts()}.pdf`.replace(/\/+/, "/");
    const putParams = { Bucket: S3_BUCKET, Key: key, Body: pdfBuffer, ContentType: "application/pdf" };
    if (S3_KMS_KEY_ARN) {
      putParams.ServerSideEncryption = "aws:kms";
      putParams.SSEKMSKeyId = S3_KMS_KEY_ARN;
    }
    await s3.send(new PutObjectCommand(putParams));

    // Return the PDF to the client for immediate download as well
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=offer-${offerId}.pdf`,
      },
      body: pdfBuffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("offer-pdf error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || String(err) }) };
  } finally {
    try { await browser?.close(); } catch {}
  }
}

