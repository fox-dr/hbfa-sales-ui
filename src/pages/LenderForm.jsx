import React from "react";
import FormField from "./FormField";

const lenderFields = [
  { name: "lender", type: "txt" },
  { name: "loan_officer", type: "txt" },
  { name: "brokerage", type: "txt" },
  { name: "broker_name", type: "txt" },
  { name: "broker_email", type: "txt" },
  { name: "escrow_number", type: "txt" },
  { name: "offer_notes_1", type: "txt" },
];

export default function LenderBrokerForm({ data, onChange }) {
  return (
    <fieldset className="p-4 border rounded">
      <legend className="font-bold">Lender / Title / Broker Information</legend>
      {lenderFields.map(({ name, type }) => (
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
