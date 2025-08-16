// src/pages/OfferForm.jsx
import { useRef, useState } from "react";
import { useAuth } from "react-oidc-context";

// near the top of OfferForm()
const auth = useAuth();
const jwt = auth?.user?.id_token ?? auth?.user?.access_token;

const headers = jwt
  ? { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }
  : { "Content-Type": "application/json" };


const PROXY_BASE = "/.netlify/functions/proxy-units";
const PROJECT_ID = "Fusion"; // change later if needed

export default function OfferForm() {
  const auth = useAuth();
  const token = auth?.user?.access_token;

  // Home details (read-only)
  const [unitNumber, setUnitNumber] = useState("");
  const [buildingInfo, setBuildingInfo] = useState("");
  const [planInfo, setPlanInfo] = useState("");
  const [addressInfo, setAddressInfo] = useState("");
  const pdfBtnRef = useRef(null);

  const [msg, setMsg] = useState("");

  const headers = token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  function setFields(obj = {}) {
    const b =
      obj.building_info ||
      (obj.building_id ? `Building ${obj.building_id}, Unit ${obj.unit_number ?? ""}` : "");
    const p = obj.plan_info || obj.plan_type || "";
    const a = obj.address || obj.address_line || obj.addr || "";

    setBuildingInfo(b);
    setPlanInfo(p);
    setAddressInfo(a);

    if (pdfBtnRef.current) {
      const pdf = obj.pdf_url || obj.floorplan_url;
      if (pdf) {
        pdfBtnRef.current.disabled = false;
        pdfBtnRef.current.onclick = () => window.open(pdf, "_blank");
      } else {
        pdfBtnRef.current.disabled = true;
        pdfBtnRef.current.onclick = null;
      }
    }
     return <div style={{padding:16}}>Offer Form loaded ✅</div>;
  }

async function handleSelectUnit() {
  setMsg("");
  const n = unitNumber.trim();
  if (!n) { setMsg("Enter a unit number."); return; }
  if (!jwt) { setMsg("Please sign in again to fetch units."); return; }

  try {
    // fetch full list and filter client-side (avoids backend query quirks)
    const upstreamPath = `/projects/${encodeURIComponent("Fusion")}/units`;
    const url = `${PROXY_BASE}?path=${encodeURIComponent(upstreamPath)}`;
    const res = await fetch(url, { headers, cache: "no-store" });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${text}`);
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    const found = items.find(u => String(u.unit_number) === String(n));

    if (found) {
      setFields(found);
    } else {
      setMsg(`Unit ${n} not found.`);
    }
  } catch (e) {
    setMsg(`Error fetching unit: ${e.message}`);
  }
}



  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      const formData = new FormData(e.currentTarget);
      const body = Object.fromEntries(formData.entries());

      const res = await fetch(
        `${PROXY_BASE}?path=${encodeURIComponent("/offers")}`,
        { method: "POST", headers, body: JSON.stringify(body) }
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      setMsg("Offer submitted successfully.");
      e.currentTarget.reset();
    } catch (err) {
      setMsg(`Submit error: ${String(err.message || err)}`);
    }
  }

  if (!auth.isAuthenticated) {
    return (
      <div style={styles.container}>
        <h2>Sign in required</h2>
        <button onClick={() => auth.signinRedirect()}>Sign in</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header / Logout */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Create Offer</h1>
        <img src="/assets/fusion_logo.png" alt="Fusion Logo" style={{ height: 48 }} />
      </div>

      {/* Buyer Contact Information */}
      <section style={styles.section}>
        <h3 style={styles.legend}>Buyer Contact Information</h3>

        {/* Name + Unit row */}
        <div style={{ ...styles.row, gridTemplateColumns: "2fr 160px 140px" }}>
          <label style={styles.col}>
            Name (As on Contract)
            <input name="buyer_name" maxLength={50} style={styles.input} />
          </label>

          <label style={{ ...styles.col, alignSelf: "end" }}>
            Unit #
            <input
              type="number"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              style={{ ...styles.input, width: 100 }}
            />
          </label>

          <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
            <button type="button" onClick={handleSelectUnit}>Select Unit</button>
            <button type="button" ref={pdfBtnRef} disabled>Open PDF</button>
          </div>
        </div>

        {/* Address row 1 */}
        <div style={styles.row}>
          <label style={{ ...styles.col, gridColumn: "1 / -1" }}>
            Current Street Address *
            <input name="address_1" required style={{ ...styles.input, width: "100%" }} />
          </label>
        </div>

        {/* Address row 2 */}
        <div style={styles.row}>
          <label style={{ ...styles.col, gridColumn: "1 / -1" }}>
            (Suite / Apt / PO Box)
            <input name="address_2" style={{ ...styles.input, width: "100%" }} />
          </label>
        </div>

        {/* City / State / Zip */}
        <div style={{ ...styles.row, gridTemplateColumns: "1fr 100px 140px" }}>
          <label style={styles.col}>
            City *
            <input name="city" maxLength={55} required style={styles.input} />
          </label>
          <label style={styles.col}>
            State *
            <input name="state" maxLength={2} required style={{ ...styles.input, width: 70 }} />
          </label>
          <label style={styles.col}>
            Zip Code *
            <input name="zip_code" maxLength={15} required style={{ ...styles.input, width: 120 }} />
          </label>
        </div>

        {/* Phones */}
        <div style={{ ...styles.row, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label style={styles.col}>
            Phone Number 1
            <input name="phone_number_1" maxLength={20} style={styles.input} />
          </label>
          <label style={styles.col}>
            Phone Number 2
            <input name="phone_number_2" maxLength={20} style={styles.input} />
          </label>
          <label style={styles.col}>
            Phone Number 3
            <input name="phone_number_3" maxLength={20} style={styles.input} />
          </label>
        </div>

        {/* Emails */}
        <div style={{ ...styles.row, gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label style={styles.col}>
            Email 1
            <input type="email" name="email_1" maxLength={40} style={styles.input} />
          </label>
          <label style={styles.col}>
            Email 2
            <input type="email" name="email_2" maxLength={40} style={styles.input} />
          </label>
          <label style={styles.col}>
            Email 3
            <input type="email" name="email_3" maxLength={40} style={styles.input} />
          </label>
        </div>

        {/* Buyer notes */}
        <div style={{ ...styles.row, gridTemplateColumns: "1fr" }}>
          <label style={styles.col}>
            Buyer Notes
            <textarea name="buyer_notes" rows={4} maxLength={512} style={styles.textarea} />
          </label>
        </div>
      </section>

      {/* Offer Information */}
      <section style={styles.section}>
        <h3 style={styles.legend}>Offer Information</h3>

        <div style={{ ...styles.row, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <label style={styles.col}>Lender Institution<input name="lender" style={styles.input} /></label>
          <label style={styles.col}>Loan Officer<input name="loan_officer" style={styles.input} /></label>
          <label style={styles.col}>Loan Officer Email<input type="email" name="l_o_contact_email" maxLength={40} style={styles.input} /></label>
          <label style={styles.col}>Loan Officer Phone<input type="tel" name="l_o_phone" maxLength={20} style={styles.input} /></label>
        </div>

        <div style={{ ...styles.row, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <label style={styles.col}>Broker Name<input name="broker_name" style={styles.input} /></label>
          <label style={styles.col}>Brokerage<input name="brokerage" style={styles.input} /></label>
          <label style={styles.col}>Broker Email<input type="email" name="broker_email" maxLength={40} style={styles.input} /></label>
          <label style={styles.col}>Broker Phone<input type="tel" name="broker_phone" maxLength={20} style={styles.input} /></label>
        </div>

        <div style={{ ...styles.row, gridTemplateColumns: "auto 1fr 1fr" }}>
          <label style={{ ...styles.col, alignItems: "center", flexDirection: "row", gap: 8 }}>
            <input type="checkbox" name="cash_purchase" />
            Cash Purchase?
          </label>
          <label style={styles.col}>Price<input type="number" step="0.01" name="price" style={styles.input} /></label>
          <label style={styles.col}>
            Purchase Type
            <select name="purchase_type" style={styles.input}>
              <option value="">Select...</option>
              <option value="personal_residence">Personal Residence</option>
              <option value="investment_property">Investment Property</option>
            </select>
          </label>
        </div>

        <div style={{ ...styles.row, gridTemplateColumns: "1fr" }}>
          <label style={styles.col}>
            Qualification/Lender Notes
            <textarea name="offer_notes_1" rows={3} maxLength={512} style={styles.textarea} />
          </label>
        </div>
      </section>

      {/* Home Details (read-only) */}
      <section style={styles.section}>
        <h3 style={styles.legend}>Home Details (From Fusion)</h3>
        <div style={{ ...styles.row, gridTemplateColumns: "1fr 1fr 1fr auto" }}>
          <label style={styles.col}>Building Info<input value={buildingInfo} readOnly style={styles.inputRO} /></label>
          <label style={styles.col}>Plan Info<input value={planInfo} readOnly style={styles.inputRO} /></label>
          <label style={styles.col}>Address<input value={addressInfo} readOnly style={styles.inputRO} /></label>
          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" ref={pdfBtnRef} disabled>Open PDF</button>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section style={styles.section}>
        <h3 style={styles.legend}>Additional Notes</h3>
        <textarea name="add_notes" rows={5} style={{ ...styles.textarea, width: "100%" }} />
      </section>

      {/* Disclaimer */}
      <section style={styles.section}>
        <h3 style={styles.legend}>Disclaimer</h3>
        <p style={{ margin: 0, color: "#444" }}>
          THIS IS NOT A CONTRACT. THE TERMS OF THIS PRELIMINARY OFFER ARE NON-BINDING...
        </p>
      </section>

      {/* Submit */}
      <form onSubmit={handleSubmit} style={{ display: "flex", justifyContent: "flex-end" }}>
        <button type="submit">Submit Offer</button>
      </form>

      {/* Status */}
      {msg && (
        <div style={{ marginTop: 10, color: msg.toLowerCase().includes("error") ? "crimson" : "green" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "Lato, Arial, sans-serif" },
  section: { background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16 },
  legend: { margin: 0, marginBottom: 12, fontWeight: 700, fontSize: "1.05rem" },
  row: { display: "grid", gap: 12, alignItems: "end" },
  col: { display: "flex", flexDirection: "column", minWidth: 0 },
  input: { padding: "10px", border: "1px solid #ccc", borderRadius: 6, fontSize: "1rem" },
  inputRO: { padding: "10px", border: "1px solid #eee", borderRadius: 6, fontSize: "1rem", background: "#f5f5f5" },
  textarea: { padding: "10px", border: "1px solid #ccc", borderRadius: 6, fontSize: "1rem", resize: "vertical" },
};
