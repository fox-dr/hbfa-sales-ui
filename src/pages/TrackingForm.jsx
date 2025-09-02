{/* src/pages/TrackingForm.jsx */}
import React, { useState } from "react";
import AppHeader from "../components/AppHeader";
import FormSection from "../components/FormSection";
import "../styles/form.css";

export default function TrackingForm() {
  const [form, setForm] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Tracking form submitted:", form);
    alert("Tracking form submission logged to console (stub).");
  };

  return (
    <form onSubmit={handleSubmit} className="app-form">
      <img src="/assets/hbfa-logo.png" alt="HBFA Logo" />
      <h3>Sales Tracking Form </h3>
      {/* Status dropdown */}
      <FormSection>
        <label>
          Status
          <select name="status" onChange={handleChange}>
            <option value="">Select status</option>
            <option value="offer_approved">Offer Approved</option>
            <option value="contract_ratified">Contract Ratified</option>
            <option value="appraisal_received">Appraisal Received</option>
            <option value="buyer_walk">Buyer Walk</option>
            <option value="closed">Closed</option>
            <option value="buyer_fulfillment">Buyer Fulfillment</option>
            <option value="contract_canceled">Contract Canceled</option>
          </select>
        </label>
      </FormSection>

      {/* Date fields */}
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

      {/* Currency fields */}
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
          {field.replace(/_/g, " ")}
          <input type="number" name={field} onChange={handleChange} />
        </label>
      ))}
    </FormSection>


      {/* Free text */}
      <FormSection>
        <label>
          Add Notes
          <textarea name="add_notes" onChange={handleChange} />
        </label>
      </FormSection>

      <button type="submit">Save Tracking</button>

      {/* <footer>
        <img src="/assets/hbfa-logo.png" alt="HBFA Logo" />
      </footer>
    </form> */}
  );
}