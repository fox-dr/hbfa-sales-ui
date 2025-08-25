import React from "react";
import FormField from "./FormField";

const milestoneFields = [
  { name: "status_numeric", type: "cal" },
  { name: "contract_sent_date", type: "da" },
  { name: "fully_executed_date", type: "da" },
  { name: "week_ratified_date", type: "da" },
  { name: "initial_deposit_receipt_date", type: "da" },
  { name: "financing_contingency_date", type: "da" },
  { name: "appraisal_ordered", type: "da" },
  { name: "appraiser_visit_date", type: "da" },
  { name: "appraisal_complete", type: "da" },
  { name: "loan_docs-ordered", type: "da" },
  { name: "loan_fund", type: "da" },
  { name: "loan_docs_signed", type: "da" },
  { name: "projected_closing_date", type: "da" },
  { name: "adjusted_coe", type: "da" },
  { name: "walk_through_date", type: "da" },
  { name: "buyer_walk", type: "da" },
  { name: "notice_to_close", type: "da" },
  { name: "coe_date", type: "da" },
  { name: "buyer_complete", type: "da" },
];

const statusOptions = [
  "Offer Received",
  "Ratified",
  "Appraisal Complete",
  "Loan Approval",
  "COE",
];

const statusMap = {
  "Offer Received": 1,
  "Ratified": 2,
  "Appraisal Complete": 3,
  "Loan Approval": 4,
  "COE": 5,
};

export default function MilestonesForm({ data, onChange }) {
  const handleStatusChange = (e) => {
    const newStatus = e.target.value;
    const newNumeric = statusMap[newStatus] || "";
    onChange("status", newStatus);
    onChange("status_numeric", newNumeric);
  };

  return (
    <fieldset className="p-4 border rounded">
      <legend className="font-bold">Transaction Milestones</legend>

      {/* Custom select for status */}
      <label className="block mb-2 font-medium">Status</label>
      <select
        value={data.status || ""}
        onChange={handleStatusChange}
        className="border p-2 rounded w-full mb-4"
      >
        <option value="">-- Select Status --</option>
        {statusOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      {/* Render all other milestone fields */}
      {milestoneFields.map(({ name, type }) => (
        <FormField
          key={name}
          field={name}
          type={type}
          value={data[name]}
          onChange={onChange}
        />
      ))}
    </fieldset>
  );
}
