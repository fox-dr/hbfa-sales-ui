// src/pages/OfferForm.jsx rev for mobile
import { useRef, useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import "./offer-form.css";

const PROXY_BASE = "/.netlify/functions/proxy-units";
const PROJECT_ID = "Fusion";

function unformatUSD(val) {
  const s = String(val ?? "").replace(/[^\d.-]/g, "");
  return s === "" || s === "-" || s === "." || s === "-." ? "" : s;
}
function formatUSD(val) {
  const raw = unformatUSD(val);     // <-- normalize "$10,000.00" -> "10000.00"
  if (raw === "") return "";
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}



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
  // price bits
  const [price, setPrice] = useState("");

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

 // async function handleSendForSignature(e) {
 async function handleSubmit(e) {
  e.preventDefault();
  setMsg("");

  try {
    const formData = new FormData(e.currentTarget);
    const v = Object.fromEntries(formData.entries());
    v.project_id = PROJECT_ID;
    // v.price = unformatUSD(price || v.price);

//     // --- PDF HTML generation (copied from handlePrintPDF) ---
//     const priceInput = formRef.current?.elements?.price;
//     const pRaw = (price !== undefined && price !== "")
//       ? price
//       : (v.price ?? "") || (priceInput?.value ?? "");
//     const priceFmt = formatUSD(pRaw);

//     const bldg = buildingInfo;
//     const plan = planInfo;
//     const addr = addressInfo;

//     const esc = (s = "") =>
//       String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

//     const yesNo = (val) => (val ? "Yes" : "No");
//     const cash = v.cash_purchase ? "Yes" : "No";
//     const ORIGIN = window.location.origin;

//     const pdfHtml = `<!DOCTYPE html>
// <html>
// <head>
// <meta charset="utf-8">
// <base href="${ORIGIN}/">
// <title>Preliminary Offer Form HBFA Fusion Rev.1</title>
// <style>
//   /* Page */
//   @page { size: Letter portrait; margin: 0.75in; }

//   /* Base */
//   body { font-family: Lato, Arial, sans-serif; color:#111; }
//   h2 { margin: 0 0 12px; }

//   /* Title + logos */
//   .titlebar {
//     display: flex;
//     align-items: center;
//     justify-content: space-between;
//     gap: 12px;
//     margin: 0 0 12px;
//     break-inside: avoid;
//     page-break-inside: avoid;
//   }
//   .titlebar h2 { margin: 0; }
//   .titlebar img { height: 36px; width: auto; display: block; }
//   .logos { display: flex; align-items: center; gap: 10px; }

//   /* Sections */
//   .section { border: 1px solid #ddd; border-radius: 8px; padding: 14px; margin: 12px 0; }
//   .legend  { margin: 0 0 8px; font-size: 1.05rem; font-weight: 700; }

//   /* Key/Value grid */
//   .kv {
//     list-style: none;
//     padding: 0;
//     margin: 0;
//     display: grid;
//     grid-template-columns: 1fr 1fr;
//     gap: 6px 16px; /* row gap, column gap */
//   }
//   .kv li {
//     display: grid;
//     grid-template-columns: max-content 1fr;
//     column-gap: 8px;
//     align-items: baseline;
//     break-inside: avoid;
//     page-break-inside: avoid;
//   }
//   .kv .label { font-size: 0.9rem; font-weight: 600; color: #555; white-space: nowrap; }
//   .kv .value { font-size: 1rem; font-weight: 400; }

//   /* Misc */
//   .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
//   .notes { white-space: pre-wrap; }
//   .sig   { margin-top: 6px; }
//   .sig-row { display: flex; align-items: flex-end; gap: 10px; margin-top: 24px; }
//   .sig-row .label { white-space: nowrap; }
//   .sig-row .line { border-bottom: 1px solid #000; height: 18px; flex: 1; }
//   .sig-row .line.short { flex: 0 0 170px; }
//   .footer { margin-top: 10px; text-align: center; }
//   .small { font-size: 0.9rem; color: #444; }
//   .disclaimer { font-size: 0.9rem; color: #444; }
  
//   /* Print */
//   @media print {
//     -webkit-print-color-adjust: exact;
//     print-color-adjust: exact;

//     .kv { grid-template-columns: 1fr 1fr; }
//     .section { break-inside: avoid; page-break-inside: avoid; }

//     /* If you want to avoid Lato when printing, uncomment:
//     body { font-family: Arial, Helvetica, sans-serif; } */
//   }

//   /* Narrow viewport (if someone previews on-screen) */
//   @media (max-width: 700px) {
//     .kv { grid-template-columns: 1fr; }
//   }
// </style>

// </head>
// <body>
//   <div class="titlebar">
//   <h2>Preliminary Offer Summary</h2>
//   <div class="logos">
//     <img src="/assets/fusion_logo.png" alt="Fusion" />
//     <img src="/assets/hbfa-logo.png" alt="HBFA" />
//   </div>
// </div>


//   <div class="section">
//     <div class="legend">Buyer Contact Information</div>
//     <ul class="kv">
//       <li><span class="label">Name:</span> <span class="value"> ${esc(v.buyer_name)}</span></li>
//       <li><span class="label">Unit #:</span> <span class="value"> ${esc(String(unitNumber))}</span></li>
//       <li><span class="label">Street:</span> <span class="value"> ${esc(v.address_1)}</span></li>
//       <li><span class="label">Suite/Apt/PO Box:</span> <span class="value"> ${esc(v.address_2)}</span></li>
//       <li><span class="label">City:</span> <span class="value"> ${esc(v.city)}</span></li>
//       <li><span class="label">State:</span> <span class="value"> ${esc(v.state)}</span></li>
//       <li><span class="label">Zip:</span> <span class="value">  ${esc(v.zip_code)}</span></li>
//       <li><span class="label">Phone 1:</span> <span class="value"> ${esc(v.phone_number_1)}</span></li>
//       <li><span class="label">Phone 2:</span> <span class="value"> ${esc(v.phone_number_2)}</span></li>
//       <li><span class="label">Phone 3:</span> <span class="value"> ${esc(v.phone_number_3)}</span></li>
//       <li><span class="label">Email 1:</span> <span class="value"> ${esc(v.email_1)}</span></li>
//       <li><span class="label">Email 2:</span> <span class="value"> ${esc(v.email_2)}</span></li>
//       <li><span class="label">Email 3:</span> <span class="value"> ${esc(v.email_3)}</span></li>
//     </ul>
//     <div class="notes"><strong>Buyer Notes:</strong><br>${esc(v.buyer_notes)}</div>
//   </div>

//   <div class="section">
//     <div class="legend">Offer Information</div>
//     <ul class="kv">
//       <li><span class="label">Lender:</span> <span class="value"> ${esc(v.lender)}</span></li>
//       <li><span class="label">Loan Officer:</span> <span class="value"> ${esc(v.loan_officer)}</span></li>
//       <li><span class="label">Loan Officer Email:</span> <span class="value"> ${esc(v.l_o_contact_email)}</span></li>
//       <li><span class="label">Loan Officer Phone:</span> <span class="value"> ${esc(v.l_o_phone)}</span></li>
//       <li><span class="label">Broker Name:</span> <span class="value"> ${esc(v.broker_name)}</span></li>
//       <li><span class="label">Brokerage:</span> <span class="value"> ${esc(v.brokerage)}</span></li>
//       <li><span class="label">Broker Email:</span> <span class="value"> ${esc(v.broker_email)}</span></li>
//       <li><span class="label">Broker Phone:</span> <span class="value"> ${esc(v.broker_phone)}</span></li>
//       <li><span class="label">Cash Purchase?</span> <span class="value"> ${cash}</span></li>
//       <li><span class="label">Price:</span> <span class="value"> ${esc(priceFmt)}</span></li>
//       <li><span class="label">Purchase Type:</span> <span class="value"> ${esc(v.purchase_type)}</span></li>
//     </ul>
//     <div class="notes"><strong>Qualification/Lender Notes:</strong><br>${esc(v.offer_notes_1)}</div>
//   </div>

//   <div class="section">
//     <div class="legend">Home Details (From Fusion)</div>
//     <ul class="kv">
//       <li><span class="label">Building Info:</span> <span class="value"> ${esc(bldg)}</span></li>
//       <li><span class="label">Plan Info:</span> <span class="value"> ${esc(plan)}</span></li>
//       <li style="grid-column: 1 / -1;"><strong>Address:</strong> ${esc(addr)}</li>
//     </ul>
//   </div>

//   <div class="section">
//     <div class="legend">Additional Notes</div>
//     <div class="notes">${esc(v.add_notes)}</div>
//   </div>

//   <div class="section">
//     <div class="legend">Disclaimer</div>
//     <div class="disclaimer">
//       THIS IS NOT A CONTRACT. THE TERMS OF THIS PRELIMINARY OFFER ARE NON-BINDING. APPROVAL OF THIS PRELIMINARY OFFER BY SELLER SHALL ESTABLISH NO AGREEMENT BETWEEN THE PROSPECTIVE BUYER AND SELLER AND SHALL NOT CREATE ANY OBLIGATION ON THE PART OF SELLER TO SELL THE UNIT TO PROSPECTIVE BUYER. THE UNIT MAY BE WITHDRAWN FROM THE MARKET AT ANY TIME.
//     </div>
//   </div>

//   <div class="section sig">
//     <div class="sig-row">
//       <span class="label">Signature</span><span class="line"></span>
//       <span style="font-size:0; color:#fff;">/sig1/</span>
//       <span class="label">Date:</span><span class="line short"></span>
//       <span style="font-size:0; color:#fff;">/date1/</span>
//     </div>
//     <div class="sig-row">
//       <span class="label">Signature</span><span class="line"></span>
//       <span style="font-size:0; color:#fff;">/sig2/</span>
//       <span class="label">Date:</span><span class="line short"></span>
//       <span style="font-size:0; color:#fff;">/date2/</span>
//     </div>
//   </div>

//   <div class="footer small">Generated from Offer Form</div>
//   <script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 250); };</script>
// </body>
// </html>`;

//     // --- End PDF HTML generation ---  
        // --- Send offer data and PDF HTML to backend ---
    // const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent("/send-for-signature")}`, {
    //   method: "POST",
    //   headers,
    //   body: JSON.stringify({ offer: v, pdfHtml }),
    // });


      v.price = unformatUSD(price || v.price);

      // Call the API route that saves the offer
      const res = await fetch(`${PROXY_BASE}?path=${encodeURIComponent("/offer")}`, {
        method: "POST",
        headers,
        body: JSON.stringify(v),
      });

    const text = await res.text();
    if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

   //  setMsg("Offer submitted and sent for signature successfully.");
    setMsg("Offer saved successfully.");
    // formRef.current.reset(); // optional
  } catch (err) {
    setMsg(`Submit error: ${String(err.message || err)}`);
  }
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

  useEffect(() => {
  const node = formRef.current?.elements?.price; // name="price"
  
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
                  name="unit_number"
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
              <label style={styles.col}>
                Price
                <input
                  type="text"                 // show $1,234.56 in-field
                  name="price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}              // let them type
                  onFocus={(e) => setPrice(e.target.value.replace(/[^\d.-]/g, ""))} // raw while editing
                  onBlur={(e) => setPrice(formatUSD(e.target.value))}     // format on blur
                  inputMode="decimal"
                  placeholder="$0.00"
                  style={styles.input}
                />
              </label>

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

          // Replace PDF & Submit buttons with a single button:
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="submit">
              Send for Signature
            </button>
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
  footerLogo: { width: "auto" }

};
