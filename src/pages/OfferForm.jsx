// src/pages/OfferForm.jsx
import { useRef, useState } from "react";
import { useAuth } from "react-oidc-context";

const PROXY_BASE = "/.netlify/functions/proxy-units";

export default function OfferForm() {
  const auth = useAuth();
  const token = auth?.user?.access_token;

  const [unitNumber, setUnitNumber] = useState("");
  const [buildingInfo, setBuildingInfo] = useState("");
  const [planInfo, setPlanInfo] = useState("");
  const [addressInfo, setAddressInfo] = useState("");
  const [message, setMessage] = useState("");
  const pdfBtnRef = useRef(null);

  const headers = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  function setFields(obj = {}) {
    const b = obj.building_info || (obj.building_ID ? `Building ${obj.building_ID} / Unit ${obj.unit_number ?? ""}` : "");
    const p = obj.plan_info || obj.plan_type || "";
    const a = obj.address || obj.address_line || obj.addr || "";

    setBuildingInfo(b);
    setPlanInfo(p);
    setAddressInfo(a);

    if (pdfBtnRef.current) {
      if (obj.pdf_url || obj.floorplan_url) {
        const url = obj.pdf_url || obj.floorplan_url;
        pdfBtnRef.current.disabled = false;
        pdfBtnRef.current.onclick = () => window.open(url, "_blank");
      } else {
        pdfBtnRef.current.disabled = true;
        pdfBtnRef.current.onclick = null;
      }
    }
  }

  async function handleSelect() {
    setMessage("");
    if (!unitNumber.trim()) {
      setMessage("Enter a unit number.");
      return;
    }

    // Try v2 single lookup first
    try {
      const v2 = await fetch(
        `${PROXY_BASE}?path=${encodeURIComponent("/unit_info_v2")}&unit_number=${encodeURIComponent(unitNumber)}`,
        { headers, cache: "no-store" }
      );
      if (v2.ok) {
        const data = await v2.json();
        const record = Array.isArray(data) ? data[0] : data;
        if (record) {
          setFields(record);
          return;
        }
      }
    } catch { /* fall through */ }

    // Fallback: list by project
    try {
      const upstreamPath = `/projects/${encodeURIComponent("Fusion")}/units`;
      const url = `${PROXY_BASE}?path=${encodeURIComponent(upstreamPath)}&unit_number=${encodeURIComponent(unitNumber)}`;
      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const found = Array.isArray(data.items) ? data.items.find(u => String(u.unit_number) === String(unitNumber)) : null;
      if (found) setFields(found);
      else setMessage("Unit not found.");
    } catch (e) {
      setMessage(`Error fetching unit: ${e.message}`);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    try {
      const formData = new FormData(e.currentTarget);
      const body = Object.fromEntries(formData.entries());

      // POST to your offers endpoint through the proxy
      const res = await fetch(
        `${PROXY_BASE}?path=${encodeURIComponent("/offers")}`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      setMessage("Offer submitted successfully.");
    } catch (err) {
      setMessage(`Submit error: ${String(err.message || err)}`);
    }
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Please sign in</h2>
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Create Offer</h2>

      {/* Unit selector row */}
      <div style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 12 }}>
        <label style={{ display: "flex", flexDirection: "column" }}>
          Unit Number
          <input
            type="number"
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            placeholder="e.g., 10"
          />
        </label>
        <button type="button" onClick={handleSelect}>Select Unit</button>
        <button type="button" ref={pdfBtnRef} disabled>Open PDF</button>
      </div>

      {/* Auto-populated fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        <label>Building Info<input value={buildingInfo} readOnly /></label>
        <label>Plan Info<input value={planInfo} readOnly /></label>
        <label>Address<input value={addressInfo} readOnly /></label>
      </div>

      {/* Minimal version of the rest of your form; add more fields as needed */}
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <label>Name (As on Contract)<input name="buyer_name" maxLength={50} required /></label>
        <label>Current Street Address *<input name="address_1" required /></label>
        <label>(Suite / Apt / PO Box)<input name="address_2" /></label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px", gap: 8 }}>
          <label>City *<input name="city" maxLength={55} required /></label>
          <label>State *<input name="state" maxLength={2} required /></label>
          <label>Zip Code *<input name="zip_code" maxLength={15} required /></label>
        </div>

        {/* Example lender block */}
        <label>Lender Institution<input name="lender" /></label>
        <label>Loan Officer<input name="loan_officer" /></label>
        <label>Loan Officer Email<input type="email" name="l_o_contact_email" maxLength={40} /></label>
        <label>Loan Officer Phone<input type="tel" name="l_o_phone" maxLength={20} /></label>

        <label>Buyer Notes<textarea name="buyer_notes" rows={4} maxLength={512} /></label>

        <button type="submit">Submit Offer</button>
      </form>

      {message && <div style={{ marginTop: 12, color: message.includes("error") ? "crimson" : "green" }}>{message}</div>}
    </div>
  );
}
