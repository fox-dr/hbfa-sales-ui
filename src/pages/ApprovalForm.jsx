// src/pages/ApprovalForm.jsx
import { useRef, useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";
import hbfaLogo from "../assets/hbfa-logo.png";
import FormSection from "../components/FormSection";
import "../styles/form.css";

const PROJECT_ID = import.meta.env.VITE_DEFAULT_PROJECT_ID || "Fusion";

export default function ApprovalForm() {
  const [msg, setMsg] = useState("");
  const formRef = useRef(null);

  const auth = useAuth();
  const jwt = auth?.user?.id_token || auth?.user?.access_token || null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const v = Object.fromEntries(formData.entries());
    console.log("Approval form submitted:", v);
    setMsg("Approval form submission logged to console (stub).");
  };

  // Default auto-date = today
  const today = new Date().toISOString().split("T")[0];

  // favicon
  useEffect(() => {
    const href = "/assets/hbfa.ico";
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.type = "image/x-icon";
    link.href = href;
  }, []);

  return (
    <div className="app-form">
      <AppHeader title="Offer Approval" />

      <form ref={formRef} onSubmit={handleSubmit}>
        {/* Copy all the same sections from OfferForm here:
            Buyer Contact Information, Offer Information, Home Details, Additional Notes, Disclaimer */}
        <FormSection>
          <h2>Buyer Contact Information</h2>
          <label>
            Name (As on Contract)
            <input name="buyer_name" maxLength={50} />
          </label>

          <label>
            Unit #
            <input
              name="unit_number"
              type="number"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
            />
          </label>

          <div className="unit-group">
            <button type="button" onClick={handleSelectUnit}>
              Select Unit
            </button>
            {msg && <div>{msg}</div>}
          </div>

          <label>
            Current Street Address *
            <input name="address_1" required />
          </label>
          <label>
            (Suite / Apt / PO Box)
            <input name="address_2" />
          </label>
          <label>
            City * <input name="city" maxLength={55} required />
          </label>
          <label>
            State * <input name="state" maxLength={2} required />
          </label>
          <label>
            Zip Code * <input name="zip_code" maxLength={15} required />
          </label>

          <label>
            Phone Number 1 <input name="phone_number_1" maxLength={20} />
          </label>
          <label>
            Phone Number 2 <input name="phone_number_2" maxLength={20} />
          </label>
          <label>
            Phone Number 3 <input name="phone_number_3" maxLength={20} />
          </label>

          <label>
            Email 1 <input type="email" name="email_1" maxLength={40} />
          </label>
          <label>
            Email 2 <input type="email" name="email_2" maxLength={40} />
          </label>
          <label>
            Email 3 <input type="email" name="email_3" maxLength={40} />
          </label>

          <label>
            Buyer Notes
            <textarea name="buyer_notes" rows={4} maxLength={512} />
          </label>
        </FormSection>

        <FormSection>
          <h2>Offer Information</h2>
          <label>
            Lender Institution <input name="lender" />
          </label>
          <label>
            Loan Officer <input name="loan_officer" />
          </label>
          <label>
            Loan Officer Email
            <input type="email" name="loan_officer_email" maxLength={40} />
          </label>
          <label>
            Loan Officer Phone
            <input type="tel" name="loan_officer_phone" maxLength={20} />
          </label>

          <label>
            Broker Name <input name="broker_name" />
          </label>
          <label>
            Brokerage <input name="brokerage" />
          </label>
          <label>
            Broker Email <input type="email" name="broker_email" maxLength={40} />
          </label>
          <label>
            Broker Phone <input type="tel" name="broker_phone" maxLength={20} />
          </label>

          <label>
            <input type="checkbox" name="cash_purchase" /> Cash Purchase?
          </label>

          <label>
            Price
            <input
              type="text"
              name="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onFocus={(e) =>
                setPrice(e.target.value.replace(/[^\d.-]/g, ""))
              }
              onBlur={(e) => setPrice(formatUSD(e.target.value))}
              inputMode="decimal"
              placeholder="$0.00"
            />
          </label>

          <label>
            Purchase Type
            <select name="purchase_type">
              <option value="">Select...</option>
              <option value="personal_residence">Personal Residence</option>
              <option value="investment_property">Investment Property</option>
            </select>
          </label>

          <label>
            Qualification/Lender Notes
            <textarea name="offer_notes_1" rows={3} maxLength={512} />
          </label>
        </FormSection>

        <FormSection>
          <h2>Home Details (From {PROJECT_ID})</h2>
          <label>
            Building Info <input value={buildingInfo} readOnly />
          </label>
          <label>
            Plan Info <input value={planInfo} readOnly />
          </label>
          <label>
            Address <input value={addressInfo} readOnly />
          </label>
          <div>
            <button type="button" ref={pdfBtnRef} disabled>
              Open PDF
            </button>
          </div>
        </FormSection>

        <FormSection>
          <h2>Additional Notes</h2>
          <textarea name="add_notes" rows={5} />
        </FormSection>

        <FormSection>
          <h2>Disclaimer</h2>
          <p>
            THIS IS NOT A CONTRACT. THE TERMS OF THIS PRELIMINARY OFFER ARE
            NON-BINDING. APPROVAL OF THIS PRELIMINARY OFFER BY SELLER SHALL
            ESTABLISH NO AGREEMENT BETWEEN THE PROSPECTIVE BUYER AND SELLER
            AND SHALL NOT CREATE ANY OBLIGATION ON THE PART OF SELLER TO SELL
            THE UNIT TO PROSPECTIVE BUYER. THE UNIT MAY BE WITHDRAWN FROM THE
            MARKET AT ANY TIME.
          </p>
        </FormSection>

        {/* === Approval Section replaces "Send for Signature" === */}
        <FormSection>
          <h2>Approval</h2>

          <label>
            <input type="checkbox" name="approved" /> Approved
          </label>

          <label>
            Approval Date
            <input
              type="date"
              name="approval_date"
              defaultValue={today}
            />
          </label>

          <label>
            Approver Notes
            <textarea name="approval_notes" rows={3} />
          </label>
        </FormSection>

        <button type="submit">Save Approval</button>

        {msg && <div>{msg}</div>}

        <footer>
          <img src={hbfaLogo} alt="HBFA Logo" />
        </footer>
      </form>
    </div>
  );
}
