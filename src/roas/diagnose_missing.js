// Diagnose why 836 paid customers aren't attributed to a code.
// For each paying account, classify how it could be attributed.
import fs from 'node:fs';

const SHEET = JSON.parse(fs.readFileSync('.cache/sheet_leads.json', 'utf-8'));
const GF = JSON.parse(fs.readFileSync('.cache/getfly.json', 'utf-8'));

function normPhone(s) {
  if (!s) return '';
  const d = String(s).replace(/[^\d]/g, '');
  if (d.startsWith('84') && d.length === 11) return '0' + d.slice(2);
  if (d.startsWith('84') && d.length === 12) return '0' + d.slice(2);
  if (d.length === 9) return '0' + d;
  if (d.length === 10 && d.startsWith('0')) return d;
  if (d.length === 10) return '0' + d.slice(1);
  return d;
}

// Sheet leads YTD — already parsed + normalized via parse_sheet.js
// Build phone -> list of YTD leads (sorted ascending)
const ytdByPhone = new Map();
const sortedYtd = [...SHEET].sort((a, b) => a.date.localeCompare(b.date));
for (const lead of sortedYtd) {
  if (!lead.phone) continue;
  if (!ytdByPhone.has(lead.phone)) ytdByPhone.set(lead.phone, []);
  ytdByPhone.get(lead.phone).push(lead);
}

// Also load FULL sheet (any year) to check for pre-2026 attribution
import('node:fs').then(async ({ readFileSync }) => {
  const text = readFileSync(process.env.LEADS_SHEET_FILE || '.cache/sheet.csv', 'utf-8');
  function* parseCsv(s) {
    let i = 0, field = '', row = [], inQ = false;
    while (i < s.length) {
      const c = s[i];
      if (inQ) { if (c === '"') { if (s[i+1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; } field += c; i++; }
      else {
        if (c === '"') { inQ = true; i++; continue; }
        if (c === ',') { row.push(field); field = ''; i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { row.push(field); yield row; row = []; field = ''; i++; continue; }
        field += c; i++;
      }
    }
    if (field.length || row.length) { row.push(field); yield row; }
  }
  function parseDate(v) {
    if (!v) return null;
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4].padStart(2,'0')}:${m[5]}:00`);
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (m) return new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}:00`);
    return null;
  }
  const iter = parseCsv(text);
  iter.next();
  // All-time sheet — phone -> last code-bearing lead (any year)
  const allByPhone = new Map();
  // Also: all-time phones with ANY row (not requiring code)
  const allTimePhones = new Set();
  for (const row of iter) {
    if (!row[0]) continue;
    const d = parseDate(row[0]);
    if (!d) continue;
    const phone = normPhone(row[2]);
    if (!phone) continue;
    allTimePhones.add(phone);
    const code = (row[15] || '').trim().toLowerCase();
    const lp = (row[10] || '').trim();
    if (code || lp) {
      if (!allByPhone.has(phone)) allByPhone.set(phone, []);
      allByPhone.get(phone).push({ date: row[0], code, lp });
    }
  }

  console.log('\nClassifying 1,491 paying accounts (YTD)...\n');

  let bucket = {
    a_first_touch_code:   { count: 0, revenue: 0 },
    b_any_ytd_code:       { count: 0, revenue: 0 },
    c_ytd_lp_only:        { count: 0, revenue: 0 },
    d_pre_2026_code:      { count: 0, revenue: 0 },
    e_in_sheet_no_attrib: { count: 0, revenue: 0 },
    f_not_in_sheet:       { count: 0, revenue: 0 },
    g_no_phone_on_acct:   { count: 0, revenue: 0 },
  };
  let total = 0;

  for (const a of GF.accounts) {
    const rev = +a.total_revenue || 0;
    if (rev <= 0) continue;  // skip non-paying
    total++;
    const phone = normPhone(a.phone_office);
    if (!phone) { bucket.g_no_phone_on_acct.count++; bucket.g_no_phone_on_acct.revenue += rev; continue; }
    const ytdRows = ytdByPhone.get(phone) || [];
    if (ytdRows.length > 0) {
      // Find first YTD row that has a code
      const firstWithCode = ytdRows.find(r => r.code);
      const firstAny = ytdRows[0];
      if (firstAny.code) { bucket.a_first_touch_code.count++; bucket.a_first_touch_code.revenue += rev; continue; }
      if (firstWithCode)  { bucket.b_any_ytd_code.count++;     bucket.b_any_ytd_code.revenue += rev; continue; }
      // YTD rows exist but none have code — fall back to LP
      const firstWithLp = ytdRows.find(r => r.lp_url);
      if (firstWithLp) { bucket.c_ytd_lp_only.count++; bucket.c_ytd_lp_only.revenue += rev; continue; }
      bucket.e_in_sheet_no_attrib.count++; bucket.e_in_sheet_no_attrib.revenue += rev; continue;
    }
    // Not in YTD sheet — check historical
    const historical = allByPhone.get(phone) || [];
    if (historical.length > 0) {
      const firstWithCode = historical.find(r => r.code);
      if (firstWithCode) { bucket.d_pre_2026_code.count++; bucket.d_pre_2026_code.revenue += rev; continue; }
      bucket.e_in_sheet_no_attrib.count++; bucket.e_in_sheet_no_attrib.revenue += rev; continue;
    }
    if (allTimePhones.has(phone)) { bucket.e_in_sheet_no_attrib.count++; bucket.e_in_sheet_no_attrib.revenue += rev; continue; }
    bucket.f_not_in_sheet.count++; bucket.f_not_in_sheet.revenue += rev;
  }

  const fmt = n => n.toLocaleString();
  console.log('Classification:');
  console.log(`  total paying accounts:                 ${fmt(total)}  ${fmt(Object.values(bucket).reduce((s, b) => s + b.revenue, 0))} VND`);
  for (const [k, v] of Object.entries(bucket)) {
    const pct = ((v.count / total) * 100).toFixed(1);
    console.log(`  ${k.padEnd(35)} count=${String(v.count).padStart(5)} (${pct.padStart(4)}%)  revenue=${fmt(v.revenue).padStart(13)} VND`);
  }

  // The recoverable buckets:
  const recoverable = bucket.b_any_ytd_code.count + bucket.c_ytd_lp_only.count + bucket.d_pre_2026_code.count;
  const currentAttrib = bucket.a_first_touch_code.count;
  console.log(`\n  CURRENT ATTRIBUTED:    ${currentAttrib} (${(currentAttrib/total*100).toFixed(0)}%) — first-touch-with-code only`);
  console.log(`  RECOVERABLE via expand: +${recoverable} more (${(recoverable/total*100).toFixed(0)}%)`);
  console.log(`  UNRECOVERABLE:         ${bucket.e_in_sheet_no_attrib.count + bucket.f_not_in_sheet.count + bucket.g_no_phone_on_acct.count}`);
});
