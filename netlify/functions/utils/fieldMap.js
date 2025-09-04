// fieldMap.js
export const fieldMap = {
  // Buyer
  buyer_name: "BOTH",
  buyer_notes: "S3",
  email_1: "S3",
  email_2: "S3",
  email_3: "S3",
  phone_number_1: "S3", // full numbers stored only in S3 vault
  phone_number_2: "S3",
  phone_number_3: "S3",
  buyer_1_full_name: "BOTH",
  buyer_2_full_name: "BOTH",

  // Address (retain street lines in S3 only; store city/state/zip for lookups)
  address_1: "S3",
  address_2: "S3",
  city: "DDB",
  state: "DDB",
  zip_code: "DDB",

  // Project + Unit
  project_id: "DDB",
  project_name: "DDB",
  unit_number: "DDB",
  unit_name: "DDB",
  plan_type: "DDB",
  lot_number: "DDB",
  unit_phase: "DDB",

  // Purchase
  price: "BOTH",
  purchase_type: "BOTH",
  cash_purchase: "S3",
  offer_notes_1: "S3",
  add_notes: "S3",
  coe_conditions: "S3",
  deposits_received_to_date: "S3",
  final_price: "BOTH",
  list_price: "BOTH",
  initial_deposit_amount: "BOTH",
  initial_deposit_receipt_date: "BOTH",
  seller_credit: "BOTH",
  upgrade_credit: "BOTH",
  total_upgrades_solar: "BOTH",
  hoa_credit: "BOTH",
  total_credits: "BOTH",

  // Lender / Broker
  lender: "BOTH",       // safe company name
  loan_officer: "S3",   // PII
  brokerage: "BOTH",
  broker_name: "S3",
  broker_email: "S3",
  escrow_number: "S3",
  financing_contingency_date: "DDB",
  loan_app_complete: "DDB",
  loan_approved: "DDB",
  loan_lock: "DDB",
  loan_fund: "DDB",
  lender_notes: "S3",

  // Transaction milestones
  offer_approved: "DDB",
  docusign_envelope: "DDB",
  status: "BOTH",
  status_date: "DDB",
  contract_sent_date: "DDB",
  fully_executed_date: "DDB",
  week_ratified_date: "DDB",
  initial_deposit_receipt_date: "DDB",
  appraisal_ordered: "DDB",
  appraiser_visit_date: "DDB",
  appraisal_complete: "DDB",
  loan_docs_ordered: "DDB",
  loan_docs_signed: "DDB",
  projected_closing_date: "DDB",
  adjusted_coe: "DDB",
  walk_through_date: "DDB",
  buyer_walk: "DDB",
  notice_to_close: "DDB",
  coe_date: "DDB",
  buyer_complete: "DDB",
};
