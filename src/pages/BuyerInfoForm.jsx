import React from "react";
import FormField from "./FormField";

const buyerFields = [
  { name: "buyer_name", type: "txt" },
  { name: "buyer_notes", type: "txt" },
  { name: "email_1", type: "txt" },
  { name: "email_2", type: "txt" },
  { name: "email_3", type: "txt" },
  { name: "phone_number_1", type: "txt" },
  { name: "phone_number_2", type: "txt" },
  { name: "phone_number_3", type: "txt" },
  { name: "buyer_1_full_name", type: "txt" },
  { name: "buyer_2_full_name", type: "txt" },
];

export default function BuyerInfoForm({ data, onChange }) {
  return (
    <fieldset className="p-4 border rounded">
      <legend className="font-bold">Buyer Information</legend>
      {buyerFields.map(({ name, type }) => (
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
