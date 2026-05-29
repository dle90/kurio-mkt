// One-off: export 5/28 MKT (account_source=31) accounts to Excel.
// Columns: phone, all UTM-style fields, ads_code. Rows where ads_code is
// empty are highlighted — those are the "Meta-ads-tagged but form didn't
// capture utm_content" gap (14 on 5/28).
//
// Usage: node src/exports/mkt_528_no_utm.mjs [YYYY-MM-DD]
import 'dotenv/config';
import fs from 'node:fs';
import XLSX from 'xlsx';
import { getfly } from '../getfly/client.js';

const DAY = process.argv[2] || '2026-05-28';
const FIELDS = 'id,phone_office,created_at,account_source,custom_fields';

console.log(`Pulling Getfly accounts created on ${DAY}, source=31 (MKT)...`);
const mkt = [];
let offset = 0, page = 0, stop = false;
while (!stop) {
  const r = await getfly.get('/accounts', { limit: 200, offset, fields: FIELDS });
  const data = r?.data || [];
  if (!data.length) break;
  for (const a of data) {
    const d = (a.created_at || '').slice(0, 10);
    if (d === DAY) {
      const src = Array.isArray(a.account_source) ? a.account_source[0] : a.account_source;
      if (src === 31) mkt.push(a);
    }
    if (d && d < DAY) { stop = true; break; }
  }
  page++;
  console.log(`  page ${page} (offset ${offset}, ${data.length} rows) — MKT collected: ${mkt.length}`);
  offset += data.length;
  if (!r.has_more) break;
  if (page > 50) break;
}

console.log(`\nFound ${mkt.length} MKT accounts on ${DAY}`);

// discover all utm-style + ads_code keys present in custom_fields
const cfKeySet = new Set();
for (const a of mkt) {
  const cf = a.custom_fields;
  if (cf && typeof cf === 'object' && !Array.isArray(cf)) {
    for (const k of Object.keys(cf)) cfKeySet.add(k);
  }
}
const utmKeys = [...cfKeySet].filter(k => /utm|ads_code|^code$|^gclid$|^fbclid$/i.test(k)).sort();
console.log(`utm/ads keys present:`, utmKeys);

// build rows
const rows = mkt.map(a => {
  const cf = a.custom_fields && !Array.isArray(a.custom_fields) ? a.custom_fields : {};
  const row = {
    id: a.id,
    phone: a.phone_office || '',
    created_at: a.created_at || '',
    account_source: 31,
    ads_code: (cf.ads_code || '').trim(),
  };
  for (const k of utmKeys) if (k !== 'ads_code') row[k] = (cf[k] || '').toString();
  row.has_utm = !!row.ads_code;
  return row;
});

// sort: no-utm first
rows.sort((a, b) => (a.has_utm === b.has_utm) ? a.phone.localeCompare(b.phone) : (a.has_utm ? 1 : -1));

const noUtm = rows.filter(r => !r.has_utm);
console.log(`  with ads_code:    ${rows.length - noUtm.length}`);
console.log(`  WITHOUT ads_code: ${noUtm.length}  <-- highlighted in red`);

// write Excel
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(rows);

// apply red fill + bold to rows missing ads_code
const range = XLSX.utils.decode_range(ws['!ref']);
const headers = Object.keys(rows[0] || {});
const adsCodeCol = headers.indexOf('ads_code');
for (let R = 1; R <= range.e.r; R++) {
  const row = rows[R - 1];
  if (!row.has_utm) {
    for (let C = 0; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = {
        fill: { fgColor: { rgb: 'FFE5E5' } },
        font: { color: { rgb: '9A1B1B' }, bold: C === adsCodeCol },
      };
    }
  }
}
// header row styling
for (let C = 0; C <= range.e.c; C++) {
  const addr = XLSX.utils.encode_cell({ r: 0, c: C });
  if (ws[addr]) ws[addr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8E8E8' } } };
}
// column widths
ws['!cols'] = headers.map(h => ({ wch: h === 'created_at' ? 22 : h === 'id' ? 11 : Math.max(12, h.length + 2) }));

XLSX.utils.book_append_sheet(wb, ws, `MKT ${DAY}`);

// also add a summary sheet
const sumWs = XLSX.utils.aoa_to_sheet([
  ['Metric', 'Count', 'Note'],
  ['Total MKT (source=31)', rows.length, 'matches CRM "MKT" row'],
  ['With ads_code captured', rows.length - noUtm.length, 'visible in dashboard "Reg/ad"'],
  ['Without ads_code (highlighted)', noUtm.length, 'LP form-capture leak — ad-attributed but uncoded'],
  [],
  ['Source', 'Getfly /accounts on ' + new Date().toISOString()],
]);
sumWs['!cols'] = [{ wch: 32 }, { wch: 10 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, sumWs, 'Summary');

const outPath = `data/mkt-${DAY}-utm-audit.xlsx`;
XLSX.writeFile(wb, outPath);
console.log(`\nWrote ${outPath}`);
