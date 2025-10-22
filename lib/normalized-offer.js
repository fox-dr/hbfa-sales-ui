import crypto from "node:crypto";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

export function asString(value) {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

export function asNumber(value) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

export function asDate(value) {
  const str = asString(value);
  if (!str) return undefined;
  if (ISO_DATE_RE.test(str)) return str.substring(0, 10);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().substring(0, 10);
}

export function asBooleanString(value) {
  const str = asString(value);
  if (!str) return undefined;
  if (/^(y|yes|true|1)$/i.test(str)) return "true";
  if (/^(n|no|false|0)$/i.test(str)) return "false";
  return str.toLowerCase();
}

export function buildBuyersCombined(primary, secondary) {
  const names = [primary, secondary].filter(Boolean);
  if (!names.length) return undefined;
  if (names.length === 1) return names[0];
  return `${names[0]} & ${names[1]}`;
}

export function derivePhoneMarkers(rawPhone, phoneHashSalt = "") {
  const normalized = asString(rawPhone);
  if (!normalized) return {};
  const digits = normalized.replace(/\D+/g, "");
  if (!digits.length) return {};
  const markers = {
    phone1_hash: crypto.createHash("sha256").update(phoneHashSalt + digits).digest("hex"),
    phone1_last4: digits.slice(-4),
  };
  if (digits.length >= 10) markers.phone1_area = digits.slice(0, 3);
  return markers;
}

export function stripEmptyValues(record) {
  if (!record) return record;
  for (const key of Object.keys(record)) {
    const value = record[key];
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "number" && Number.isNaN(value))
    ) {
      delete record[key];
    }
  }
  return record;
}

export function mapFusionOfferToNormalized(src = {}) {
  const projectId = asString(src.project_id || src.project_name);
  const unitNumber = asString(src.contract_unit_number || src.unit_number || src.offerid);

  if (!projectId || !unitNumber) {
    return { skip: true, reason: "missing_project_or_unit" };
  }

  const buyer1 = asString(src.buyer_1_full_name || src.buyer_name);
  const buyer2 = asString(src.buyer_2_full_name);

  const mapped = {
    project_id: projectId,
    contract_unit_number: unitNumber,
    unit_number: unitNumber,
    alt_project_name: asString(src.project_name),
    unit_name: asString(src.unit_name),
    buyer_1__full_name: buyer1,
    buyer_2_full_name: buyer2,
    buyers_combined: buildBuyersCombined(buyer1, buyer2),
    buyer1_email: asString(src.buyer_email || src.email_1),
    buyer_2_email: asString(src.buyer_2_email || src.email_2),
    buyer_mobile_phone: asString(src.buyer_mobile_phone),
    phone1_area: asString(src.phone1_area),
    phone1_hash: asString(src.phone1_hash),
    phone1_last4: asString(src.phone1_last4),
    projected_closing_date: asDate(src.projected_closing_date),
    coe_date: asDate(src.coe_date),
    extended_adjusted_coe: asDate(src.adjusted_coe || src.extended_adjusted_coe),
    week_ratified_date: asDate(src.week_ratified_date),
    fully_executed_date: asDate(src.fully_executed_date),
    contract_sent_date: asDate(src.contract_sent_date),
    financing_contingency_date: asDate(src.financing_contingency_date),
    cash: asString(src.cash || src.cash_purchase),
    initial_deposit_amount: asNumber(src.initial_deposit_amount),
    initial_deposit_receipt_date: asDate(src.initial_deposit_receipt_date),
    deposits_received_to_date: asNumber(src.deposits_received_to_date),
    base_price: asNumber(src.base_price || src.price),
    list_price: asNumber(src.list_price),
    final_price: asNumber(src.final_price),
    investor_owner: asString(
      src.investor_owner || (src.purchase_type === "investment_property" ? "true" : undefined)
    ),
    lot_number: asString(src.lot_number),
    notes: asString(src.notes || src.add_notes),
    unit_phase: asString(src.unit_phase),
    agent_brokerage: asString(src.brokerage || src.agent_brokerage),
    referring_agent_full_name: asString(src.broker_name || src.referring_agent_full_name),
    referring_agent_email: asString(src.broker_email || src.referring_agent_email),
    seller_credit: asNumber(src.seller_credit),
    upgrade_credit: asNumber(src.upgrade_credit),
    hoa_credit: asNumber(src.hoa_credit),
    total_credits: asNumber(src.total_credits),
    total_upgrades_solar: asNumber(src.total_upgrades_solar),
    status: asString(src.status),
    status_date: asDate(src.status_date),
    statusnumeric: asNumber(src.statusnumeric),
    appraisal_ordered: asDate(src.appraisal_ordered),
    appraiser_visit_date: asDate(src.appraiser_visit_date),
    appraisal_complete: asDate(src.appraisal_complete),
    buyer_current_address: asString(src.buyer_current_address || src.address_1),
    buyer_current_city: asString(src.city || src.buyer_current_city),
    buyer_current_state: asString(src.state || src.buyer_current_state),
    buyer_sign_date: asDate(src.buyer_sign_date),
    buyer_complete: asDate(src.buyer_complete),
    primary_lender: asString(src.lender || src.primary_lender),
    primary_loan_officer_full_name: asString(src.loan_officer || src.primary_loan_officer_full_name),
    loan_app_complete: asDate(src.loan_app_complete),
    loan_lock: asDate(src.loan_lock),
    loan_approved: asDate(src.loan_approved),
    loan_docs_ordered: asDate(src.loan_docs_ordered),
    loan_docs_signed: asDate(src.loan_docs_signed),
    notice_to_close: asDate(src.notice_to_close),
    loan_fund: asDate(src.loan_fund),
    escrow_number: asString(src.escrow_number),
    walk_through_date: asDate(src.walk_through_date),
  };

  return { skip: false, mapped: stripEmptyValues(mapped) };
}

export function mapPolarisRowToNormalized(row = {}, reportDate, options = {}) {
  const { phoneHashSalt = "" } = options;

  const projectId = asString(
    row.project_id || row.project_name || row.alt_project_name || row.project
  );
  const unitName = asString(row.unit_name || row.buyer_contract_unit_name);
  const contractUnitNumber = asString(
    row.contract_unit_number || row.buyer_contract_unit_number || unitName
  );

  if (!projectId || !contractUnitNumber) {
    return { skip: true, reason: "missing_project_or_unit" };
  }
  if (/^fusion$/i.test(projectId)) {
    return { skip: true, reason: "fusion_project_filtered" };
  }

  const buyer1 = asString(row.buyer_1__full_name || row.buyer_1_full_name || row.buyer_primary);
  const buyer2 = asString(row.buyer_2_full_name || row.co_buyer);
  const status = asString(row.status || row.buyer_contract_status);
  const statusNumeric = asNumber(row.statusnumeric || row.status_numeric);
  const isClosed =
    statusNumeric === 4 ||
    (status && /closed|complete/i.test(status)) ||
    (row.coe_date && asDate(row.coe_date));

  const phoneMarkers = derivePhoneMarkers(
    row.buyer_mobile_phone || row.primary_phone || row.phone || row.phone_number || row.phone1,
    phoneHashSalt
  );

  const mapped = {
    project_id: projectId,
    contract_unit_number: contractUnitNumber,
    unit_number: contractUnitNumber,
    alt_project_name: asString(row.alt_project_name || row.altprojectname),
    unit_name: unitName,
    buyer_1__full_name: buyer1,
    buyer_2_full_name: buyer2,
    buyers_combined:
      asString(row.buyers_combined) || buildBuyersCombined(buyer1, buyer2),
    buyer1_email: asString(row.buyer_email || row.buyer1_email),
    buyer_2_email: asString(row.buyer_2_email),
    buyer_mobile_phone: asString(row.buyer_mobile_phone),
    projected_closing_date: asDate(row.projected_closing_date),
    coe_date: asDate(row.coe_date),
    extended_adjusted_coe: asDate(row.extended_adjusted_coe || row.adjusted_coe),
    week_ratified_date: asDate(row.week_ratified_date),
    fully_executed_date: asDate(row.fully_executed_date),
    contract_sent_date: asDate(row.contract_sent_date),
    financing_contingency_date: asDate(row.financing_contingency_date),
    cash: asBooleanString(row.cash),
    initial_deposit_amount: asNumber(row.initial_deposit_amount),
    initial_deposit_receipt_date: asDate(row.initial_deposit_receipt_date),
    deposits_received_to_date: asNumber(row.deposits_received_to_date),
    base_price: asNumber(row.base_price),
    list_price: asNumber(row.list_price),
    final_price: asNumber(row.final_price),
    investor_owner: asBooleanString(row.investor_owner),
    lot_number: asString(row.lot_number),
    notes: asString(row.notes),
    unit_phase: asString(row.unit_phase),
    agent_brokerage: asString(row.agent_brokerage),
    referring_agent_full_name: asString(row.referring_agent_full_name),
    referring_agent_email: asString(row.referring_agent_email),
    seller_credit: asNumber(row.seller_credit),
    upgrade_credit: asNumber(row.upgrade_credit),
    hoa_credit: asNumber(row.hoa_credit),
    total_credits: asNumber(row.total_credits),
    total_upgrades_solar: asNumber(row.total_upgrades_solar),
    status,
    status_date: asDate(row.status_date),
    statusnumeric: statusNumeric,
    appraisal_ordered: asDate(row.appraisal_ordered),
    appraiser_visit_date: asDate(row.appraiser_visit_date),
    appraisal_complete: asDate(row.appraisal_complete),
    buyer_current_address: asString(row.buyer_current_address),
    buyer_current_city: asString(row.buyer_current_city),
    buyer_current_state: asString(row.buyer_current_state),
    buyer_sign_date: asDate(row.buyer_sign_date),
    buyer_complete: asDate(row.buyer_complete),
    primary_lender: asString(row.primary_lender),
    primary_loan_officer_full_name: asString(row.primary_loan_officer_full_name),
    loan_app_complete: asDate(row.loan_app_complete),
    loan_lock: asDate(row.loan_lock),
    loan_approved: asDate(row.loan_approved),
    loan_docs_ordered: asDate(row.loan_docs_ordered),
    loan_docs_signed: asDate(row.loan_docs_signed),
    notice_to_close: asDate(row.notice_to_close),
    loan_fund: asDate(row.loan_fund),
    escrow_number: asString(row.escrow_number),
    walk_through_date: asDate(row.walk_through_date),
    polaris_report_date: asDate(reportDate) || undefined,
    polaris_loaded_at: new Date().toISOString(),
    source: "polaris",
    ...(isClosed ? { is_immutable: 1 } : {}),
    ...phoneMarkers,
  };

  return { skip: false, mapped: stripEmptyValues(mapped) };
}

