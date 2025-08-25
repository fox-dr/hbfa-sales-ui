import React from "react";

export default function FormField({ field, value, onChange, type }) {
  const label = field.replace(/_/g, " ");

  switch (type) {
    case "da": // Date picker
      return (
        <label className="block mb-2">
          {label}
          <input
            type="date"
            value={value || ""}
            onChange={(e) => onChange(field, e.target.value)}
            className="w-full border px-2 py-1"
          />
        </label>
      );

    case "cur": // Currency (number with decimals)
      return (
        <label className="block mb-2">
          {label}
          <input
            type="number"
            step="0.01"
            value={value || ""}
            onChange={(e) => onChange(field, e.target.value)}
            className="w-full border px-2 py-1 text-right"
          />
        </label>
      );

    case "boo": // Boolean (checkbox)
      return (
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(field, e.target.checked)}
          />
          {label}
        </label>
      );

    case "memo": // Long text / notes
      return (
        <label className="block mb-2">
          {label}
          <textarea
            value={value || ""}
            onChange={(e) => onChange(field, e.target.value)}
            className="w-full border px-2 py-1"
          />
        </label>
      );

    case "cal": // Calculated (read-only)
      return (
        <label className="block mb-2">
          {label}
          <input
            type="text"
            value={value || ""}
            readOnly
            className="w-full border px-2 py-1 bg-gray-100 text-gray-600"
          />
        </label>
      );

    default: // txt, long, FK, auto → plain text
      return (
        <label className="block mb-2">
          {label}
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(field, e.target.value)}
            className="w-full border px-2 py-1"
          />
        </label>
      );
  }
}
