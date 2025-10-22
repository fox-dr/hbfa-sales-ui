// netlify/functions/offer-read.js
// Route: `/.netlify/functions/offer-read`
// Methods: GET, OPTIONS
// Purpose: Return stable, non-PII subset of an offer (DDB)
// Consumers: `src/pages/ApprovalsPage.jsx` (details pane)
// Env: DDB_TABLE, DDB_REGION
// IAM: dynamodb:GetItem on the offers table
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { awsClientConfig } from "./utils/awsClients.js";
import { requireAuth } from "./utils/auth.js";
import { audit } from "./utils/audit.js";
import { encodeOfferId, decodeOfferId } from "../../lib/offer-key.js";

const ddb = new DynamoDBClient(awsClientConfig());
const TABLE =
  process.env.HBFA_SALES_OFFERS_TABLE ||
  process.env.DDB_TABLE ||
  "hbfa_sales_offers";

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

    const { projectId, contractUnitNumber } = resolveKey(
      event.queryStringParameters || {}
    );
    if (!projectId || !contractUnitNumber) {
      return json(400, { error: "offerId or project/unit key required" });
    }

    const { Item } = await ddb.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: marshall(
          {
            project_id: projectId,
            contract_unit_number: contractUnitNumber,
          },
          { removeUndefinedValues: true }
        ),
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
  if (!src) return baseShape();

  const o = baseShape();
  const offerId = encodeOfferId(src.project_id, src.contract_unit_number);

  o.offerId = offerId || null;
  o.project_id = f(src.project_id);
  o.contract_unit_number = f(src.contract_unit_number);
  o.project_name = f(src.project_name);
  o.unit_number = f(src.unit_number);
  o.unit_name = f(src.unit_name);
  o.unit_phase = f(src.unit_phase);
  o.plan_type = f(src.plan_type);
  o.lot_number = f(src.lot_number);
  const buyerName =
    src.buyers_combined ||
    src.buyer_name ||
    src.buyer_1__full_name ||
    src.buyer_1_full_name ||
    src.buyer_2_full_name ||
    null;
  o.buyer_name = f(buyerName);
  o.buyers_combined = f(buyerName);
  o.city = f(src.buyer_current_city || src.city);
  o.state = f(src.buyer_current_state || src.state);
  o.zip_code = f(src.buyer_current_zip || src.zip_code);
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
  o.loan_docs_ordered = f(src.loan_docs_ordered);
  o.loan_docs_signed = f(src.loan_docs_signed);
  o.loan_fund = f(src.loan_fund);
  o.projected_closing_date = f(src.projected_closing_date);
  o.adjusted_coe = f(src.adjusted_coe || src.extended_adjusted_coe);
  o.walk_through_date = f(src.walk_through_date);
  o.notice_to_close = f(src.notice_to_close);
  o.coe_date = f(src.coe_date);
  o.buyer_sign_date = f(src.buyer_sign_date);
  o.buyer_complete = f(src.buyer_complete);
  o.envelope_sent_date = f(src.envelope_sent_date);
  o.docusign_envelope = f(src.docusign_envelope);
  o.notes = f(src.notes);

  o.final_price = f(src.final_price);
  o.list_price = f(src.list_price);
  o.base_price = f(src.base_price);
  o.price = f(src.price || src.base_price || src.final_price);
  o.initial_deposit_amount = f(src.initial_deposit_amount);
  o.seller_credit = f(src.seller_credit);
  o.upgrade_credit = f(src.upgrade_credit);
  o.total_upgrades_solar = f(src.total_upgrades_solar);
  o.hoa_credit = f(src.hoa_credit);
  o.total_credits = f(src.total_credits);

  o.polaris_report_date = f(src.polaris_report_date);
  o.source = f(src.source);

  o.vp_approval_status =
    src.vp_approval_status === undefined ? null : src.vp_approval_status;
  o.vp_decision = f(src.vp_decision);
  o.vp_approval_date = f(src.vp_approval_date);
  o.vp_id = f(src.vp_id);

  return o;
}

function baseShape() {
  return {
    offerId: null,
    project_id: null,
    contract_unit_number: null,
    project_name: null,
    unit_number: null,
    unit_name: null,
    unit_phase: null,
    plan_type: null,
    lot_number: null,
    buyer_name: null,
    buyers_combined: null,
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
    loan_docs_ordered: null,
    loan_docs_signed: null,
    loan_fund: null,
    projected_closing_date: null,
    adjusted_coe: null,
    walk_through_date: null,
    notice_to_close: null,
    coe_date: null,
    buyer_sign_date: null,
    buyer_complete: null,
    envelope_sent_date: null,
    docusign_envelope: null,
    notes: null,
    final_price: null,
    list_price: null,
    base_price: null,
    price: null,
    initial_deposit_amount: null,
    seller_credit: null,
    upgrade_credit: null,
    total_upgrades_solar: null,
    hoa_credit: null,
    total_credits: null,
    polaris_report_date: null,
    source: null,
    vp_approval_status: null,
    vp_decision: null,
    vp_approval_date: null,
    vp_id: null,
  };
}

function resolveKey(qs = {}) {
  if (qs.offerId) {
    const decoded = decodeOfferId(qs.offerId);
    if (decoded.projectId && decoded.contractUnitNumber) {
      return {
        projectId: decoded.projectId,
        contractUnitNumber: decoded.contractUnitNumber,
      };
    }
  }
  const projectId =
    qs.project_id || qs.projectId || qs.project || qs.pk || undefined;
  const contractUnitNumber =
    qs.contract_unit_number ||
    qs.contractUnitNumber ||
    qs.unit_number ||
    qs.unit ||
    undefined;
  return {
    projectId: projectId ? String(projectId) : "",
    contractUnitNumber: contractUnitNumber ? String(contractUnitNumber) : "",
  };
}
