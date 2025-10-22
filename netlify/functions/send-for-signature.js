// netlify/functions/send-for-signature.js
// Route: `/.netlify/functions/send-for-signature`
// Methods: POST, OPTIONS (expected)
// Purpose: Generate DocuSign envelope for an offer using project template
// Consumers: Signature initiation UI/flow
// Env: DDB_REGION, DocuSign env vars; reads template from `netlify/pdf-templates/${project_id}`
// IAM: dynamodb:UpdateItem if writing status, filesystem read for templates
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { marshall } = require("@aws-sdk/util-dynamodb");
const { awsClientConfig } = require("./utils/awsClients.js");
const { requireAuth } = require("./utils/auth.js");
const { decodeOfferId } = require("./utils/offerKey.js");
const { asString } = require("./utils/normalizedOffer.js");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

function renderOfferTemplate(offer) {
  //pick template folder based on project_id
  const projectId = offer.project_id || "Fusion";   // fallback for safety
  //const templatePath = path.resolve("./netlify/pdf-templates/${projectId}/offer-template.html");

  const templatePath = path.join(
  process.cwd(),
  "netlify",
  "pdf-templates",
  projectId,
  "offer-template.html"
  );
  
  console.log("send-for-signature looking for template at:", templatePath);


  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found for project_id=${projectId} at ${templatePath}`);
  }

  let html = fs.readFileSync(templatePath, "utf8");
  for (const [key, val] of Object.entries(offer)) {
    const safeVal = val == null ? "" : String(val);
    html = html.replace(new RegExp(`{{${key}}}`, "g"), safeVal);
  }

  return html;
}

const ddb = new DynamoDBClient(awsClientConfig());
const TABLE =
  process.env.HBFA_SALES_OFFERS_TABLE ||
  process.env.DDB_TABLE ||
  "hbfa_sales_offers";


// const ddb = new DynamoDBClient({ region: process.env.DDB_REGION || "us-west-1" });

// Example routing config (hard-coded for now)
const ROUTING_CONFIG = {
  approval_path: [
    { role: "approver", order: 2, email: "vp_sales@example.com" },
    { role: "cc", order: 3, email: "salesmanager@example.com" },
  ],
};


// ---- Helper: get fresh JWT token from DocuSign
async function getAccessToken() {
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


async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Require SA or VP to send for signature
    const auth = requireAuth(event, ["SA", "VP"]);
    if (!auth.ok) return { statusCode: auth.statusCode, body: JSON.stringify({ error: auth.message }) };

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
    const key = extractOfferKey(offer);
    if (key.project_id && key.contract_unit_number) {
      const nowIso = new Date().toISOString();
      const updateFields = {
        docusign_envelope: envelopeId,
        status: "contract_sent",
        status_date: nowIso,
        sa_email: sa_email || "unknown",
        sa_name: sa_name || "unknown",
        sent_at: nowIso,
      };
      const marshalled = marshall(updateFields, { removeUndefinedValues: true });
      const exprNames = {};
      const exprValues = {};
      const setClauses = [];
      for (const [attr, value] of Object.entries(marshalled)) {
        const nameToken = `#${attr}`;
        const valueToken = `:${attr}`;
        exprNames[nameToken] = attr;
        exprValues[valueToken] = value;
        setClauses.push(`${nameToken} = ${valueToken}`);
      }
      if (setClauses.length) {
        const updateCmd = new UpdateItemCommand({
          TableName: TABLE,
          Key: marshall(
            {
              project_id: key.project_id,
              contract_unit_number: key.contract_unit_number,
            },
            { removeUndefinedValues: true }
          ),
          UpdateExpression: `SET ${setClauses.join(", ")}`,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
        });
        await ddb.send(updateCmd);
      }
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

function extractOfferKey(offer = {}) {
  if (!offer) return { project_id: "", contract_unit_number: "" };

  const rawId =
    offer.offerId || offer.offer_id || offer.offer_id || offer.offerid;
  if (rawId) {
    const decoded = decodeOfferId(rawId);
    if (decoded.projectId && decoded.contractUnitNumber) {
      return {
        project_id: decoded.projectId,
        contract_unit_number: decoded.contractUnitNumber,
      };
    }
  }

  const projectId = asString(offer.project_id || offer.projectId);
  const contractUnitNumber = asString(
    offer.contract_unit_number || offer.unit_number || offer.contractUnitNumber
  );
  return {
    project_id: projectId || "",
    contract_unit_number: contractUnitNumber || "",
  };
}

module.exports = { getAccessToken, handler };
