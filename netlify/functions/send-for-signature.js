// netlify/functions/send-for-signature.js
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

function renderOfferTemplate(offer) {
  const templatePath = path.resolve("./netlify/pdf-templates/offer-template.html");
  let html = fs.readFileSync(templatePath, "utf8");

  for (const [key, val] of Object.entries(offer)) {
    const safeVal = val == null ? "" : String(val);
    html = html.replace(new RegExp(`{{${key}}}`, "g"), safeVal);
  }

  return html;
}

const ddb = new DynamoDBClient({
  region: process.env.DDB_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
  },
});


// const ddb = new DynamoDBClient({ region: process.env.DDB_REGION || "us-west-1" });

// Example routing config (hard-coded for now)
const ROUTING_CONFIG = {
  approval_path: [
    { role: "approver", order: 2, email: "vp_sales@example.com" },
    { role: "cc", order: 3, email: "salesmanager@example.com" },
  ],
};


// ---- Helper: get fresh JWT token from DocuSign
export async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const keyPath = path.resolve("./netlify/keys/docusign_private.pem");

  let privateKey;
  try {
    privateKey = fs.readFileSync(keyPath, "utf8");
  } catch (e) {
    throw new Error(`PEM file read error: ${e.message}, path tried: ${keyPath}`);
  }

  if (!privateKey) {
    throw new Error(`PEM file is empty at path: ${keyPath}`);
  }

  console.log("PEM length:", privateKey.length);
  console.log("PEM starts with:", privateKey.slice(0, 40));

  const payload = {
    iss: process.env.DOCUSIGN_INTEGRATION_KEY,
    sub: process.env.DOCUSIGN_USER_ID,
    aud: "account-d.docusign.com", // change to account.docusign.com for prod
    iat: now,
    exp: now + 60 * 5,
    scope: "signature impersonation",
  };

  const assertion = jwt.sign(payload, privateKey, { algorithm: "RS256" });

  const resp = await fetch("https://account-d.docusign.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}


export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const offer = JSON.parse(event.body);

    // Prepare template
    offer.priceFmt = `$${offer.price}`;
    offer.cash = offer.cash_purchase ? "Yes" : "No";
    const pdfHtml = renderOfferTemplate(offer);
    const pdfBase64 = Buffer.from(pdfHtml).toString("base64");

    // Buyers = signers
    const buyers = [offer.email_1, offer.email_2, offer.email_3]
      .filter(Boolean)
      .map((email, idx) => ({
        email,
        name: `Buyer ${idx + 1}`,
        recipientId: `${idx + 1}`,   // valid int
        routingOrder: "1",
        tabs: {
          signHereTabs: [
            {
              xPosition: "100",
              yPosition: `${150 + idx * 100}`,
              documentId: "1",
              pageNumber: "1",
            },
          ],
        },
      }));

    // Approver
    const approver = ROUTING_CONFIG.approval_path.find(r => r.role === "approver");
    const approverRecipient = approver
      ? {
          email: approver.email,
          name: "Approver",
          recipientId: "99",             // valid int
          routingOrder: `${approver.order}`,
        }
      : null;

    // CC list
    const ccList = ROUTING_CONFIG.approval_path.filter(r => r.role === "cc");
    const ccRecipients = ccList.map((entry, idx) => ({
      email: entry.email,
      name: "CC Copy",
      recipientId: `${200 + idx}`,      // valid int
      routingOrder: `${entry.order}`,
    }));

    // Final signers
    const signers = approverRecipient ? [...buyers, approverRecipient] : buyers;
    const { sa_email, sa_name } = offer;

    const envelopeDefinition = {
      emailSubject: `Offer for Unit ${offer.unit_number} at ${offer.project_id}`,
      emailBlurb: `This offer was prepared for you by ${sa_name} (${sa_email})`,
      documents: [
        {
          documentBase64: pdfBase64,
          name: "Offer.html",
          fileExtension: "html",
          documentId: "1",
        },
      ],
      recipients: {
        signers,
        carbonCopies: ccRecipients,
      },
      customFields: {
        textCustomFields: [
          { name: "SalesAgentEmail", value: sa_email },
          { name: "SalesAgentName", value: sa_name },
        ],
      },
      status: "sent",
    };

    // === JWT Token
    const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
    const DOCUSIGN_ACCESS_TOKEN = await getAccessToken();

    // === Send envelope
    const resp = await fetch(
      `https://demo.docusign.net/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DOCUSIGN_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(envelopeDefinition),
      }
    );

    const result = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(result));

    const envelopeId = result.envelopeId;

    // === Save envelopeId into DynamoDB
    if (offer.offer_id) {
      const TABLE = process.env.OFFERS_TABLE || "offers";
      const updateCmd = new UpdateItemCommand({
        TableName: TABLE,
        Key: { offerId: { S: offer.offer_id } },
        UpdateExpression:
          "SET docusign_envelope_id = :e, offer_status = :s, sa_email = :se, sa_name = :sn, sent_at = :t",
        ExpressionAttributeValues: {
          ":e": { S: envelopeId },
          ":s": { S: "sent" },
          ":se": { S: sa_email || "unknown" },
          ":sn": { S: sa_name || "unknown" },
          ":t": { S: new Date().toISOString() },
        },
      });
      await ddb.send(updateCmd);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ envelopeId }),
    };
  } catch (err) {
    console.error("send-for-signature error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
