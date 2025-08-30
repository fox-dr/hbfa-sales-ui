import React, { useState } from "react";
import AppHeader from "../components/AppHeader";



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
    <form onSubmit={handleSubmit} className="space-y-4">
      <h1 className="text-xl font-bold mb-4">Sales Tracking Form</h1>

      {/* Status dropdown */}
      <div>
        <label className="block">Status</label>
        <select
          name="status"
          onChange={handleChange}
          className="border p-2 rounded w-full"
        >
          <option value="">Select status</option>
          <option value="offer_approved">Offer Approved</option>
          <option value="contract_ratified">Contract Ratified</option>
          <option value="appraisal_received">Appraisal Received</option>
          <option value="buyer_walk">Buyer Walk</option>
          <option value="closed">Closed</option>
          <option value="buyer_fulfillment">Buyer Fulfillment</option>
          <option value="contract_canceled">Contract Canceled</option>
        </select>
      </div>

      {/* Date fields */}
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
        <div key={field}>
          <label className="block capitalize">{field.replace(/_/g, " ")}</label>
          <input
            type="date"
            name={field}
            onChange={handleChange}
            className="border p-2 rounded w-full"
          />
        </div>
      ))}

      {/* Currency fields */}
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
        <div key={field}>
          <label className="block capitalize">{field.replace(/_/g, " ")}</label>
          <input
            type="number"
            name={field}
            onChange={handleChange}
            className="border p-2 rounded w-full"
          />
        </div>
      ))}

      {/* Free text */}
      <div>
        <label className="block">Add Notes</label>
        <textarea
          name="add_notes"
          onChange={handleChange}
          className="border p-2 rounded w-full"
        />
      </div>

      <button
        type="submit"
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Save Tracking
      </button>
    </form>
  );
}
