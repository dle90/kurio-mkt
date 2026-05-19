// Ingest the phone -> campaign-code leads spreadsheet into the `leads` table.
//
//   npm run db:ingest-leads -- path/to/leads.xlsx
//   LEADS_FILE=data/leads.xlsx LEADS_SHEET="Sheet1" npm run db:ingest-leads
//
// Columns are auto-detected from the header row (phone / code / date / name /
// package / grade / source). Override any of them if auto-detect guesses wrong:
//   LEADS_COL_PHONE="SĐT" LEADS_COL_CODE="Code" npm run db:ingest-leads -- file.xlsx
//
// Re-runnable: rows are INSERT OR IGNORE on (phone, code, lead_date).

import 'dotenv/config';
import { db, close } from '../db/connection.js';
import { readRows, matchColumn, toIsoDate } from '../lib/sheet.js';
import { normalizePhone, normalizeCode } from '../lib/normalize.js';

const file = process.argv[2] || process.env.LEADS_FILE;
if (!file) {
  console.error('Usage: npm run db:ingest-leads -- <path-to-leads.xlsx>  (or set LEADS_FILE)');
  process.exit(1);
}

const { sheet, sheets, rows } = readRows(file, process.env.LEADS_SHEET);
if (!rows.length) {
  console.error(`Sheet "${sheet}" is empty. Sheets in file: ${sheets.join(', ')}`);
  process.exit(1);
}

const headers = Object.keys(rows[0]);
const col = {
  phone:   process.env.LEADS_COL_PHONE   || matchColumn(headers, /phone|sdt|so dt|dien thoai|^sd/),
  code:    process.env.LEADS_COL_CODE    || matchColumn(headers, /^code$|campaign|chien dich|^ads?$/),
  date:    process.env.LEADS_COL_DATE    || matchColumn(headers, /date|ngay|thoi gian/),
  name:    process.env.LEADS_COL_NAME    || matchColumn(headers, /name|ten|phu huynh/),
  package: process.env.LEADS_COL_PACKAGE || matchColumn(headers, /package|goi|khoa hoc/),
  grade:   process.env.LEADS_COL_GRADE   || matchColumn(headers, /grade|lop|khoi|tuoi/),
  source:  process.env.LEADS_COL_SOURCE  || matchColumn(headers, /source|nguon/),
};

console.log(`Reading "${sheet}" — ${rows.length} rows`);
console.log('Column mapping (set LEADS_COL_* to override):');
for (const [k, v] of Object.entries(col)) console.log(`  ${k.padEnd(8)} -> ${v || '(none)'}`);
if (!col.phone || !col.code) {
  console.error('\nCould not find a phone and/or code column. Set LEADS_COL_PHONE / LEADS_COL_CODE.');
  process.exit(1);
}

const conn = db();
const insert = conn.prepare(`
  INSERT INTO leads (phone, phone_raw, code, lead_date, name, package, grade, source, raw)
  VALUES (?,?,?,?,?,?,?,?,?)
  ON CONFLICT (phone, code, lead_date) DO NOTHING`);

let inserted = 0, skippedNoPhone = 0, skippedNoCode = 0, dupes = 0;
const codes = new Set();

conn.exec('BEGIN');
try {
  for (const r of rows) {
    const phoneRaw = r[col.phone];
    const phone = normalizePhone(phoneRaw);
    if (!phone) { skippedNoPhone++; continue; }
    const code = normalizeCode(r[col.code]);
    if (!code) { skippedNoCode++; continue; }
    codes.add(code);
    const res = insert.run(
      phone, phoneRaw == null ? null : String(phoneRaw), code,
      col.date ? toIsoDate(r[col.date]) : null,
      col.name ? r[col.name] : null,
      col.package ? r[col.package] : null,
      col.grade ? r[col.grade] : null,
      col.source ? r[col.source] : null,
      JSON.stringify(r),
    );
    if (res.changes > 0) inserted++; else dupes++;
  }
  conn.exec('COMMIT');
} catch (e) {
  conn.exec('ROLLBACK');
  throw e;
}

conn.prepare(`INSERT INTO ingest_log (source, ran_at, detail) VALUES (?,?,?)`)
  .run('leads', new Date().toISOString(),
    JSON.stringify({ file, sheet, inserted, dupes, skippedNoPhone, skippedNoCode }));

console.log(`\nInserted ${inserted} leads (${dupes} already present, ` +
  `${skippedNoPhone} no/invalid phone, ${skippedNoCode} no code)`);
console.log(`${codes.size} distinct codes in this file`);

// Coverage: how many lead codes have matching ad spend?
const matched = conn.prepare(`
  SELECT COUNT(DISTINCT l.code) n FROM leads l
  WHERE l.code IN (SELECT code FROM ads WHERE code IS NOT NULL)`).get().n;
const total = conn.prepare(`SELECT COUNT(DISTINCT code) n FROM leads WHERE code IS NOT NULL`).get().n;
console.log(`Code coverage vs Meta ads: ${matched}/${total} lead codes match an ad code`);
if (matched < total) {
  const unmatched = conn.prepare(`
    SELECT DISTINCT code FROM leads
    WHERE code IS NOT NULL AND code NOT IN (SELECT code FROM ads WHERE code IS NOT NULL)
    ORDER BY code LIMIT 30`).all().map(r => r.code);
  console.log(`Unmatched lead codes (add to data/code-aliases.json): ${unmatched.join(', ')}`);
}
close();
