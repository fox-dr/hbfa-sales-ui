// netlify/functions/send-for-signature.js
// import fetch from "node-fetch";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
// inside send-for-signature.js renderTemplate function
import fs from "fs";
import path from "path";

function renderOfferTemplate(offer) {
  const templatePath = path.resolve("./netlify/pdf-templates/offer-template.html");
  let html = fs.readFileSync(templatePath, "utf8");

  for (const [key, val] of Object.entries(offer)) {
    const safeVal = val == null ? "" : String(val);
    html = html.replace(new RegExp(`{{${key}}}`, "g"), safeVal);
  }

  return html;
}

const ddb = new DynamoDBClient({ region: process.env.DDB_REGION || "us-west-1" });

// Example routing config (move to Dynamo/S3 for flexibility)
const ROUTING_CONFIG = {
  approval_path: [
    { role: "approver", order: 2, email: "vp_sales@example.com" },
    { role: "cc", order: 3, email: "salesmanager@example.com" }
  ]
};

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const offer = JSON.parse(event.body);

    // Destructure key values
    const {
      buyer_name,
      email_1,
      email_2,
      email_3,
      unit_number,
      project_id,
      price,
      offer_id // make sure OfferForm sends this as unique key
    } = offer;

    // Generate styled HTML from template
    offer.priceFmt = `$${price}`;
    offer.cash = offer.cash_purchase ? "Yes" : "No";

    const pdfHtml = renderOfferTemplate(offer);
    const pdfBase64 = Buffer.from(pdfHtml).toString("base64");

    

    // Buyers = signers
    const buyers = [email_1, email_2, email_3].filter(Boolean).map((email, idx) => ({
      email,
      name: `Buyer ${idx + 1}`,
      recipientId: `${idx + 1}`,
      routingOrder: "1",
      tabs: {
        signHereTabs: [
          {
            xPosition: "100",
            yPosition: `${150 + idx * 100}`,
            documentId: "1",
            pageNumber: "1"
          }
        ]
      }
    }));

    // Approver + CC
    const approver = ROUTING_CONFIG.approval_path.find(r => r.role === "approver");
    const ccList = ROUTING_CONFIG.approval_path.filter(r => r.role === "cc");

    const approverRecipient = approver
      ? {
          email: approver.email,
          name: "Approver",
          recipientId: "99",
          routingOrder: `${approver.order}`
        }
      : null;

    const ccRecipients = ccList.map((entry, idx) => ({
      email: entry.email,
      name: "CC Copy",
      recipientId: `cc${idx}`,
      routingOrder: `${entry.order}`
    }));

    const signers = approverRecipient
      ? [...buyers, approverRecipient]
      : buyers;

    const { sa_email, sa_name } = offer;

    // Envelope definition
    const envelopeDefinition = {
      emailSubject: `Offer for Unit ${unit_number} at ${project_id}`,
      emailBlurb: `This offer was prepared for you by ${sa_name} (${sa_email})`,
      documents: [
        {
          documentBase64: pdfBase64,
          name: "Offer.html",
          fileExtension: "html",
          documentId: "1"
        }
      ],
      recipients: {
        signers,
        carbonCopies: ccRecipients
      },
      customFields: {
        textCustomFields: [
          { name: "SalesAgentEmail", value: sa_email },
          { name: "SalesAgentName", value: sa_name }
        ]
      },
      status: "sent"
    };


    // Call DocuSign API
    const DOCUSIGN_ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
    const DOCUSIGN_ACCESS_TOKEN = process.env.DOCUSIGN_ACCESS_TOKEN;

    const resp = await fetch(
      `https://demo.docusign.net/restapi/v2.1/accounts/${DOCUSIGN_ACCOUNT_ID}/envelopes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DOCUSIGN_ACCESS_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(envelopeDefinition)
      }
    );

    const result = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(result));

    const envelopeId = result.envelopeId;

    // Write envelopeId back into DynamoDB
    if (!offer_id) {
      console.warn("offer_id missing: cannot update DynamoDB record");
    } else {
      const TABLE = process.env.OFFERS_TABLE || "offers";
      const updateCmd = new UpdateItemCommand({
        TableName: TABLE,
        Key: {
          offer_id: { S: offer_id }
        },
        UpdateExpression: "SET docusign_envelope_id = :e, offer_status = :s, sa_email = :se, sa_name = :sn, sent_at = :t",
        ExpressionAttributeValues: {
          ":e": { S: envelopeId },
          ":s": { S: "sent" },
          ":se": { S: sa_email || "unknown" },
          ":sn": { S: sa_name || "unknown" },
          ":t": { S: new Date().toISOString() }

        }
      });
      await ddb.send(updateCmd);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ envelopeId })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
