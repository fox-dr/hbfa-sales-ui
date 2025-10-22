// Routes Used by this page
// - GET `/.netlify/functions/tracking-search`: search offers by buyer/unit/id
// - GET `/.netlify/functions/offer-details`: PII contact details for selected offer
// - PUT `/.netlify/functions/offers`: save tracking fields for the current offer
// >>> copypasta starts here
// src/pages/TrackingForm.jsx
import React, { useState } from "react";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";
import FormSection from "../components/FormSection";
import "../styles/form.css";
import {
  searchOffers,
  getOfferDetails as apiGetOfferDetails,
  saveOfferTracking,
  getOfferRead,
} from "../api/client";
import { decodeOfferId } from "../../lib/offer-key.mjs";

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

const DATE_FIELDS = [
  "contract_sent_date",
  "fully_executed_date",
  "projected_closing_date",
  "initial_deposit_receipt_date",
  "financing_contingency_date",
  "loan_app_complete",
  "loan_approved",
  "loan_lock",
  "appraisal_ordered",
  "appraiser_visit_date",
  "appraisal_complete",
  "walk_through_date",
  "adjusted_coe",
  "notice_to_close",
  "loan_docs_ordered",
  "loan_docs_signed",
  "loan_fund",
  "coe_date",
  "buyer_complete",
  "envelope_sent_date",
  "buyer_sign_date",
];

const NUMERIC_FIELDS = [
  "final_price",
  "list_price",
  "initial_deposit_amount",
  "seller_credit",
  "upgrade_credit",
  "total_upgrades_solar",
  "hoa_credit",
  "total_credits",
];

const CREDIT_FIELDS = [
  "seller_credit",
  "upgrade_credit",
  "total_upgrades_solar",
  "hoa_credit",
];

const NUMERIC_FIELDS_SET = new Set(NUMERIC_FIELDS);

function formatDateForInput(value) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function normalizeNumeric(value) {
  if (value === null || value === undefined || value === "") return "";
  const num = Number(value);
  return Number.isFinite(num) ? num : "";
}

function calculateTotalCredits(data) {
  const anyFilled = CREDIT_FIELDS.some((key) => {
    const val = data[key];
    return val !== undefined && val !== "" && Number.isFinite(Number(val));
  });
  if (!anyFilled) return "";
  return CREDIT_FIELDS.reduce((acc, key) => acc + (Number(data[key]) || 0), 0);
}

function normalizeOfferData(offer = {}, fallback = {}) {
  const src = offer || {};
  const fb = fallback || {};
  const next = {};

  const resolveValue = (key) => {
    const primary = src[key];
    if (primary !== undefined && primary !== null && primary !== "") return primary;
    const secondary = fb[key];
    if (secondary !== undefined && secondary !== null && secondary !== "") return secondary;
    return "";
  };

  const resolvedOfferId = resolveValue("offerId") || fb.offerId || "";
  next.offerId = resolvedOfferId;
  if (resolvedOfferId) {
    const decoded = decodeOfferId(resolvedOfferId);
    if (decoded.projectId && !src.project_id && !fb.project_id) {
      next.project_id = decoded.projectId;
    }
    if (decoded.contractUnitNumber && !src.contract_unit_number && !fb.contract_unit_number) {
      next.contract_unit_number = decoded.contractUnitNumber;
    }
  }

  next.project_id = next.project_id || resolveValue("project_id") || "";
  next.contract_unit_number =
    next.contract_unit_number || resolveValue("contract_unit_number") || resolveValue("unit_number") || "";
  next.unit_number = resolveValue("unit_number") || next.contract_unit_number || "";
  next.unit_name = resolveValue("unit_name") || fb.unit_name || "";

  const buyerCombined = resolveValue("buyers_combined") || resolveValue("buyer_name");
  if (buyerCombined !== "") {
    next.buyers_combined = buyerCombined;
    next.buyer_name = buyerCombined;
  }

  const statusVal = resolveValue("status");
  if (statusVal !== "") next.status = statusVal;
  const envelopeVal = resolveValue("docusign_envelope");
  if (envelopeVal !== "") next.docusign_envelope = envelopeVal;
  const notesVal = resolveValue("notes");
  if (notesVal !== "") next.notes = notesVal;

  DATE_FIELDS.forEach((field) => {
    const formatted = formatDateForInput(resolveValue(field));
    if (formatted) {
      next[field] = formatted;
    }
  });

  NUMERIC_FIELDS.forEach((field) => {
    if (field === "total_credits") return;
    const numeric = normalizeNumeric(resolveValue(field));
    if (numeric !== "") {
      next[field] = numeric;
    }
  });

  const credits = calculateTotalCredits({ ...fb, ...src, ...next });
  if (credits !== "") {
    next.total_credits = credits;
  }

  return next;
}


export default function TrackingForm() {
  const auth = useAuth();
  const [form, setForm] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [pii, setPii] = useState(null);

  // --- Single handleSearch (proxy + JWT) ---
  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsLoading(true);
    setError("");

    try {
      const jwt = auth?.user?.access_token || auth?.user?.id_token || null;
      if (!jwt) throw new Error("No JWT token available");
      console.log("JWT claims:", parseJwt(jwt));
      const results = await searchOffers(jwt, q);
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message || "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

    // --- When a result is clicked, fill form ---
  const selectResult = (item) => {
    hydrateSelection(item);
  };

  const hydrateSelection = async (item) => {
    setSearchResults([]);
    setError("");
    const base = normalizeOfferData({}, item);
    setForm(base);
    setPii(null);

    try {
      const jwt = auth?.user?.access_token || auth?.user?.id_token || null;
      if (!jwt) throw new Error("No JWT token available");
      const record = await getOfferRead(jwt, item.offerId);
      const hydrated = normalizeOfferData(record, item);
      setForm(hydrated);
    } catch (err) {
      console.error("Failed to load offer record:", err);
      setError(err.message || "Failed to load offer details");
      setForm(normalizeOfferData({}, item));
    }

    // Optionally fetch PII details for contact (phone, emails) for authorized roles
    fetchOfferDetails(item.offerId);
  };
  // --- Form change handler ---
  const handleChange = (e) => {
    const { name } = e.target;
    const raw = e.target.value;

    setForm((prev) => {
      const next = { ...prev };
      if (NUMERIC_FIELDS_SET.has(name)) {
        const num = raw === "" ? "" : Number(raw);
        next[name] = Number.isFinite(num) ? num : "";
      } else {
        next[name] = raw;
      }
      next.total_credits = calculateTotalCredits(next);
      return next;
    });
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    saveTracking();
  };

  async function fetchOfferDetails(offerId) {
    try {
      const jwt = auth?.user?.access_token || auth?.user?.id_token || null;
      if (!jwt) return;
      const data = await apiGetOfferDetails(jwt, offerId);
      if (data) setPii(data);
    } catch (e) {
      // swallow for now
    }
  }

  async function saveTracking() {
    try {
      const jwt = auth?.user?.access_token || auth?.user?.id_token || null;
      if (!jwt) throw new Error("No JWT token available");
      if (!form.offerId) throw new Error("Select a record before saving");
      const payload = { ...form };
      if ((!payload.project_id || !payload.contract_unit_number) && payload.offerId) {
        const decoded = decodeOfferId(payload.offerId);
        if (decoded.projectId && !payload.project_id) payload.project_id = decoded.projectId;
        if (decoded.contractUnitNumber && !payload.contract_unit_number) {
          payload.contract_unit_number = decoded.contractUnitNumber;
        }
      }
      if (payload.status && !payload.status_date) {
        payload.status_date = new Date().toISOString();
      }
      await saveOfferTracking(jwt, payload);
      alert("Tracking saved");
    } catch (e) {
      alert(e.message || "Save failed");
    }
  }

  const formatCurrency = (val) => {
    if (val === undefined || val === "") return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div>
        <AppHeader />
        
        {/* --- Search UI --- */}
        <form onSubmit={handleSearch} className="app-form" style={{ marginBottom: "1rem" }}>
            <input
            type="text"
            placeholder="Search by buyer or unit"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Lookup</button>
        </form>

      {isLoading && <p>Searching…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {searchResults.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem" }}>
          {searchResults.map((item) => (
            <li
              key={item.offerId}
              style={{ cursor: "pointer", padding: "0.5rem 0" }}
              onClick={() => selectResult(item)}
            >
              <strong>{item.project_id || "?"}</strong> /{" "}
              {item.contract_unit_number || item.unit_number || "?"} -{" "}
              {item.buyer_name || "Unknown"} - {(item.status || "").toLowerCase()}
            </li>
          ))}
        </ul>
      )}
      {pii && (
        <div style={{ marginBottom: "1rem" }}>
          <strong>Contact</strong>
          <div>Phone 1: {pii.phone_number_1 || "—"}</div>
          <div>Phone 2: {pii.phone_number_2 || "—"}</div>
          <div>Phone 3: {pii.phone_number_3 || "—"}</div>
          <div>Email 1: {pii.email_1 || "—"}</div>
          <div>Email 2: {pii.email_2 || "—"}</div>
          <div>Email 3: {pii.email_3 || "—"}</div>
        </div>
      )}
       {/*--comment out for debugging--*/}
      {/* --- {!isLoading && !error && searchResults.length === 0 && (
        <p>No results found for "{searchQuery}".</p>
      )} --*/}

      {form.project_id && form.contract_unit_number && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "#f4f4f4", borderRadius: "4px" }}>
          <div>
            <strong>Project:</strong> {form.project_id}
          </div>
          <div>
            <strong>Unit:</strong> {form.contract_unit_number || form.unit_number || "-"}
          </div>
          <div>
            <strong>Buyer(s):</strong> {form.buyers_combined || form.buyer_name || "-"}
          </div>
        </div>
      )}

      {/* --- Original tracking form --- */}
      <form onSubmit={handleSubmit} className="app-form">
        <h3>Sales Tracking Form</h3>

        <FormSection>
          <label>
            Status
            <select name="status" value={form.status || ""} onChange={handleChange}>
              <option value="">--Select--</option>
              <option value="pending">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="contract_sent">Sales Contract Sent</option>
            </select>
          </label>
        </FormSection>

        <FormSection>
          <h3>Key Dates</h3>
          {DATE_FIELDS.map((field) => (
            <label key={field}>
              {field.replace(/_/g, " ")}
              <input
                type="date"
                name={field}
                value={form[field] || ""}
                onChange={handleChange}
              />
            </label>
          ))}
        </FormSection>

        <FormSection>
          <h3>Financials</h3>
          {[
            "final_price",
            "list_price",
            "initial_deposit_amount",
            "seller_credit",
            "upgrade_credit",
            "total_upgrades_solar",
            "hoa_credit",
            "total_credits",
          ].map((field) => (
            <label key={field}>
              {field.replace(/_/g, " ")} ($)
              <input
                type="number"
                name={field}
                value={form[field] ?? ""}
                onChange={handleChange}
                step="1"
                min="0"
                inputMode="numeric"
              />
              {form[field] && (
                <small style={{ color: "#555" }}>{formatCurrency(form[field])}</small>
              )}
            </label>
          ))}
        </FormSection>

        <FormSection>
          <h3>DocuSign (manual)</h3>
          <label>
            docusign envelope
            <input type="text" name="docusign_envelope" value={form.docusign_envelope || ""} onChange={handleChange} />
          </label>
        </FormSection>

        <FormSection>
          <label>
            Add Notes
            <textarea
              name="notes"
              value={form.notes || ""}
              onChange={handleChange}
            />
          </label>
        </FormSection>

        <button type="submit">Save Tracking</button>
      </form>
    </div>
  );
}
// <<< copypasta ends here
