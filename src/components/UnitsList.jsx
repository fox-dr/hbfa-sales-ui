// UnitsList.jsx
import { useEffect, useState } from "react";

// Call the Netlify Function (same-origin) instead of AWS directly.
const PROXY_BASE = "/.netlify/functions/proxy-units";

export default function UnitsList({ token }) {
  const [projectId, setProjectId] = useState("Fusion");
  const [buildingId, setBuildingId] = useState("");
  const [planType, setPlanType] = useState("");       // plan_type
  const [unitNumber, setUnitNumber] = useState("");   // unit_number (API filter)
  const [unitQuery, setUnitQuery] = useState("");     // client-side contains filter
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selected, setSelected] = useState(null);

  async function load(overrides = {}) {
    const proj = overrides.projectId ?? projectId;
    const bldg = overrides.buildingId ?? buildingId;
    const plan = overrides.planType ?? planType;      // plan_type
    const unit = overrides.unitNumber ?? unitNumber;

    setLoading(true);
    setErr("");
    try {
      // Build the query string
      const qs = new URLSearchParams();
      if (bldg.trim()) qs.set("building_id", bldg.trim());
      if (plan.trim()) qs.set("plan_type", plan.trim());
      if (unit.trim()) qs.set("unit_number", unit.trim());

      // Upstream path to AWS API
      const upstreamPath = `/projects/${encodeURIComponent(proj)}/units`;
      const url =
        `${PROXY_BASE}?path=${encodeURIComponent(upstreamPath)}` +
        (qs.toString() ? `&${qs.toString()}` : "");

      // Only send Authorization header if we have a token
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const r = await fetch(url, { headers });

      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setRows(data.items || []);
      setSelected((data.items && data.items[0]) || null); // auto-select first result
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  // ...keep the rest of your component exactly as-is (onKeyDown, clearFilters, useEffect, render, etc.)


  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      load();
    }
  }

  function clearFilters() {
    setBuildingId("");
    setPlanType("");
    setUnitNumber("");
    setUnitQuery("");
    load({ buildingId: "", planType: "", unitNumber: "" });
  }

  useEffect(() => { load(); }, []);

  // client-side unit text filter
  const visible = rows.filter(r =>
    unitQuery ? String(r.unit_number || "").toLowerCase().includes(unitQuery.toLowerCase()) : true
  );

  // sort by unit number
  const sorted = [...visible].sort((a, b) => {
    const na = parseInt(a.unit_number, 10);
    const nb = parseInt(b.unit_number, 10);
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      return String(a.unit_number || "").localeCompare(String(b.unit_number || ""));
    }
    return na - nb;
  });

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h3>Units</h3>

      <form
        onSubmit={(e) => { e.preventDefault(); load(); }}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}
      >
        <input
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Project ID"
        />
        <input
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Building ID (e.g., Building 03)"
          autoFocus
        />
        <input
          value={planType}
          onChange={(e) => setPlanType(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Plan Type (e.g., Plan 1)"
        />
        <input
          value={unitNumber}
          onChange={(e) => setUnitNumber(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Unit # (e.g., 10)"
        />
        <input
          value={unitQuery}
          onChange={(e) => setUnitQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Unit contains… (e.g., 1)"
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? "Loading…" : "Load"}
          </button>
          <button type="button" onClick={clearFilters} disabled={loading}>
            Clear
          </button>
        </div>
      </form>

      {err && <div style={{ color: "crimson" }}>Error: {err}</div>}

      <div style={{ fontSize: 12, color: "#555" }}>
        Showing {sorted.length} item(s)
      </div>

      <table border="1" cellPadding="6" style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
        <thead>
          <tr><th>Project</th><th>Building</th><th>Unit</th><th>Plan Type</th><th>PDF</th></tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const key = `${r.project_id}-${r.building_id}-${r.unit_number}-${i}`;
            const isSelected =
              selected &&
              selected.project_id === r.project_id &&
              selected.building_id === r.building_id &&
              selected.unit_number === r.unit_number;

            return (
              <tr
                key={key}
                onClick={() => setSelected(r)}
                style={{ cursor: "pointer", background: isSelected ? "#eef7ff" : "transparent" }}
                title="Click to prefill"
              >
                <td>{r.project_id}</td>
                <td>{r.building_id}</td>
                <td>{r.unit_number}</td>
                <td>{r.plan_type || ""}</td>
                <td>
                  {r.floorplan_url ? (
                    <a href={r.floorplan_url} target="_blank" rel="noreferrer">Open</a>
                  ) : (
                    <span style={{ color: "#aaa" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && (
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Selected unit (prefill form)
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 8, alignItems: "center" }}>
            <label>Project</label>
            <input value={selected.project_id || ""} readOnly />
            <label>Building</label>
            <input value={selected.building_id || ""} readOnly />
            <label>Unit</label>
            <input value={selected.unit_number || ""} readOnly />
            
            <label>Plan Type</label>
            <input value={selected.plan_type || ""} readOnly />
         
            <label>Floor plan</label>
            {selected.floorplan_url ? (
              <a href={selected.floorplan_url} target="_blank" rel="noreferrer">Open floor plan (PDF)</a>
            ) : (
              <span style={{ color: "#666" }}>Not available</span>
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(selected))}
              title="Copies the prefill payload"
            >
              Copy prefill JSON
            </button>
            <button type="button" onClick={() => setSelected(null)}>
              Clear selection
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
