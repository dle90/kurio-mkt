// Thin wrapper over SheetJS for reading the leads / revenue spreadsheets.
// Returns plain row objects keyed by header, plus a fuzzy column matcher so the
// ingest scripts don't break when a header is renamed slightly.

import XLSX from 'xlsx';

/**
 * Read a sheet from an .xlsx/.csv file into an array of row objects.
 * @param {string} file  path to the workbook
 * @param {string} [sheetName]  sheet to read; defaults to the first
 */
export function readRows(file, sheetName) {
  const wb = XLSX.readFile(file, { cellDates: true });
  const name = sheetName || wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) {
    throw new Error(`Sheet "${name}" not found. Available: ${wb.SheetNames.join(', ')}`);
  }
  return { sheet: name, sheets: wb.SheetNames, rows: XLSX.utils.sheet_to_json(ws, { defval: null }) };
}

/**
 * Find the actual header key in a row that matches a regex (case-insensitive,
 * accent-insensitive). Returns the key or null. Used to auto-map columns.
 */
export function matchColumn(headerKeys, pattern) {
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const k of headerKeys) {
    if (pattern.test(norm(k))) return k;
  }
  return null;
}

/** Coerce a cell that may be a Date, Excel serial, or string into YYYY-MM-DD. */
export function toIsoDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    // Excel serial date (days since 1899-12-30).
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  const m = s.match(/(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})/);
  if (m) {
    let [, a, b, c] = m;
    // dd/mm/yyyy is the common VN format; detect by which part is the 4-digit year.
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    return `${c.padStart(4, '20')}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
