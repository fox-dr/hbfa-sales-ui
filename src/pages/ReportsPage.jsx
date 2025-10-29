// Routes Used by this page
// - GET `/.netlify/functions/projects-list`: list available projects
// - GET `/.netlify/functions/report-status-coe?format=json|csv`: run/export COE report
// Access: VP and ADMIN via UI; backend allows SA, VP, EC, ADMIN
import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";

const CSV_HEADERS = [
  { key: "offerId", label: "offerId" },
  { key: "project_id", label: "project_id" },
  { key: "legacy_project_id", label: "legacy_project_id" },
  { key: "contract_unit_number", label: "contract_unit_number" },
  { key: "unit_number", label: "unit_number" },
  { key: "unit_number_numeric", label: "unit_number_numeric" },
  { key: "unit_name", label: "unit_name" },
  { key: "unit_collection", label: "unit_collection" },
  { key: "unit_building_code", label: "unit_building_code" },
  { key: "buyer_name", label: "buyer_name" },
  { key: "status", label: "status" },
  { key: "status_date", label: "status_date" },
  { key: "coe_date", label: "coe_date" },
  { key: "projected_closing_date", label: "projected_closing_date" },
  { key: "final_price", label: "final_price" },
  { key: "total_credits", label: "total_credits" },
];

function rowsToCsv(rows = []) {
  const esc = (value) => {
    if (value == null) return "";
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const headerLine = CSV_HEADERS.map((col) => col.label).join(",");
  const dataLines = rows.map((row) =>
    CSV_HEADERS.map((col) => esc(row?.[col.key])).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

function csvHasRecords(csvText) {
  if (!csvText) return false;
  const lines = csvText.split(/\r?\n/).slice(1);
  return lines.some((line) => line && line.replace(/"/g, "").replace(/,/g, "").trim().length > 0);
}

function triggerCsvDownload(csvText, filename = "report.csv") {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const auth = useAuth();
  const [project, setProject] = useState("");
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastFiltersKey, setLastFiltersKey] = useState("");

  function getFilters(overrides = {}) {
    return {
      project: overrides.project ?? project,
      status: overrides.status ?? status,
      from: overrides.from ?? from,
      to: overrides.to ?? to,
    };
  }

  function buildQuery(format = "json", overrides = {}) {
    const filters = getFilters(overrides);
    const p = new URLSearchParams();
    if (filters.project) p.set("project_id", filters.project);
    if (filters.status) p.set("status", filters.status);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    if (format) p.set("format", format);
    return p.toString();
  }

  useEffect(() => {
    (async () => {
      try {
        const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
        if (!jwt) return;
        const res = await fetch("/.netlify/functions/projects-list", { headers: { Authorization: `Bearer ${jwt}` } });
        if (res.status === 403) {
          setMsg("User Action Not Authorized");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setProjects(Array.isArray(data.projects) ? data.projects : []);
      } catch {}
    })();
  }, [auth?.user]);

  async function runReport(e) {
    e?.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
      if (!jwt) throw new Error("No JWT token available");
      const filtersKey = JSON.stringify(getFilters());
      const url = `/.netlify/functions/report-status-coe?${buildQuery("json")}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.status === 403) throw new Error("User Action Not Authorized");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems(data.items || []);
      setLastFiltersKey(filtersKey);
    } catch (e) {
      setMsg(e.message || "Report failed");
      setItems([]);
      setLastFiltersKey("");
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv(options = {}) {
    const { overrides = {}, forceFetch = false } = options;
    const filters = getFilters(overrides);
    const filtersKey = JSON.stringify(filters);
    try {
      const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
      if (!jwt) throw new Error("No JWT token available");
      const url = `/.netlify/functions/report-status-coe?${buildQuery("csv", overrides)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.status === 403) throw new Error("User Action Not Authorized");
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const shouldFallback = !forceFetch && filtersKey === lastFiltersKey && items.length > 0 && !csvHasRecords(text);
      if (shouldFallback) {
        const csvFromState = rowsToCsv(items);
        triggerCsvDownload(csvFromState);
        return;
      }
      triggerCsvDownload(text);
    } catch (e) {
      setMsg(e.message || "Download failed");
    }
  }

  async function downloadLast30Csv() {
    const today = new Date();
    const prior = new Date(today);
    prior.setDate(today.getDate() - 30);
    const fmt = (d) => d.toISOString().split("T")[0];
    const fromVal = fmt(prior);
    const toVal = fmt(today);
    setFrom(fromVal);
    setTo(toVal);
    await downloadCsv({ forceFetch: true, overrides: { from: fromVal, to: toVal } });
  }

  return (
    <div className="p-8">
      <AppHeader />
      <h3 className="text-xl font-bold mb-4">Status / COE Report</h3>
      <div style={{ marginBottom: 12, color: "#555" }}>
        Access: VP and Admin via UI. Backend allows SA, VP, EC, ADMIN.
        Endpoints: <code>/.netlify/functions/projects-list</code> and <code>/.netlify/functions/report-status-coe</code>.
      </div>
      <form onSubmit={runReport} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <label>
          Project
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </label>
        <input placeholder="Status" value={status} onChange={(e) => setStatus(e.target.value)} />
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit">Run</button>
        <button type="button" onClick={() => downloadCsv()}>Download CSV</button>
        <button type="button" onClick={downloadLast30Csv}>Last 30 days CSV</button>
      </form>
      {loading && <div>Loading.</div>}
      {msg && <div style={{ color: "crimson" }}>{msg}</div>}
      {items.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">OfferId</th>
              <th align="left">Project</th>
              <th align="left">Legacy Project</th>
              <th align="left">Unit</th>
              <th align="left">Unit Key</th>
              <th align="left">Collection</th>
              <th align="left">Buyer</th>
              <th align="left">Status</th>
              <th align="left">COE</th>
              <th align="left">Projected COE</th>
              <th align="left">Final Price</th>
              <th align="left">Credits</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const unitDisplay = r.unit_name || r.contract_unit_number || r.unit_number || "";
              const unitKey = r.contract_unit_number || "";
              const collection = r.unit_collection || "";
              return (
                <tr key={r.offerId}>
                  <td>{r.offerId}</td>
                  <td>{r.project_id || ""}</td>
                  <td>{r.legacy_project_id || ""}</td>
                  <td>{unitDisplay}</td>
                  <td>{unitKey}</td>
                  <td>{collection}</td>
                  <td>{r.buyer_name || ""}</td>
                  <td>{r.status || ""}</td>
                  <td>{r.coe_date || ""}</td>
                  <td>{r.projected_closing_date || ""}</td>
                  <td>{r.final_price || ""}</td>
                  <td>{r.total_credits || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
