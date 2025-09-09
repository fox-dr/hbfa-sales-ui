// netlify/functions/ops-shared.js
// Shared utilities and seed data for OPS scheduling.

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

// Excel parity helpers
function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function workdayAdd(start, days, holidaySet) {
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return null;
  const dir = days >= 0 ? 1 : -1;
  let remain = Math.abs(days);
  const d = new Date(s);
  while (remain !== 0) {
    d.setDate(d.getDate() + dir);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6; // Sun/Sat
    const isHol = holidaySet?.has(ymd(d));
    if (!weekend && !isHol) remain -= 1;
  }
  return d;
}

export function formatMDY(d) {
  const mm = String(d.getMonth() + 1);
  const dd = String(d.getDate());
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

// Anchor work day that corresponds to the close date row in the template
export const ANCHOR_WORK_DAY = 156;

// Seed: default construction tasks (trimmed example; extend freely)
// Note: workDay values match your sheet; offset applied as (workDay - ANCHOR_WORK_DAY)
export const DEFAULT_TEMPLATE = {
  templateId: "default-v1",
  anchorWorkDay: ANCHOR_WORK_DAY,
  tasks: [
    { workDay: -15, taskNo: 2, label: "C1 Cut Off", milestone: true },
    { workDay: 2, taskNo: 4, label: "Trench Foundation" },
    { workDay: 4, taskNo: 6, label: "Form Foundation" },
    { workDay: 8, taskNo: 8, label: "Ground Plumbing", milestone: true },
    { workDay: 10, taskNo: 9, label: "Plumbing Inspection" },
    { workDay: 11, taskNo: 12, label: "Backfill & Subgrade" },
    { workDay: 13, taskNo: 14, label: "Vents, Ducts & Sweeps" },
    { workDay: 23, taskNo: 23, label: "Pour Foundation Slab", milestone: true },
    { workDay: 32, taskNo: 28, label: "Frame First Floor Walls" },
    { workDay: 35, taskNo: 30, label: "Plumb & Line First Floor", milestone: true },
    { workDay: 47, taskNo: 42, label: "C2 Cut Off", milestone: true },
    { workDay: 48, taskNo: 47, label: "Plumb & Line Second Floor", milestone: true },
    { workDay: 59, taskNo: 53, label: "Deliver Roof Trusses", milestone: true },
    { workDay: 66, taskNo: 61, label: "Roof Sheathing" },
    { workDay: 77, taskNo: 66, label: "Sheathing Inspection", milestone: true },
    { workDay: 81, taskNo: 77, label: "Set Window & Door Frames", milestone: true },
    { workDay: 93, taskNo: 96, label: "Start Framing (and Lath) Inspection", milestone: true },
    { workDay: 98, taskNo: 96.5, label: "Finish Framing (and Lath) Inspection", milestone: true },
    { workDay: 110, taskNo: 115, label: "Texture Drywall", milestone: true },
    { workDay: 116, taskNo: 129, label: "Cabinet Installation", milestone: true },
    { workDay: 134, taskNo: 172, label: "Final Clean", milestone: true },
    { workDay: 139, taskNo: 173, label: "Start Final Inspection & Approval", milestone: true },
    { workDay: 141, taskNo: 174, label: "Electric Meter" },
    { workDay: 156, taskNo: 184, label: "Projected Close Date", milestone: true },
  ],
};

// Seed: holidays provided (flattened to ISO YYYY-MM-DD)
export const DEFAULT_HOLIDAYS = [
  // 2025
  "2025-07-04", "2025-07-05", "2025-08-31", "2025-09-03", "2025-10-08",
  "2025-11-21", "2025-11-22", "2025-11-23", "2025-12-24", "2025-12-25", "2025-12-26", "2025-12-31",
  // 2026
  "2026-01-01", "2026-01-02", "2026-01-21", "2026-02-18", "2026-03-29", "2026-04-01", "2026-05-06",
  "2026-05-27", "2026-06-14", "2026-07-04", "2026-07-05", "2026-08-12", "2026-09-02", "2026-10-14",
  "2026-11-01", "2026-11-11", "2026-11-27", "2026-11-28", "2026-11-29", "2026-12-24", "2026-12-25",
  "2026-12-26", "2026-12-27", "2026-12-31",
  // 2027
  "2027-01-01", "2027-01-20", "2027-02-03", "2027-02-17", "2027-03-07", "2027-03-17", "2027-04-18",
  "2027-05-05", "2027-05-26", "2027-06-13", "2027-07-04", "2027-07-07", "2027-09-01", "2027-09-11",
  "2027-10-13", "2027-10-31", "2027-11-01", "2027-11-24", "2027-11-25", "2027-11-26", "2027-12-24",
  "2027-12-25", "2027-12-26", "2027-12-31",
  // 2028
  "2028-01-01", "2028-01-02", "2028-01-19", "2028-02-13", "2028-02-23", "2028-03-08", "2028-03-22",
  "2028-04-19", "2028-05-05", "2028-05-31", "2028-06-14", "2028-07-05", "2028-08-20", "2028-09-06",
  "2028-09-29", "2028-10-11", "2028-10-25", "2028-11-24", "2028-11-25", "2028-11-26", "2028-12-24",
  "2028-12-27", "2028-12-28", "2028-12-31",
];

export function computeScheduleForLots(closeDatesByLot, template = DEFAULT_TEMPLATE, holidays = DEFAULT_HOLIDAYS) {
  const anchor = template.anchorWorkDay ?? ANCHOR_WORK_DAY;
  const holidaySet = new Set(holidays);
  const rows = template.tasks.map((t) => ({ ...t, offset: (t.workDay ?? 0) - anchor, dates: {} }));
  for (const [lot, closeDate] of Object.entries(closeDatesByLot)) {
    const start = new Date(closeDate);
    for (const r of rows) {
      const dt = workdayAdd(start, r.offset, holidaySet);
      r.dates[lot] = dt ? formatMDY(dt) : null;
    }
  }
  return { templateId: template.templateId, rows };
}

