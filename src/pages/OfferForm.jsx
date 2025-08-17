// src/pages/OfferForm.jsx rev for mobile
import { useRef, useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import "./offer-form.css";

const PROXY_BASE = "/.netlify/functions/proxy-units";
const PROJECT_ID = "Fusion";



export default function OfferForm() {
  const auth = useAuth();
  const jwt = auth?.user?.id_token || auth?.user?.access_token || null;

  // form bits
  const [unitNumber, setUnitNumber] = useState("");
  const [msg, setMsg] = useState("");

  // home details
  const [buildingInfo, setBuildingInfo] = useState("");
  const [planInfo, setPlanInfo] = useState("");
  const [addressInfo, setAddressInfo] = useState("");
  const pdfBtnRef = useRef(null);

  const formRef = useRef(null);

  const headers = jwt
    ? { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  function applyHomeDetails(obj = {}) {
    const b =
      obj.building_info ||
      (obj.building_id ? `Building ${obj.building_id}, Unit ${obj.unit_number ?? ""}` : "") ||
      "";
    const p = obj.plan_info || obj.plan_type || "";
    const a = obj.address || "";

    setBuildingInfo(b);
    setPlanInfo(p);
    setAddressInfo(a);

    const pdf = obj.pdf_url || obj.floorplan_url || "";
    if (pdfBtnRef.current) {
      if (pdf) {
        pdfBtnRef.current.disabled = false;
        pdfBtnRef.current.onclick = () => window.open(pdf, "_blank");
      } else {
        pdfBtnRef.current.disabled = true;
        pdfBtnRef.current.onclick = null;
      }
    }
  }

  async function handleSelectUnit() {
    setMsg("");
    const n = unitNumber.trim();
    if (!n) return setMsg("Enter a unit number.");
    if (!jwt) return setMsg("Please sign in again (missing token).");

    try {
      const upstreamPath = `/projects/${encodeURIComponent(PROJECT_ID)}/units`;
      const url = `${PROXY_BASE}?path=${encodeURIComponent(upstreamPath)}`;

      const res = await fetch(url, { headers, cache: "no-store" });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status} ${t}`);
      }

      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      const found = items.find((u) => String(u.unit_number) === String(n));

      if (found) {
        applyHomeDetails(found);
      } else {
        setMsg(`Unit ${n} not found.`);
      }
    } catch (e) {
      setMsg(`Error fetching unit: ${String(e.message || e)}`);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");

    try {
      const formData = new FormData(e.currentTarget);
      const body = Object.fromEntries(formData.entries());

      const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent("/offers")}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

      setMsg("Offer submitted successfully.");
      // e.currentTarget.reset(); // optional
    } catch (err) {
      setMsg(`Submit error: ${String(err.message || err)}`);
    }
  }

function handlePrintPDF() {
  if (!formRef.current) return;

  const fd = new FormData(formRef.current);
  const v = Object.fromEntries(fd.entries());

  // grab readonly “Home Details” from state
  const bldg = buildingInfo;
  const plan = planInfo;
  const addr = addressInfo;

  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const yesNo = (val) => (val ? "Yes" : "No");

  // Normalize checkbox value (present => "on")
  const cash = v.cash_purchase ? "Yes" : "No";

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Offer (Print Preview)</title>
<style>
  @page { size: Letter portrait; margin: 0.75in; }
  body { font-family: Lato, Arial, sans-serif; color:#111; }
  h2 { margin: 0 0 12px; }
  .section { border:1px solid #ddd; border-radius:8px; padding:14px; margin:12px 0; }
  .legend { margin:0 0 8px; font-size:1.05rem; font-weight:700; }
  .kv { list-style:none; padding:0; margin:0; display:grid; grid-template-columns: 1fr 1fr; gap:8px 20px; }
  .kv li { break-inside: avoid; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .notes { white-space: pre-wrap; }
  .sig { margin-top: 6px; }
  .sig-row { display:flex; align-items:flex-end; gap:10px; margin-top:24px; }
  .sig-row .label { white-space:nowrap; }
  .sig-row .line { border-bottom:1px solid #000; height:18px; flex:1; }
  .sig-row .line.short { flex: 0 0 170px; }
  .footer { margin-top: 10px; text-align:center; }
  .small { font-size: 0.9rem; color:#444; }
  .disclaimer { font-size:0.9rem; color:#444; }
  /* make single-column if the printer squeezes width */
  @media print {
    .kv { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 700px) {
    .kv { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
  <h2>Preliminary Offer Summary</h2>

  <div class="section">
    <div class="legend">Buyer Contact Information</div>
    <ul class="kv">
      <li><strong>Name:</strong> ${esc(v.buyer_name)}</li>
      <li><strong>Unit #:</strong> ${esc(String(unitNumber))}</li>
      <li><strong>Street:</strong> ${esc(v.address_1)}</li>
      <li><strong>Suite/Apt/PO Box:</strong> ${esc(v.address_2)}</li>
      <li><strong>City:</strong> ${esc(v.city)}</li>
      <li><strong>State:</strong> ${esc(v.state)}</li>
      <li><strong>Zip:</strong> ${esc(v.zip_code)}</li>
      <li><strong>Phone 1:</strong> ${esc(v.phone_number_1)}</li>
      <li><strong>Phone 2:</strong> ${esc(v.phone_number_2)}</li>
      <li><strong>Phone 3:</strong> ${esc(v.phone_number_3)}</li>
      <li><strong>Email 1:</strong> ${esc(v.email_1)}</li>
      <li><strong>Email 2:</strong> ${esc(v.email_2)}</li>
      <li><strong>Email 3:</strong> ${esc(v.email_3)}</li>
    </ul>
    <div class="notes"><strong>Buyer Notes:</strong><br>${esc(v.buyer_notes)}</div>
  </div>

  <div class="section">
    <div class="legend">Offer Information</div>
    <ul class="kv">
      <li><strong>Lender:</strong> ${esc(v.lender)}</li>
      <li><strong>Loan Officer:</strong> ${esc(v.loan_officer)}</li>
      <li><strong>Loan Officer Email:</strong> ${esc(v.l_o_contact_email)}</li>
      <li><strong>Loan Officer Phone:</strong> ${esc(v.l_o_phone)}</li>
      <li><strong>Broker Name:</strong> ${esc(v.broker_name)}</li>
      <li><strong>Brokerage:</strong> ${esc(v.brokerage)}</li>
      <li><strong>Broker Email:</strong> ${esc(v.broker_email)}</li>
      <li><strong>Broker Phone:</strong> ${esc(v.broker_phone)}</li>
      <li><strong>Cash Purchase?</strong> ${cash}</li>
      <li><strong>Price:</strong> ${esc(v.price)}</li>
      <li><strong>Purchase Type:</strong> ${esc(v.purchase_type)}</li>
    </ul>
    <div class="notes"><strong>Qualification/Lender Notes:</strong><br>${esc(v.offer_notes_1)}</div>
  </div>

  <div class="section">
    <div class="legend">Home Details (From Fusion)</div>
    <ul class="kv">
      <li><strong>Building Info:</strong> ${esc(bldg)}</li>
      <li><strong>Plan Info:</strong> ${esc(plan)}</li>
      <li style="grid-column: 1 / -1;"><strong>Address:</strong> ${esc(addr)}</li>
    </ul>
  </div>

  <div class="section">
    <div class="legend">Additional Notes</div>
    <div class="notes">${esc(v.add_notes)}</div>
  </div>

  <div class="section">
    <div class="legend">Disclaimer</div>
    <div class="disclaimer">
      THIS IS NOT A CONTRACT. THE TERMS OF THIS PRELIMINARY OFFER ARE NON-BINDING. APPROVAL OF THIS PRELIMINARY OFFER BY SELLER SHALL ESTABLISH NO AGREEMENT BETWEEN THE PROSPECTIVE BUYER AND SELLER AND SHALL NOT CREATE ANY OBLIGATION ON THE PART OF SELLER TO SELL THE UNIT TO PROSPECTIVE BUYER. THE UNIT MAY BE WITHDRAWN FROM THE MARKET AT ANY TIME.
    </div>
  </div>

  <div class="section sig">
    <div class="sig-row">
      <span class="label">Signature</span><span class="line"></span>
      <span class="label">Date:</span><span class="line short"></span>
    </div>
    <div class="sig-row">
      <span class="label">Signature</span><span class="line"></span>
      <span class="label">Date:</span><span class="line short"></span>
    </div>
  </div>

  <div class="footer small">Generated from Offer Form</div>
  <script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 250); };</script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    alert("Pop-up blocked. Allow pop-ups to print the PDF.");
    return;
  }
  // clean up the blob URL after the new window has loaded
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  // // insert the actual unit number from state (safer than string templating inside the big HTML)
  // const withUnit = html.replace(
  //   "${esc(${/* unitNumber is state */''} String(${JSON.stringify('')}))}",
  //   esc(${/* insert JS to escape unitNumber safely */''} String(${JSON.stringify('')}))
  // );

  // const w = window.open("", "_blank");
  // if (!w) {
  //   alert("Pop-up blocked. Allow pop-ups to print the PDF.");
  //   return;
  // }
  // w.document.open();
  // // w.document.write(withUnit);
  // w.document.write(html);
  // w.document.close();
}


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
    <div id="offer" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={{ margin: 0 }}>Preliminary Offer</h2>
        <img src="/assets/fusion_logo.png" alt="Fusion Logo" style={{ height: 48 }} />
      </div>

      {/* Notice OR Form */}
      
        <form ref={formRef} onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Buyer Contact Information */}
          <section style={styles.section}>
            <h3 style={styles.legend}>Buyer Contact Information</h3>

            {/* Name + Unit */}
            <div style={{ ...styles.row, gridTemplateColumns: "2fr 140px 140px" }}>
              <label style={styles.col}>
                Name (As on Contract)
                <input name="buyer_name" maxLength={50} style={styles.input} />
              </label>

              <label style={styles.col}>
                Unit #
                <input
                  type="number"
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  style={{ ...styles.input, width: 120 }}
                />
              </label>

              <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                <button type="button" onClick={handleSelectUnit}>Select Unit</button>
              </div>
            </div>

            {/* Address 1 */}
            <div style={{ ...styles.row, gridTemplateColumns: "1fr" }}>
              <label style={styles.col}>
                Current Street Address *
                <input name="address_1" required style={styles.input} />
              </label>
            </div>

            {/* Address 2 */}
            <div style={{ ...styles.row, gridTemplateColumns: "1fr" }}>
              <label style={styles.col}>
                (Suite / Apt / PO Box)
                <input name="address_2" style={styles.input} />
              </label>
            </div>

            {/* City / State / Zip */}
            <div style={{ ...styles.row, gridTemplateColumns: "1fr 90px 140px" }}>
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

          {/* Home Details */}
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

          {/* Additional Notes */}
          <section style={styles.section}>
            <h3 style={styles.legend}>Additional Notes</h3>
            <textarea name="add_notes" rows={5} style={{ ...styles.textarea, width: "100%" }} />
          </section>

          {/* Disclaimer */}
          <section style={styles.section}>
            <h4 style={styles.legend}>Disclaimer</h4>
            <p style={{ margin: 0, color: "#444" }}>
              THIS IS NOT A CONTRACT. THE TERMS OF THIS PRELIMINARY OFFER ARE NON-BINDING. 
              APPROVAL OF THIS PRELIMINARY OFFER BY SELLER SHALL ESTABLISH NO AGREEMENT BETWEEN THE PROSPECTIVE 
              BUYER AND SELLER AND SHALL NOT CREATE ANY OBLIGATION ON THE PART OF SELLER TO SELL THE UNIT TO 
              PROSPECTIVE BUYER. THE UNIT MAY BE WITHDRAWN FROM THE MARKET AT ANY TIME.
            </p>
          </section>

          {/* PDF & Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={handlePrintPDF}>Print PDF (with signature)</button>
            <button type="submit">Submit Offer</button>
          </div>


          {msg && (
            <div style={{ marginTop: 10, color: msg.toLowerCase().includes("error") ? "crimson" : "green" }}>
              {msg}
            </div>
          )}
        </form>
      <footer style={styles.footer} aria-hidden="true">
        <img
          src="/assets/hbfa-logo.png"
          alt=""
          height={48}
          style={styles.footerLogo}
          loading="lazy"
          decoding="async"
        />
      </footer>
    </div>
  );
}

const styles = {
  container: { maxWidth: 1100, margin: "0 auto", padding: 16, fontFamily: "Lato, Arial, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  section: { background: "#fff", border: "1px solid #ddd", borderRadius: 8, padding: 16, marginTop: 16 },
  legend: { margin: 0, marginBottom: 12, fontWeight: 700, fontSize: "1.05rem" },
  row: { display: "grid", gap: 12, alignItems: "end" },
  col: { display: "flex", flexDirection: "column", minWidth: 0 },
  input: { padding: "10px", border: "1px solid #ccc", borderRadius: 6, fontSize: "1rem" },
  inputRO: { padding: "10px", border: "1px solid #eee", borderRadius: 6, fontSize: "1rem", background: "#f5f5f5" },
  textarea: { padding: "10px", border: "1px solid #ccc", borderRadius: 6, fontSize: "1rem", resize: "vertical" },
  notice: { padding: 16, background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 8, marginTop: 16 },
  footer: { marginTop: 24, display: "flex", justifyContent: "center" },
  footerLogo: { width: "auto" },
};
