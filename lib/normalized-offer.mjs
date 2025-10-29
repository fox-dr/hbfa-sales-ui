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

const SOMI_HAYWARD_RE = /^somi\s+hayward$/i;
const SOMI_TOWNS_ID = "SoMi Towns";
const SOMI_CONDOS_A_ID = "SoMi A";
const SOMI_CONDOS_B_ID = "SoMi B";

function deriveUnitIdentity(projectIdRaw, rawContractUnitNumber, unitNameRaw) {
  let contractUnitNumber = asString(rawContractUnitNumber);
  let unitNumber = asString(rawContractUnitNumber);
  let unitNumberNumeric;
  let unitCollection;
  let unitBuildingCode;
  let projectIdOverride;

  const projectId = asString(projectIdRaw);
  const unitName = asString(unitNameRaw);

  const ensureDigits = (source) => {
    if (!source) return undefined;
    const match = String(source).match(/(\d+)\s*$/);
    return match ? match[1] : undefined;
  };

  const digitsFromContract = ensureDigits(contractUnitNumber);
  if (digitsFromContract) {
    unitNumber = digitsFromContract;
    const maybeNumeric = Number(digitsFromContract);
    if (Number.isFinite(maybeNumeric)) {
      unitNumberNumeric = maybeNumeric;
    }
  }

  if (projectId && SOMI_HAYWARD_RE.test(projectId)) {
    const marketingLabel = unitName || contractUnitNumber;
    const marketingLower = marketingLabel ? marketingLabel.toLowerCase() : "";
    const digits = ensureDigits(marketingLabel) || ensureDigits(contractUnitNumber);
    if (digits) {
      unitNumber = digits;
      const maybeNumeric = Number(digits);
      if (Number.isFinite(maybeNumeric)) {
        unitNumberNumeric = maybeNumeric;
      }
    }

    const existingHayView = contractUnitNumber && /^hayview-/i.test(contractUnitNumber);
    if (marketingLower.includes("hayview") || existingHayView) {
      const suffix = digits || digitsFromContract || unitNumber;
      if (suffix) {
        contractUnitNumber = `HayView-${suffix}`;
      }
      unitCollection = "HayView Condos";
      unitBuildingCode = "A";
      projectIdOverride = SOMI_CONDOS_A_ID;
    } else if (marketingLower.includes("haypark")) {
      if (unitNumberNumeric && unitNumberNumeric >= 200) {
        unitCollection = "HayPark Condos";
        unitBuildingCode = "B";
        projectIdOverride = SOMI_CONDOS_B_ID;
      } else if (unitNumberNumeric) {
        unitCollection = "HayPark Towns";
        projectIdOverride = SOMI_TOWNS_ID;
      }
      if (!contractUnitNumber) {
        contractUnitNumber = unitNumber;
      }
    } else if (unitNumberNumeric && unitNumberNumeric <= 123) {
      projectIdOverride = SOMI_TOWNS_ID;
      unitCollection = unitCollection || "HayPark Towns";
    } else if (unitNumberNumeric) {
      projectIdOverride = SOMI_CONDOS_B_ID;
      unitCollection = unitCollection || "HayPark Condos";
      unitBuildingCode = unitBuildingCode || "B";
    }
  }

  if (!contractUnitNumber && unitNumber) {
    contractUnitNumber = unitNumber;
  }

  return {
    contractUnitNumber,
    unitNumber,
    unitNumberNumeric,
    unitCollection,
    unitBuildingCode,
    projectIdOverride,
  };
}

export function mapFusionOfferToNormalized(src = {}) {
  const projectId = asString(src.project_id || src.project_name);
  const rawUnitNumber = asString(src.contract_unit_number || src.unit_number || src.offerid);
  const unitName = asString(src.unit_name);

  if (!projectId || !rawUnitNumber) {
    return { skip: true, reason: "missing_project_or_unit" };
  }

  const buyer1 = asString(src.buyer_1_full_name || src.buyer_name);
  const buyer2 = asString(src.buyer_2_full_name);
  const identity = deriveUnitIdentity(projectId, rawUnitNumber, unitName);
  const effectiveProjectId = identity.projectIdOverride || projectId;

  const mapped = {
    project_id: effectiveProjectId,
    contract_unit_number: identity.contractUnitNumber,
    unit_number: identity.unitNumber,
    unit_number_numeric: identity.unitNumberNumeric,
    unit_collection: identity.unitCollection,
    unit_building_code: identity.unitBuildingCode,
    legacy_project_id: projectId,
    alt_project_name: asString(src.project_name),
    unit_name: unitName,
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

function pickValue(source, ...keys) {
  if (!source) return undefined;
  for (const key of keys) {
    if (!key) continue;
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
}

export function mapPolarisRowToNormalized(row = {}, reportDate, options = {}) {
  const { phoneHashSalt = "", includeFusion = false } = options;

  const projectId = asString(
    row.project_id || row.project_name || row.alt_project_name || row.project
  );
  const unitName = asString(row.unit_name || row.buyer_contract_unit_name);
  const rawContractUnitNumber = asString(
    row.contract_unit_number || row.buyer_contract_unit_number || unitName
  );
  const identity = deriveUnitIdentity(projectId, rawContractUnitNumber, unitName);
  const contractUnitNumber = identity.contractUnitNumber;
  const effectiveProjectId = identity.projectIdOverride || projectId;

  if (!effectiveProjectId || !contractUnitNumber) {
    return { skip: true, reason: "missing_project_or_unit" };
  }
  if (!includeFusion && /^fusion$/i.test(effectiveProjectId)) {
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
    project_id: effectiveProjectId,
    contract_unit_number: contractUnitNumber,
    unit_number: identity.unitNumber,
    unit_number_numeric: identity.unitNumberNumeric,
    unit_collection: identity.unitCollection,
    unit_building_code: identity.unitBuildingCode,
    legacy_project_id: projectId,
    alt_project_name: asString(row.alt_project_name || row.altprojectname),
    unit_name: unitName,
    buyer_1__full_name: buyer1,
    buyer_2_full_name: buyer2,
    buyers_combined:
      asString(pickValue(row, "buyers_combined", "buyer_contract_buyers_combined")) ||
      buildBuyersCombined(buyer1, buyer2),
    buyer1_email: asString(pickValue(row, "buyer_email", "buyer1_email", "buyer_contract_buyer_email")),
    buyer_2_email: asString(pickValue(row, "buyer_2_email", "buyer_contract_buyer_2_email")),
    buyer_mobile_phone: asString(pickValue(row, "buyer_mobile_phone", "buyer_contract_buyer_mobile_phone")),
    projected_closing_date: asDate(
      pickValue(row, "projected_closing_date", "buyer_contract_projected_closing_date")
    ),
    coe_date: asDate(pickValue(row, "coe_date", "buyer_contract_coe_date")),
    extended_adjusted_coe: asDate(
      pickValue(row, "extended_adjusted_coe", "adjusted_coe", "buyer_contract_extended_adjusted_coe")
    ),
    week_ratified_date: asDate(
      pickValue(row, "week_ratified_date", "buyer_contract_week_ratified_date")
    ),
    fully_executed_date: asDate(
      pickValue(row, "fully_executed_date", "buyer_contract_fully_executed_date")
    ),
    contract_sent_date: asDate(
      pickValue(row, "contract_sent_date", "buyer_contract_contract_sent_date")
    ),
    financing_contingency_date: asDate(
      pickValue(row, "financing_contingency_date", "buyer_contract_financing_contingency_date")
    ),
    cash: asBooleanString(pickValue(row, "cash", "buyer_contract_cash")),
    initial_deposit_amount: asNumber(
      pickValue(row, "initial_deposit_amount", "buyer_contract_initial_deposit_amount")
    ),
    initial_deposit_receipt_date: asDate(
      pickValue(row, "initial_deposit_receipt_date", "buyer_contract_initial_deposit_receipt_date")
    ),
    deposits_received_to_date: asNumber(
      pickValue(row, "deposits_received_to_date", "buyer_contract_deposits_received_to_date")
    ),
    base_price: asNumber(pickValue(row, "base_price", "buyer_contract_base_price")),
    list_price: asNumber(pickValue(row, "list_price", "buyer_contract_list_price")),
    final_price: asNumber(pickValue(row, "final_price", "buyer_contract_final_price")),
    investor_owner: asBooleanString(
      pickValue(row, "investor_owner", "buyer_contract_investor_owner")
    ),
    lot_number: asString(pickValue(row, "lot_number", "buyer_contract_lot_number")),
    notes: asString(pickValue(row, "notes", "buyer_contract_notes")),
    unit_phase: asString(pickValue(row, "unit_phase", "buyer_contract_unit_phase")),
    agent_brokerage: asString(pickValue(row, "agent_brokerage", "buyer_contract_agent_brokerage")),
    referring_agent_full_name: asString(
      pickValue(row, "referring_agent_full_name", "buyer_contract_referring_agent_full_name")
    ),
    referring_agent_email: asString(
      pickValue(row, "referring_agent_email", "buyer_contract_referring_agent_email")
    ),
    seller_credit: asNumber(pickValue(row, "seller_credit", "buyer_contract_seller_credit")),
    upgrade_credit: asNumber(pickValue(row, "upgrade_credit", "buyer_contract_upgrade_credit")),
    hoa_credit: asNumber(pickValue(row, "hoa_credit", "buyer_contract_hoa_credit")),
    total_credits: asNumber(pickValue(row, "total_credits", "buyer_contract_total_credits")),
    total_upgrades_solar: asNumber(
      pickValue(row, "total_upgrades_solar", "buyer_contract_total_upgrades_solar")
    ),
    status,
    status_date: asDate(pickValue(row, "status_date", "buyer_contract_status_date")),
    statusnumeric: statusNumeric,
    appraisal_ordered: asDate(
      pickValue(row, "appraisal_ordered", "buyer_contract_appraisal_ordered")
    ),
    appraiser_visit_date: asDate(
      pickValue(row, "appraiser_visit_date", "buyer_contract_appraiser_visit_date")
    ),
    appraisal_complete: asDate(
      pickValue(row, "appraisal_complete", "buyer_contract_appraisal_complete")
    ),
    buyer_current_address: asString(
      pickValue(row, "buyer_current_address", "buyer_contract_buyer_current_address")
    ),
    buyer_current_city: asString(
      pickValue(row, "buyer_current_city", "buyer_contract_buyer_current_city")
    ),
    buyer_current_state: asString(
      pickValue(row, "buyer_current_state", "buyer_contract_buyer_current_state")
    ),
    buyer_sign_date: asDate(pickValue(row, "buyer_sign_date", "buyer_contract_buyer_sign_date")),
    buyer_complete: asDate(pickValue(row, "buyer_complete", "buyer_contract_buyer_complete")),
    primary_lender: asString(
      pickValue(row, "primary_lender", "buyer_contract_primary_lender")
    ),
    primary_loan_officer_full_name: asString(
      pickValue(
        row,
        "primary_loan_officer_full_name",
        "buyer_contract_primary_loan_officer_full_name"
      )
    ),
    loan_app_complete: asDate(
      pickValue(row, "loan_app_complete", "buyer_contract_loan_app_complete")
    ),
    loan_lock: asDate(pickValue(row, "loan_lock", "buyer_contract_loan_lock")),
    loan_approved: asDate(pickValue(row, "loan_approved", "buyer_contract_loan_approved")),
    loan_docs_ordered: asDate(
      pickValue(row, "loan_docs_ordered", "buyer_contract_loan_docs_ordered")
    ),
    loan_docs_signed: asDate(
      pickValue(row, "loan_docs_signed", "buyer_contract_loan_docs_signed")
    ),
    notice_to_close: asDate(
      pickValue(row, "notice_to_close", "buyer_contract_notice_to_close")
    ),
    loan_fund: asDate(pickValue(row, "loan_fund", "buyer_contract_loan_fund")),
    escrow_number: asString(pickValue(row, "escrow_number", "buyer_contract_escrow_number")),
    walk_through_date: asDate(
      pickValue(row, "walk_through_date", "buyer_contract_walk_through_date")
    ),
    polaris_report_date: asDate(reportDate) || undefined,
    polaris_loaded_at: new Date().toISOString(),
    source: "polaris",
    ...(isClosed ? { is_immutable: 1 } : {}),
    ...phoneMarkers,
  };

  return { skip: false, mapped: stripEmptyValues(mapped) };
}
