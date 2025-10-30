console.log("OfferForm mounted")
// src/pages/OfferForm.jsx rev for mobile
import { useRef, useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import "./offer-form.css";
import { v4 as uuidv4 } from "uuid";
import AppHeader from "../components/AppHeader";
import { generateOfferPdf } from "../api/client";


// --- Helper to parse JWT ---
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

// const PROXY_BASE = "/.netlify/functions/proxy-units";
const PROJECT_ID = "Fusion"; // single-project deployment requirement
const PROXY_BASE = import.meta.env.VITE_PROXY_BASE || "/.netlify/functions/proxy-units";


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

function formatPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) {
    const local = digits.slice(1);
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return String(value || "").trim();
}

function handlePhoneBlur(event) {
  const formatted = formatPhone(event.target.value);
  event.target.value = formatted;
}



export default function OfferForm() {
  const [unitNumber, setUnitNumber] = useState("");
  const auth = useAuth();
  const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
  const claims = jwt ? parseJwt(jwt) : {};
  const saEmail = claims.email || "";  // <-- logged-in Sales Agent email


  // form bits
  // const [unitNumber, setUnitNumber] = useState("");
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
    console.log("handleSelectUnit fired");
    setMsg("");
    const n = String(unitNumber || "").trim();

    if (!n) return setMsg("Enter a unit number.");
    if (!jwt) return setMsg("Please sign in again (missing token).");

    try {
      const upstreamPath = `/projects/${encodeURIComponent(PROJECT_ID)}/units`;
      const url = `${PROXY_BASE}?path=${encodeURIComponent(upstreamPath)}`;

      console.log("DEBUG: about to fetch", url, headers);

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

 // async function handleSubmit(e) {
 async function handleSubmit(e) {
  e.preventDefault();
  setMsg("");

  try {
    const formData = new FormData(e.currentTarget);
    const v = Object.fromEntries(formData.entries());
    v.project_id = PROJECT_ID;
    const unit = String(v.unit_number || unitNumber || "").trim();
    if (!unit) {
      throw new Error("Unit number required before sending for signature.");
    }
    v.unit_number = unit;
    v.contract_unit_number = unit;
    const rawPrice = unformatUSD(price || v.price);
    v.price = rawPrice;
    v.priceFmt = rawPrice ? formatUSD(rawPrice) : "";
    v.offer_id = uuidv4(); // add a unique offer ID

    const phoneFields = [
      "phone_number_1",
      "phone_number_2",
      "phone_number_3",
      "loan_officer_phone",
      "broker_phone",
    ];
    phoneFields.forEach((key) => {
      if (key in v) {
        v[key] = formatPhone(v[key]);
      }
    });

    const lenderNotes = (v.lender_notes || "").trim();
    v.lender_notes = lenderNotes;
    const offerNotes = (v.offer_notes_1 || "").trim();
    v.offer_notes_1 = offerNotes || lenderNotes;
    if (v.offer_notes_1 && !v["off er_notes_1"]) v["off er_notes_1"] = v.offer_notes_1;
    
    // add SA sender email from auth
    v.sa_email = saEmail;
    v.sa_name  = auth?.user?.profile?.name  || "";
    // default initial status
    if (!v.status) {
      v.status = "pending";
      v.status_date = new Date().toISOString();
    }
    // include derived unit details for template compatibility
    v.bldg = buildingInfo || v.bldg || "";
    v.plan = planInfo || v.plan || v.plan_type || "";
    v.addr = addressInfo || `${v.address_1 ?? ""} ${v.address_2 ?? ""}`.trim();
    // alias template typo
    if (v.offer_notes_1 && !v['off er_notes_1']) v['off er_notes_1'] = v.offer_notes_1;
    
        // Save offer to HBFA store via Netlify function (DDB + S3 vault)
    const saveRes = await fetch(`/.netlify/functions/offers`, {
      method: "POST",
      headers,
      body: JSON.stringify(v),
    });

    const text = await saveRes.text();
    if (!saveRes.ok) throw new Error(text || `HTTP ${saveRes.status}`);

    // Generate real PDF and download (also stored to S3)
    try {
      const blob = await generateOfferPdf(jwt, { ...v, offerId: v.offer_id, project_id: PROJECT_ID });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `offer-${v.offer_id}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg("Offer saved and PDF generated.");
    } catch (e) {
      setMsg(`Offer saved, PDF generation failed: ${e.message || e}`);
    }
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
      <AppHeader
        title="Preliminary Offer"
        logo={`/assets/${PROJECT_ID}_logo.png`}
      />


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
                  style={{ ...styles.input, width: 80 }}
                />
              </label>

              <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
                <button type="button" onClick={handleSelectUnit}>Select Unit</button>
                { /* <button type="button" onClick={() => alert("Clicked!")}>
                  Select Unit
                </button> */}
              </div>
              {msg && (
                <div style={{ alignSelf: "end", marginLeft: 8, color: msg.toLowerCase().includes("error") ? "crimson" : "green" }}>
                  {msg}
                </div>
              )}
            </div>
            {/* console.log("Fetch URL:", url);
            console.log("Forwarding to:", upstreamUrl); */}


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
                <input name="phone_number_1" maxLength={20} style={styles.input} onBlur={handlePhoneBlur} />
              </label>
              <label style={styles.col}>
                Phone Number 2
                <input name="phone_number_2" maxLength={20} style={styles.input} onBlur={handlePhoneBlur} />
              </label>
              <label style={styles.col}>
                Phone Number 3
                <input name="phone_number_3" maxLength={20} style={styles.input} onBlur={handlePhoneBlur} />
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
              <label style={styles.col}>Loan Officer Email<input type="email" name="loan_officer_email" maxLength={40} style={styles.input} /></label>
              <label style={styles.col}>Loan Officer Phone<input type="tel" name="loan_officer_phone" maxLength={20} style={styles.input} onBlur={handlePhoneBlur} /></label>
            </div>

            <div style={{ ...styles.row, gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
              <label style={styles.col}>Broker Name<input name="broker_name" style={styles.input} /></label>
              <label style={styles.col}>Brokerage<input name="brokerage" style={styles.input} /></label>
              <label style={styles.col}>Broker Email<input type="email" name="broker_email" maxLength={40} style={styles.input} /></label>
              <label style={styles.col}>Broker Phone<input type="tel" name="broker_phone" maxLength={20} style={styles.input} onBlur={handlePhoneBlur} /></label>
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
                <textarea name="lender_notes" rows={3} maxLength={512} style={styles.textarea} />
              </label>
            </div>
          </section>

          {/* Home Details */}
          <section style={styles.section}>
            <h3 style={styles.legend}>Home Details (From {PROJECT_ID})</h3>
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

          {/* Replace PDF & Submit buttons with a single button: */}
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

