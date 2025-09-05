import { fieldMap } from "./fieldMap.js";
import crypto from "crypto";

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

  // Derived normalized fields for indexing
  if (fullPayload.buyer_name) {
    ddbItem.buyer_name = sanitizeForDDB("buyer_name", fullPayload.buyer_name);
  } else if (fullPayload.buyer_1_full_name) {
    // Derive buyer_name from buyer_1_full_name when not explicitly provided
    ddbItem.buyer_name = sanitizeForDDB("buyer_name", fullPayload.buyer_1_full_name);
  }
  if (fullPayload.unit_number) {
    ddbItem.unit_number = sanitizeForDDB("unit_number", fullPayload.unit_number);
  }

  // Derive non-PII phone markers for DDB (last4, area, hash)
  addDerivedPhoneMarkers(fullPayload, ddbItem);

  return { ddbItem, s3Payload };
}

// Example sanitization
function sanitizeForDDB(key, value) {
  if (value == null) return value;

  // Normalize known fields
  if (key.includes("price") || key.includes("amount") || key.includes("credit")) {
    return Number(value.toString().replace(/[^0-9.-]/g, "")); // cast to number
  }
  if (key.includes("phone")) {
    // normalize phone to digits only for matching/linking
    return value.toString().replace(/\D+/g, "");
  }
  if (typeof value === "string") {
    return value.trim().toLowerCase(); // normalize text
  }
  return value;
}

function addDerivedPhoneMarkers(src, ddbItem) {
  const salt = process.env.PHONE_HASH_SALT || "";
  for (let i = 1; i <= 3; i++) {
    const raw = src[`phone_number_${i}`];
    if (!raw) continue;
    const digits = String(raw).replace(/\D+/g, "");
    if (!digits) continue;

    const last4 = digits.slice(-4);
    const area = digits.length >= 10 ? digits.slice(0, 3) : undefined;
    const hash = crypto
      .createHash("sha256")
      .update(salt + digits)
      .digest("hex");

    ddbItem[`phone${i}_last4`] = last4;
    if (area) ddbItem[`phone${i}_area`] = area;
    ddbItem[`phone${i}_hash`] = hash;
  }
}
