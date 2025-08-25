import React, { useState, useEffect } from "react";
import BuyerInfoForm from "./BuyerInfoForm";
import ProjectUnitForm from "./ProjectUnitForm";
import PurchaseForm from "./PurchaseForm";
import LenderBrokerForm from "./LenderBrokerForm";
import MilestonesForm from "./MilestonesForm";

export default function SalesTrackingForm({ offerData }) {
  // Master state for all fields
  const [formData, setFormData] = useState({});

  // Load defaults from OfferForm.jsx (DynamoDB row)
  useEffect(() => {
    if (offerData) {
      setFormData((prev) => ({ ...prev, ...offerData }));
    }
  }, [offerData]);

  // Generic field updater
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Form submitted:", formData);
    // TODO: push back to S3/DDB
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Sales Tracking Form</h1>

      <BuyerInfoForm data={formData} onChange={handleChange} />
      <ProjectUnitForm data={formData} onChange={handleChange} />
      <PurchaseForm data={formData} onChange={handleChange} />
      <LenderBrokerForm data={formData} onChange={handleChange} />
      <MilestonesForm data={formData} onChange={handleChange} />

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </form>
  );
}
