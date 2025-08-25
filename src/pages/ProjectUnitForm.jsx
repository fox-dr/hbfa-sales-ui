import React from "react";
import FormField from "./FormField";

const projectFields = [
  { name: "id", type: "long" },
  { name: "project_name", type: "txt" },
  { name: "unit_number", type: "long" },
  { name: "unit_name", type: "txt" },
  { name: "plan_type", type: "txt" },
  { name: "lot_number", type: "txt" },
  { name: "unit_phase", type: "txt" },
];

export default function ProjectUnitForm({ data, onChange }) {
  return (
    <fieldset className="p-4 border rounded">
      <legend className="font-bold">Project & Unit Information</legend>
      {projectFields.map(({ name, type }) => (
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
