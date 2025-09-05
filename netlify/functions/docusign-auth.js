// netlify/functions/docusign-auth.js
// Route: (helper module, not an HTTP endpoint)
// Purpose: Provide DocuSign access token via JWT flow
// Consumers: `netlify/functions/send-for-signature.js`
// Env: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_PRIVATE_KEY
// IAM: none (external HTTP)
import jwt from "jsonwebtoken";
import fetch from "node-fetch";

// DocuSign constants (sandbox values)
// You'll need to set these in Netlify environment variables
const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY; // aka client_id
const USER_ID = process.env.DOCUSIGN_USER_ID; // the API User GUID (not your email)
const OAUTH_BASE = "https://account-d.docusign.com"; // "-d" = demo/sandbox
const PRIVATE_KEY = process.env.DOCUSIGN_PRIVATE_KEY; // multiline PEM string
const SCOPES = "signature impersonation"; // DocuSign required scopes

// Cached token (to avoid hitting OAuth server every call)
let cachedToken = null;
let cachedExpiry = 0;

/**
 * Get a valid DocuSign access token using JWT flow
 * - Reuses cached token until ~5 min before expiry
 */
export async function getDocuSignToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedExpiry - 300 > now) {
    console.log("Using cached DocuSign token, expires in", cachedExpiry - now, "seconds.");
    return cachedToken;
  }

    console.log("Refreshing DocuSign token...");

  // Create JWT assertion
  const payload = {
    iss: INTEGRATION_KEY,
    sub: USER_ID,
    aud: OAUTH_BASE,
    iat: now,
    exp: now + 3600, // 1 hour lifetime
    scope: SCOPES,
  };

  const jwtAssertion = jwt.sign(payload, PRIVATE_KEY, { algorithm: "RS256" });

  // Exchange for access token
  const res = await fetch(`${OAUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtAssertion,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("DocuSign auth failed:", data);
    throw new Error(`DocuSign auth failed: ${JSON.stringify(data)}`);
  }

  cachedToken = data.access_token;
  cachedExpiry = now + data.expires_in;
  return cachedToken;
}

// Example Netlify endpoint to test auth
export async function handler() {
  try {
    const token = await getDocuSignToken();
    return {
      statusCode: 200,
      body: JSON.stringify({ access_token: token.slice(0, 12) + "...", expires: cachedExpiry }),
    };
  } catch (err) {
    console.error("DocuSign auth error:", err);
    return { statusCode: 500, body: `Auth error: ${err.message}` };
  }
}
