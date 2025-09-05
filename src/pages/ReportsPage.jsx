// Routes Used by this page
// - GET `/.netlify/functions/projects-list`: list available projects
// - GET `/.netlify/functions/report-status-coe?format=json|csv`: run/export COE report
// Access: VP and ADMIN via UI; backend allows SA, VP, EC, ADMIN
import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import AppHeader from "../components/AppHeader";

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

  function buildQuery(format = "json") {
    const p = new URLSearchParams();
    if (project) p.set("project_id", project);
    if (status) p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    p.set("format", format);
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
      const url = `/.netlify/functions/report-status-coe?${buildQuery("json")}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.status === 403) throw new Error("User Action Not Authorized");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setItems(data.items || []);
    } catch (e) {
      setMsg(e.message || "Report failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv() {
    try {
      const jwt = auth?.user?.id_token || auth?.user?.access_token || null;
      if (!jwt) throw new Error("No JWT token available");
      const url = `/.netlify/functions/report-status-coe?${buildQuery("csv")}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.status === 403) throw new Error("User Action Not Authorized");
      const text = await res.text();
      if (!res.ok) throw new Error(text || `HTTP ${res.status}`);
      const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "report.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setMsg(e.message || "Download failed");
    }
  }

  async function downloadLast30Csv() {
    const today = new Date();
    const prior = new Date(today);
    prior.setDate(today.getDate() - 30);
    const fmt = (d) => d.toISOString().split("T")[0];
    setFrom(fmt(prior));
    setTo(fmt(today));
    await downloadCsv();
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
        <button type="button" onClick={downloadCsv}>Download CSV</button>
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
              <th align="left">Unit</th>
              <th align="left">Buyer</th>
              <th align="left">Status</th>
              <th align="left">COE</th>
              <th align="left">Projected COE</th>
              <th align="left">Final Price</th>
              <th align="left">Credits</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.offerId}>
                <td>{r.offerId}</td>
                <td>{r.project_id || ""}</td>
                <td>{r.unit_number || ""}</td>
                <td>{r.buyer_name || ""}</td>
                <td>{r.status || ""}</td>
                <td>{r.coe_date || ""}</td>
                <td>{r.projected_closing_date || ""}</td>
                <td>{r.final_price || ""}</td>
                <td>{r.total_credits || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
