// Parse the Kurio Google Sheet CSV. Extract just what we need: A (date), C (phone), K (LP), P (code).
// Output: .cache/sheet_leads.json — array of { date, phone, lp_url, code }, 2026 YTD only.
import 'dotenv/config';
import fs from 'node:fs';

// Default to .cache/sheet.csv (created by fetch_sheet.js).
// Override via LEADS_SHEET_FILE in .env if you point at a manually-downloaded copy.
const FILE = process.env.LEADS_SHEET_FILE || '.cache/sheet.csv';

function* parseCsv(text) {
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); yield row; row = []; field = ''; i++; continue; }
      field += c; i++;
    }
  }
  if (field.length || row.length) { row.push(field); yield row; }
}

function parseDate(s) {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2,'0')}:${m[5]}:00`);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00`);
  return null;
}

// Phone normalize — same logic as fetch_getfly.js
export function normPhone(s) {
  if (!s) return '';
  const digits = String(s).replace(/[^\d]/g, '');
  if (digits.startsWith('84') && digits.length === 11) return '0' + digits.slice(2);
  if (digits.startsWith('84') && digits.length === 12) return '0' + digits.slice(2);
  if (digits.length === 9) return '0' + digits;
  if (digits.length === 10 && digits.startsWith('0')) return digits;
  if (digits.length === 10) return '0' + digits.slice(1);
  return digits;
}

// Normalize a code to match Meta ad-name normalization (lowercase, trim)
export function normCode(s) {
  if (!s) return '';
  return s.trim().toLowerCase();
}

const main = () => {
  const text = fs.readFileSync(FILE, 'utf-8');
  const iter = parseCsv(text);
  iter.next(); // header

  const leads = [];
  const cutoffStart = new Date('2026-01-01T00:00:00');
  for (const row of iter) {
    if (!row[0]) continue;
    const d = parseDate(row[0]);
    if (!d || d < cutoffStart) continue;
    const phone = normPhone(row[2]);
    const lp_url = (row[10] || '').trim();
    const code = normCode(row[15]);
    leads.push({
      date: row[0],
      phone,
      lp_url,
      code,
    });
  }
  console.log(`Parsed ${leads.length} YTD leads`);
  console.log(`  with phone: ${leads.filter(l => l.phone).length}`);
  console.log(`  with code:  ${leads.filter(l => l.code).length}`);
  console.log(`  with both:  ${leads.filter(l => l.phone && l.code).length}`);

  fs.writeFileSync('.cache/sheet_leads.json', JSON.stringify(leads, null, 2));
  console.log('Saved to .cache/sheet_leads.json');
};

main();
