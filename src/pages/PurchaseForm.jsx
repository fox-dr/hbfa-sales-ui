import React from "react";
import FormField from "./FormField";

const purchaseFields = [
  { name: "price", type: "cur" },
  { name: "purchase_type", type: "txt" },
  { name: "cash_purchase", type: "boo" },
  { name: "offer_notes_1", type: "memo" },
  { name: "add_notes", type: "txt" },
  { name: "coe_conditions", type: "boo" },
  { name: "deposits_received_to_date", type: "cur" },
  { name: "final_price", type: "cur" },
  { name: "list_price", type: "cur" },
  { name: "initial_deposit_amount", type: "cur" },
  { name: "initial_deposit_receipt_date", type: "da" },
  { name: "seller_credit", type: "cur" },
  { name: "upgrade_credit", type: "cur" },
  { name: "total_upgrades_solar", type: "cur" },
  { name: "hoa_credit", type: "cur" },
  { name: "total_credits", type: "cur" },
];

export default function PurchaseForm({ data, onChange }) {
  return (
    <fieldset className="p-4 border rounded">
      <legend className="font-bold">Purchase Information</legend>
      {purchaseFields.map(({ name, type }) => (
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
