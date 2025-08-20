// netlify/functions/send-for-signature.js
import fetch from "node-fetch";

// Netlify-style function export
export async function handler(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { offer, pdfHtml } = JSON.parse(event.body || "{}");
    if (!offer || !pdfHtml) {
      return { statusCode: 400, body: "Missing offer or pdfHtml" };
    }

    // TODO: configure these values from Compass or your sandbox
    const DOCUSIGN_BASE_URL = "https://demo.docusign.net/restapi"; // demo = sandbox
    const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
    const ACCESS_TOKEN = process.env.DOCUSIGN_ACCESS_TOKEN; 
    // ^ Typically comes from OAuth2 (JWT grant flow). For testing, you can paste one from the developer sandbox.
    // Eventually you’ll automate refreshing tokens.

    // Envelope definition
    const envelopeDefinition = {
      emailSubject: `Offer for Unit ${offer.unit_number || ""}`,
      documents: [
        {
          documentBase64: Buffer.from(pdfHtml).toString("base64"),
          name: "OfferForm.html",
          fileExtension: "html",
          documentId: "1",
        },
      ],
      recipients: {
        signers: [
          {
            email: offer.email_1 || "someone@example.com", // TODO: dynamic from form
            name: offer.buyer_name || "Buyer",
            recipientId: "1",
            routingOrder: "1",
            tabs: {
              signHereTabs: [
                {
                  anchorString: "/sig1/",
                  anchorUnits: "pixels",
                  anchorYOffset: "0",
                  anchorXOffset: "0",
                },
              ],
              dateSignedTabs: [
                {
                  anchorString: "/date1/",
                  anchorUnits: "pixels",
                  anchorYOffset: "0",
                  anchorXOffset: "0",
                },
              ],
            },
          },
        ],
      },
      status: "sent", // "sent" = send immediately, "created" = save as draft
    };

    // Call DocuSign Envelopes API
    const res = await fetch(
      `${DOCUSIGN_BASE_URL}/v2.1/accounts/${ACCOUNT_ID}/envelopes`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(envelopeDefinition),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        `DocuSign error ${res.status}: ${JSON.stringify(data, null, 2)}`
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Envelope created and sent",
        envelopeId: data.envelopeId,
      }),
    };
  } catch (err) {
    console.error("send-for-signature error:", err);
    return { statusCode: 500, body: `Server error: ${err.message}` };
  }
}
