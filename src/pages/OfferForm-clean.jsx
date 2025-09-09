// src/pages/OfferForm-clean.jsx
import { useRef, useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { v4 as uuidv4 } from "uuid";
import AppHeader from "../components/AppHeader";
import FormSection from "../components/FormSection"; // new helper
import "../styles/form.css"; // shared styles

// --- Helper to parse JWT ---
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return {};
  }
}

const PROJECT_ID = import.meta.env.VITE_DEFAULT_PROJECT_ID || "Fusion";
const PROXY_BASE =
  import.meta.env.VITE_PROXY_BASE || "/.netlify/functions/proxy-units";

function unformatUSD(val) {
  const s = String(val ?? "").replace(/[^\d.-]/g, "");
  return s === "" || s === "-" || s === "." || s === "-." ? "" : s;
}
function formatUSD(val) {
  const raw = unformatUSD(val);
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

export default function OfferFormClean() {
  const [unitNumber, setUnitNumber] = useState("");
  const [msg, setMsg] = useState("");
  const [buildingInfo, setBuildingInfo] = useState("");
  const [planInfo, setPlanInfo] = useState("");
  const [addressInfo, setAddressInfo] = useState("");
  const [price, setPrice] = useState("");

  const pdfBtnRef = useRef(null);
  const formRef = useRef(null);

  const auth = useAuth();
  const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
  const claims = jwt ? parseJwt(jwt) : {};
  const saEmail = claims.email || "";

  const headers = jwt
    ? { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };

  function applyHomeDetails(obj = {}) {
    const b =
      obj.building_info ||
      (obj.building_id
        ? `Building ${obj.building_id}, Unit ${obj.unit_number ?? ""}`
        : "") ||
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
    const n = String(unitNumber || "").trim();
    if (!n) return setMsg("Enter a unit number.");
    if (!jwt) return setMsg("Please sign in again (missing token).");

    try {
      const upstreamPath = `/projects/${encodeURIComponent(
        PROJECT_ID
      )}/units`;
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
      const v = Object.fromEntries(formData.entries());
      v.project_id = PROJECT_ID;
      v.price = unformatUSD(price || v.price);
      v.offer_id = uuidv4();
      v.sa_email = saEmail;
      v.sa_name = auth?.user?.profile?.name || "";

      const API_BASE =
        "https://lyj4zmurck.execute-api.us-east-2.amazonaws.com/prod";

      // Send-for-signature
      const sigRes = await fetch(`${API_BASE}/offers`, {
        method: "POST",
        headers,
        body: JSON.stringify(v),
      });

      if (!sigRes.ok) {
        const errText = await sigRes.text();
        throw new Error(`Signature send failed: ${errText}`);
      }

      const sigText = await sigRes.text();
      const sigJson = JSON.parse(sigText);
      v.docusign_envelope_id = sigJson.envelopeId;

      // Save offer record
      const saveRes = await fetch(`${API_BASE}/offers`, {
        method: "POST",
        headers,
        body: JSON.stringify(v),
      });

      const text = await saveRes.text();
      if (!saveRes.ok) throw new Error(text || `HTTP ${saveRes.status}`);

      setMsg("Offer submitted and sent for signature successfully.");
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

  return (
    <div className="app-form">
      <AppHeader
        title="Preliminary Offer"
        logo={`/assets/${PROJECT_ID}_logo.png`}
      />

      <form ref={formRef} onSubmit={handleSubmit}>
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

        <button type="submit">Send for Signature</button>

        {msg && <div>{msg}</div>}

        <footer>
          <img src="/assets/hbfa_logo.png" alt="HBFA Logo" />
        </footer>
      </form>
    </div>
  );
}
