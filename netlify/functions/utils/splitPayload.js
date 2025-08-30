import { fieldMap } from "./fieldMap.js";

export function splitPayload(offerId, fullPayload) {
  const ddbItem = { offerId };     // always PK
  const s3Payload = { offerId };   // keep in vault

  for (const [key, value] of Object.entries(fullPayload)) {
    const loc = fieldMap[key];

    if (!loc) {
      // Field not mapped — default to S3 for safety
      s3Payload[key] = value;
      continue;
    }

    if (loc === "DDB") {
      ddbItem[key] = sanitizeForDDB(key, value);
    } else if (loc === "S3") {
      s3Payload[key] = value;
    } else if (loc === "BOTH") {
      // Save original to S3, safe version to DDB
      s3Payload[key] = value;
      ddbItem[key] = sanitizeForDDB(key, value);
    }
  }

  return { ddbItem, s3Payload };
}

// Example sanitization
function sanitizeForDDB(key, value) {
  if (value == null) return value;

  // Normalize known fields
  if (key.includes("price") || key.includes("amount") || key.includes("credit")) {
    return Number(value.toString().replace(/[^0-9.-]/g, "")); // cast to number
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase(); // normalize text
  }
  return value;
}
