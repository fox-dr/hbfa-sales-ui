// Routes Used by this page
// - GET `/.netlify/functions/tracking-search`: search offers by buyer/unit/id
// - GET `/.netlify/functions/offer-read`: non-PII details for selected offer (DDB)
// - GET `/.netlify/functions/offer-details`: PII details for selected offer (S3)
// - POST `/.netlify/functions/offers-approve?offerId=...`: approve/deny offer (writes VP decision)
import React, { useState } from "react";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";

export default function ApprovalsPage() {
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [offerDdb, setOfferDdb] = useState(null);
  const [offerPii, setOfferPii] = useState(null);
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function search(e) {
    e?.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
      if (!jwt) throw new Error("No JWT token available");
      const res = await fetch(`/.netlify/functions/tracking-search?query=${encodeURIComponent(query)}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (res.status === 403) throw new Error("User Action Not Authorized");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      setMsg(e.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function loadDetails(offerId) {
    try {
      const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
      if (!jwt) return;
      // Non-PII (DDB, condensed schema)
      const dRes = await fetch(`/.netlify/functions/offer-read?offerId=${encodeURIComponent(offerId)}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (dRes.ok) {
        const ddb = await dRes.json();
        setOfferDdb(ddb || null);
      } else {
        setOfferDdb(null);
      }
      // PII (S3)
      const pRes = await fetch(`/.netlify/functions/offer-details?offerId=${encodeURIComponent(offerId)}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (pRes.ok) {
        const pii = await pRes.json();
        setOfferPii(pii || null);
      } else {
        setOfferPii(null);
      }
    } catch {
      setOfferDdb(null);
      setOfferPii(null);
    }
  }

  function handleSelect(r) {
    setSelected(r);
    setNotes("");
    setMsg("");
    setOfferDdb(null);
    setOfferPii(null);
    loadDetails(r.offerId);
  }

  async function decide(approved) {
    try {
      const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
      if (!jwt) throw new Error("No JWT token available");
      if (!selected?.offerId) throw new Error("Select a record first");
      const res = await fetch(`/.netlify/functions/offers-approve?offerId=${encodeURIComponent(selected.offerId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ approved, vp_notes: notes }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) throw new Error("User Action Not Authorized");
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMsg(data?.message || (approved ? "Approved" : "Not approved"));
    } catch (e) {
      setMsg(e.message || "Decision failed");
    }
  }

  return (
    <div className="p-8">
      <AppHeader />
      <h3 className="text-xl font-bold mb-4">VP Approval</h3>

      <form onSubmit={search} style={{ marginBottom: 16 }}>
        <input
          placeholder="Search by buyer or unit"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        />
        <button type="submit" style={{ marginLeft: 8 }}>Search</button>
      </form>

      {loading && <div>Searching.</div>}
      {msg && <div style={{ color: msg.includes("fail") ? "crimson" : "green" }}>{msg}</div>}

      {results.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginBottom: 16 }}>
          {results.map((r) => (
            <li key={r.offerId} style={{ padding: "6px 0", cursor: "pointer" }} onClick={() => handleSelect(r)}>
              <strong>{r.offerId}</strong> — {r.buyer_name} — {r.unit_number}
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div style={{ borderTop: "1px solid #ddd", paddingTop: 12 }}>
          <div><strong>OfferId:</strong> {selected.offerId}</div>
          <div><strong>Buyer:</strong> {selected.buyer_name}</div>
          <div><strong>Unit:</strong> {selected.unit_number}</div>
          {/* Decision badge */}
          {(() => {
            const decision = offerDdb?.vp_decision || (offerDdb?.vp_approval_status === true ? "approved" : offerDdb?.vp_approval_status === false ? "denied" : null);
            const date = offerDdb?.vp_approval_date;
            const by = offerDdb?.vp_id;
            const isApproved = decision === "approved";
            const isDenied = decision === "denied";
            const label = isApproved ? "Approved" : isDenied ? "Not Approved" : "Pending Approval";
            const bg = isApproved ? "#e6ffed" : isDenied ? "#ffecec" : "#f2f2f2";
            const fg = isApproved ? "#0a7a2d" : isDenied ? "#b00020" : "#444";
            return (
              <div style={{ marginTop: 8 }}>
                <span style={{ background: bg, color: fg, padding: "4px 8px", borderRadius: 999, fontWeight: 600 }}>
                  {label}
                </span>
                {decision && (
                  <span style={{ marginLeft: 10, color: "#666" }}>
                    {date ? `on ${new Date(date).toLocaleString()}` : ""} {by ? `by ${by}` : ""}
                  </span>
                )}
              </div>
            );
          })()}
          {/* Summary block from DDB + S3 */}
          <div style={{ marginTop: 8, padding: 12, background: "#fafafa", border: "1px solid #eee", borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Offer Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <div><strong>Status:</strong> {offerDdb?.status || "—"}</div>
                <div><strong>Price:</strong> {offerDdb?.price || offerDdb?.final_price || "—"}</div>
                <div><strong>List Price:</strong> {offerDdb?.list_price || "—"}</div>
                <div><strong>Credits:</strong> {offerDdb?.total_credits || "—"}</div>
                <div><strong>COE:</strong> {offerDdb?.coe_date || offerDdb?.projected_closing_date || "—"}</div>
              </div>
              <div>
                <div><strong>Phones:</strong> {(offerPii?.phone_number_1 || "—")}</div>
                <div><strong>Emails:</strong> {(offerPii?.email_1 || "—")}</div>
                <div><strong>Address:</strong> {(offerPii?.address_1 || "")} {(offerPii?.address_2 || "")}</div>
                <div><strong>City/State/Zip:</strong> {(offerPii?.city || offerDdb?.city || "")} {(offerPii?.state || offerDdb?.state || "")} {(offerPii?.zip_code || offerDdb?.zip_code || "")}</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <textarea
              placeholder="Approval notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: "100%", maxWidth: 520 }}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <button onClick={() => decide(true)} style={{ marginRight: 8 }}>Approve</button>
            <button onClick={() => decide(false)}>Not Approve</button>
          </div>
        </div>
      )}
    </div>
  );
}
