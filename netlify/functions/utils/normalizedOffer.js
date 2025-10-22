const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function asString(value) {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return undefined;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

function asDate(value) {
  const str = asString(value);
  if (!str) return undefined;
  if (ISO_DATE_RE.test(str)) return str.substring(0, 10);
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().substring(0, 10);
}

function stripEmptyValues(record = {}) {
  const out = { ...record };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "number" && Number.isNaN(value))
    ) {
      delete out[key];
    }
  }
  return out;
}

module.exports = {
  asString,
  asNumber,
  asDate,
  stripEmptyValues,
};
