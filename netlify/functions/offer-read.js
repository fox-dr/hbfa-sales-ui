// netlify/functions/offer-read.js
// Route: `/.netlify/functions/offer-read`
// Methods: GET, OPTIONS
// Purpose: Return stable, non-PII subset of an offer (DDB)
// Consumers: `src/pages/ApprovalsPage.jsx` (details pane)
// Env: DDB_TABLE, DDB_REGION
// IAM: dynamodb:GetItem on the offers table
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";

const ddb = new DynamoDBClient(awsClientConfig());
const TABLE = process.env.DDB_TABLE || "fusion_offers";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export async function handler(event, context) {
  try {
    if (event.httpMethod === "OPTIONS") return json(204, "");
    if (event.httpMethod !== "GET") return json(405, { error: "Method Not Allowed" });

    const auth = requireAuth(event, ["SA", "VP"]);
    if (!auth.ok) return json(auth.statusCode, { error: auth.message });
    audit(event, { fn: "offer-read", stage: "invoke", claims: auth.claims });

    const offerId = event.queryStringParameters?.offerId;
    if (!offerId) return json(400, { error: "offerId is required" });

    const { Item } = await ddb.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: { offerId: { S: String(offerId) } },
      })
    );

    const raw = Item ? unmarshall(Item) : null;
    const body = shapeOffer(raw);
    audit(event, { fn: "offer-read", stage: "success", claims: auth.claims });
    return json(200, body);
  } catch (err) {
    console.error("offer-read error:", err);
    audit(event, { fn: "offer-read", stage: "error", extra: { message: err?.message } });
    return json(500, { error: err.message || String(err) });
  }
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function unmarshall(item) {
  return Object.fromEntries(
    Object.entries(item).map(([k, v]) => [k, Object.values(v)[0]])
  );
}

// Stable, non-PII schema for UI/report hydration
function shapeOffer(src) {
  const f = (v) => (v === undefined ? null : v);
  if (!src) {
    // return full shape with nulls
    return baseShape(null);
  }
  const o = baseShape(null);
  // Identity
  o.offerId = f(src.offerId);
  o.project_id = f(src.project_id);
  o.project_name = f(src.project_name);
  o.unit_number = f(src.unit_number);
  o.unit_name = f(src.unit_name);
  o.plan_type = f(src.plan_type);
  o.lot_number = f(src.lot_number);
  o.unit_phase = f(src.unit_phase);

  // Buyer (non‑PII)
  o.buyer_name = f(src.buyer_name);
  o.city = f(src.city);
  o.state = f(src.state);
  o.zip_code = f(src.zip_code);

  // Status + milestones
  o.status = f(src.status);
  o.status_date = f(src.status_date);
  o.contract_sent_date = f(src.contract_sent_date);
  o.fully_executed_date = f(src.fully_executed_date);
  o.week_ratified_date = f(src.week_ratified_date);
  o.initial_deposit_receipt_date = f(src.initial_deposit_receipt_date);
  o.financing_contingency_date = f(src.financing_contingency_date);
  o.loan_app_complete = f(src.loan_app_complete);
  o.loan_approved = f(src.loan_approved);
  o.loan_lock = f(src.loan_lock);
  o.appraisal_ordered = f(src.appraisal_ordered);
  o.appraiser_visit_date = f(src.appraiser_visit_date);
  o.appraisal_complete = f(src.appraisal_complete);
  o.loan_fund = f(src.loan_fund);
  o.loan_docs_ordered = f(src.loan_docs_ordered);
  o.loan_docs_signed = f(src.loan_docs_signed);
  o.projected_closing_date = f(src.projected_closing_date);
  o.adjusted_coe = f(src.adjusted_coe);
  o.walk_through_date = f(src.walk_through_date);
  o.buyer_walk = f(src.buyer_walk);
  o.notice_to_close = f(src.notice_to_close);
  o.coe_date = f(src.coe_date);
  o.buyer_complete = f(src.buyer_complete);
  // DocuSign/Handoff
  o.docusign_envelope = f(src.docusign_envelope);
  o.envelope_sent_date = f(src.envelope_sent_date);
  o.buyer_sign_date = f(src.buyer_sign_date);

  // Financials (sanitized numbers stored as strings in DDB; keep as strings here)
  o.price = f(src.price);
  o.final_price = f(src.final_price);
  o.list_price = f(src.list_price);
  o.initial_deposit_amount = f(src.initial_deposit_amount);
  o.seller_credit = f(src.seller_credit);
  o.upgrade_credit = f(src.upgrade_credit);
  o.total_upgrades_solar = f(src.total_upgrades_solar);
  o.hoa_credit = f(src.hoa_credit);
  o.total_credits = f(src.total_credits);

  // Lender / Brokerage (non‑PII fields only)
  o.lender = f(src.lender);
  o.brokerage = f(src.brokerage);

  // DocuSign / approval
  o.docusign_envelope = f(src.docusign_envelope);
  o.vp_approval_status = src.vp_approval_status ?? null; // BOOL may be missing
  o.vp_decision = f(src.vp_decision);
  o.vp_approval_date = f(src.vp_approval_date);
  o.vp_id = f(src.vp_id);

  return o;
}

function baseShape(_) {
  return {
    offerId: null,
    project_id: null,
    project_name: null,
    unit_number: null,
    unit_name: null,
    plan_type: null,
    lot_number: null,
    unit_phase: null,
    buyer_name: null,
    city: null,
    state: null,
    zip_code: null,
    status: null,
    status_date: null,
    contract_sent_date: null,
    fully_executed_date: null,
    week_ratified_date: null,
    initial_deposit_receipt_date: null,
    financing_contingency_date: null,
    loan_app_complete: null,
    loan_approved: null,
    loan_lock: null,
    appraisal_ordered: null,
    appraiser_visit_date: null,
    appraisal_complete: null,
    loan_fund: null,
    loan_docs_ordered: null,
    loan_docs_signed: null,
    projected_closing_date: null,
    adjusted_coe: null,
    walk_through_date: null,
    buyer_walk: null,
    notice_to_close: null,
    coe_date: null,
    buyer_complete: null,
    docusign_envelope: null,
    envelope_sent_date: null,
    buyer_sign_date: null,
    price: null,
    final_price: null,
    list_price: null,
    initial_deposit_amount: null,
    seller_credit: null,
    upgrade_credit: null,
    total_upgrades_solar: null,
    hoa_credit: null,
    total_credits: null,
    lender: null,
    brokerage: null,
    docusign_envelope: null,
    vp_approval_status: null,
    vp_decision: null,
    vp_approval_date: null,
    vp_id: null,
  };
}
