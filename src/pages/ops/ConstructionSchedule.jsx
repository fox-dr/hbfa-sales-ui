import React, { useEffect, useMemo, useState } from "react";

// Lightweight workday helper (parity with Excel WORKDAY)
function toDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  // Accept YYYY-MM-DD or M/D/YY(YY)
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtMDY(d) {
  const mm = String(d.getMonth() + 1).padStart(1, "0");
  const dd = String(d.getDate()).padStart(1, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

function isWeekend(d) {
  const day = d.getDay();
  return day === 0 || day === 6; // Sun/Sat
}

function workdayAdd(start, days, holidaySet) {
  if (!(start instanceof Date)) start = toDate(start);
  if (!start || typeof days !== "number") return null;
  const dir = days >= 0 ? 1 : -1;
  let remain = Math.abs(days);
  let d = new Date(start);
  while (remain !== 0) {
    d.setDate(d.getDate() + dir);
    const isHol = holidaySet.has(ymd(d));
    if (!isWeekend(d) && !isHol) {
      remain -= 1;
    }
  }
  return d;
}

export default function ConstructionSchedule() {
  const [projectId, setProjectId] = useState("default");
  const [building, setBuilding] = useState(17);
  const [lotCount, setLotCount] = useState(6);
  const [closeDates, setCloseDates] = useState({}); // lot -> date string
  const [template, setTemplate] = useState(null);
  const [holidays, setHolidays] = useState([]);

  const holidaySet = useMemo(() => new Set((holidays || []).map((d) => d)), [holidays]);

  useEffect(() => {
    async function load() {
      try {
        const t = await fetch("/.netlify/functions/ops-templates").then((r) => r.json());
        setTemplate(t);
      } catch (e) {
        console.error("load templates", e);
      }
    }
    load();
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const url = `/.netlify/functions/ops-calendars?project_id=${encodeURIComponent(projectId)}`;
        const c = await fetch(url).then((r) => r.json());
        setHolidays(c.holidays || []);
      } catch (e) {
        console.error("load calendar", e);
      }
    }
    load();
  }, [projectId]);

  const lots = useMemo(() => Array.from({ length: Math.max(1, Number(lotCount) || 1) }, (_, i) => i + 1), [lotCount]);

  const computed = useMemo(() => {
    if (!template) return [];
    const anchor = template.anchorWorkDay || 156;
    return template.tasks.map((task) => {
      const offset = (task.workDay ?? 0) - anchor; // Excel: WORKDAY(close, -anchor + workDay)
      const perLot = {};
      for (const lot of lots) {
        const cd = closeDates[lot];
        if (cd) {
          const dt = workdayAdd(toDate(cd), offset, holidaySet);
          perLot[lot] = dt ? fmtMDY(dt) : "";
        } else {
          perLot[lot] = "";
        }
      }
      return { ...task, offset, dates: perLot };
    });
  }, [template, lots, closeDates, holidaySet]);

  const onCloseDateChange = (lot, value) => {
    setCloseDates((prev) => ({ ...prev, [lot]: value }));
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Construction Schedule (OPS)</h2>
      <div className="flex gap-4 mb-4 items-end">
        <div>
          <label className="block text-sm">Project ID</label>
          <input className="border px-2 py-1" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm">Building #</label>
          <input type="number" className="border px-2 py-1 w-24" value={building} onChange={(e) => setBuilding(Number(e.target.value)||"")} />
        </div>
        <div>
          <label className="block text-sm">Lot count (1-12)</label>
          <input type="number" min={1} max={12} className="border px-2 py-1 w-24" value={lotCount} onChange={(e) => setLotCount(Number(e.target.value)||1)} />
        </div>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="text-left p-2">Work Day</th>
              <th className="text-left p-2">Task #</th>
              <th className="text-left p-2">Operation</th>
              {lots.map((lot) => (
                <th key={lot} className="p-2 text-center">
                  <div className="font-semibold">Lot {lot}</div>
                </th>
              ))}
            </tr>
            <tr className="bg-amber-50">
              <th className="p-2" colSpan={3}>Current Projected Close Date</th>
              {lots.map((lot) => (
                <th key={lot} className="p-1 text-center">
                  <input
                    placeholder="MM/DD/YY"
                    value={closeDates[lot] || ""}
                    onChange={(e) => onCloseDateChange(lot, e.target.value)}
                    className="border px-1 py-0.5 w-28 text-center"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(computed || []).map((row) => (
              <tr key={`${row.taskNo}-${row.workDay}`} className={row.milestone ? "bg-yellow-50" : ""}>
                <td className="p-2">{row.workDay}</td>
                <td className="p-2">{row.taskNo}</td>
                <td className="p-2 whitespace-nowrap">{row.label}</td>
                {lots.map((lot) => (
                  <td key={lot} className="p-2 text-center">
                    {row.dates[lot] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 text-gray-600 text-xs">
        Holidays loaded: {holidays.length}. Anchor work day: {template?.anchorWorkDay || 156}.
      </div>
    </div>
  );
}

