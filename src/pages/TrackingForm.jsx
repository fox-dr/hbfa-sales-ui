// src/pages/TrackingForm.jsx- added searching
import React, { useState } from "react";
import AppHeader from "../components/AppHeader";
import FormSection from "../components/FormSection";
import "../styles/form.css";

export default function TrackingForm() {
  const [form, setForm] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Tracking form submitted:", form);
    alert("Tracking form submission logged to console (stub).");
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === "") return "";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(val);
  };

  // --- New search handling code ---
  const handleSearch = async (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    try {
  const res = await fetch(
   `https://lyj4zmurck.execute-api.us-east-2.amazonaws.com/prod/FusionUnitsApi_CreateOffer/tracking/search?query=${encodeURIComponent(q)}`
  );

      if (res.ok) {
        const json = await res.json();
        setSearchResults(json.results);
      }
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const selectResult = (item) => {
    setForm((prev) => ({
      ...prev,
      offerId: item.offerId,
      buyer_name: item.buyer_name,
      unit_number: item.unit_number,
      status: item.status,
      // your other fields are preserved
    }));
    setSearchResults([]);
  };

  return (
    <div>
      {/* --- New: Search UI at the top --- */}
      <form onSubmit={handleSearch} className="app-form" style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Search by buyer or unit"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit">Lookup</button>
      </form>

      {searchResults.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginBottom: "1rem" }}>
          {searchResults.map((item) => (
            <li
              key={item.offerId}
              style={{ cursor: "pointer", padding: "0.5rem 0" }}
              onClick={() => selectResult(item)}
            >
              <strong>{item.offerId}</strong> — {item.buyer_name} — {item.unit_number}
            </li>
          ))}
        </ul>
      )}

        {/* Show loading */}
        {isLoading && <p>Searching…</p>}

        {/* Show error */}
        {error && <p style={{ color: 'red' }}>{error}</p>}

        {/* Show results */}
        {!isLoading && !error && searchResults.length > 0 && (
        <ul>…</ul>
        )}

        {/* Handle empty state only *after* search */}
        {!isLoading && !error && hasSearched && searchResults.length === 0 && (
        <p>No results found for "{searchQuery}". Try another search.</p>
        )}


      {/* --- Your original form exactly as is --- */}
      <form onSubmit={handleSubmit} className="app-form">
        <img src="/assets/hbfa-logo.png" alt="HBFA Logo" />
        <h3>Sales Tracking Form</h3>

        <FormSection>
          <label>
            Status
            <select name="status" onChange={handleChange}>
              {/* options... */}
            </select>
          </label>
        </FormSection>

        <FormSection>
          <h3>Key Dates</h3>
          {[
            "contract_sent_date",
            "fully_executed_date",
            "week_ratified_date",
            "initial_deposit_receipt_date",
            "financing_contingency_date",
            "loan_app_complete",
            "loan_approved",
            "loan_lock",
            "appraisal_ordered",
            "appraiser_visit_date",
            "appraisal_complete",
            "loan_fund",
            "loan_docs_ordered",
            "loan_docs_signed",
            "projected_closing_date",
            "adjusted_coe",
            "walk_through_date",
            "buyer_walk",
            "notice_to_close",
            "coe_date",
            "buyer_complete",
          ].map((field) => (
            <label key={field}>
              {field.replace(/_/g, " -")}
              <input type="date" name={field} onChange={handleChange} />
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
                value={form[field] || ""}
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
          <label>
            Add Notes
            <textarea name="add_notes" onChange={handleChange} />
          </label>
        </FormSection>

        <button type="submit">Save Tracking</button>

        <footer>{/* optional logo or footer */}</footer>
      </form>
    </div>
  );
}
