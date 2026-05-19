// Repackage out/roas_by_code.csv as an Excel-friendly CSV with:
//   - UTF-8 BOM (Excel auto-detects encoding for Vietnamese)
//   - plain integer values (no quotes), dot decimal for ROAS
//   - sorted by spend desc within each section
//   - section 1: attributed campaigns (codes that appear in the leads sheet)
//   - section 2: unattributed Meta spend (Meta ad-names that aren't in the sheet)
//   - totals rows for each section + a grand total
//
// Output: data/roas-ytd-2026-by-campaign.csv

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'out/roas_by_code.csv';
const OUT = 'data/roas-ytd-2026-by-campaign.csv';

const text = readFileSync(SRC, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const header = lines[0].split(',');
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const rows = lines.slice(1).map(l => {
  const f = l.split(',');
  return {
    code: f[idx.code],
    spend: +f[idx.spend_vnd] || 0,
    leads: +f[idx.leads] || 0,
    unique_phones: +f[idx.unique_phones] || 0,
    paid_phones: +f[idx.paid_phones] || 0,
    revenue: +f[idx.revenue_vnd] || 0,
    cpl: f[idx.cpl_vnd] === '' ? null : +f[idx.cpl_vnd],
    cps: f[idx.cps_vnd] === '' ? null : +f[idx.cps_vnd],
    roas: f[idx.roas] === '' ? null : +f[idx.roas],
    in_meta: f[idx.in_meta] === 'true',
    in_sheet: f[idx.in_sheet] === 'true',
  };
});

const attributed = rows.filter(r => r.in_sheet).sort((a, b) => b.spend - a.spend);
const unattributed = rows.filter(r => !r.in_sheet).sort((a, b) => b.spend - a.spend);

const sum = arr => arr.reduce((a, r) => ({
  spend: a.spend + r.spend,
  leads: a.leads + r.leads,
  unique_phones: a.unique_phones + r.unique_phones,
  paid_phones: a.paid_phones + r.paid_phones,
  revenue: a.revenue + r.revenue,
}), { spend: 0, leads: 0, unique_phones: 0, paid_phones: 0, revenue: 0 });

const tA = sum(attributed);
const tU = sum(unattributed);
const tAll = sum(rows);

const csvLines = [];
const COLS = ['Campaign (code)', 'Spend (VND)', 'Leads', 'Unique phones',
  'Paid phones', 'Revenue (VND)', 'CPL (VND)', 'CPS (VND)', 'ROAS'];

const esc = s => {
  const v = String(s);
  return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
};
const fmt = v => v == null ? '' : String(v);
const round = v => v == null ? '' : Math.round(v);

const writeRow = r => csvLines.push([
  esc(r.code), r.spend, r.leads, r.unique_phones, r.paid_phones, r.revenue,
  round(r.cpl), round(r.cps), r.roas == null ? '' : r.roas.toFixed(3),
].join(','));

csvLines.push(COLS.join(','));

csvLines.push('=== ATTRIBUTED (codes mapped to leads sheet) ===,,,,,,,,');
for (const r of attributed) writeRow(r);
csvLines.push([
  `SUBTOTAL — ${attributed.length} attributed`, tA.spend, tA.leads,
  tA.unique_phones, tA.paid_phones, tA.revenue,
  tA.leads > 0 ? Math.round(tA.spend / tA.leads) : '',
  tA.paid_phones > 0 ? Math.round(tA.spend / tA.paid_phones) : '',
  tA.spend > 0 ? (tA.revenue / tA.spend).toFixed(3) : '',
].join(','));

csvLines.push(',,,,,,,,');
csvLines.push('=== UNATTRIBUTED (Meta spend on ad-names not in sheet) ===,,,,,,,,');
for (const r of unattributed) writeRow(r);
csvLines.push([
  `SUBTOTAL — ${unattributed.length} unattributed`, tU.spend, tU.leads,
  tU.unique_phones, tU.paid_phones, tU.revenue, '', '', '',
].join(','));

csvLines.push(',,,,,,,,');
csvLines.push([
  `GRAND TOTAL — ${rows.length} rows`, tAll.spend, tAll.leads,
  tAll.unique_phones, tAll.paid_phones, tAll.revenue,
  tAll.leads > 0 ? Math.round(tAll.spend / tAll.leads) : '',
  tAll.paid_phones > 0 ? Math.round(tAll.spend / tAll.paid_phones) : '',
  tAll.spend > 0 ? (tAll.revenue / tAll.spend).toFixed(3) : '',
].join(','));

writeFileSync(OUT, '﻿' + csvLines.join('\r\n') + '\r\n');

console.log(`Wrote ${OUT}`);
console.log(`  attributed:   ${attributed.length} codes  spend ${tA.spend.toLocaleString('en-US')}  revenue ${tA.revenue.toLocaleString('en-US')}  ROAS ${(tA.revenue/tA.spend).toFixed(2)}`);
console.log(`  unattributed: ${unattributed.length} codes  spend ${tU.spend.toLocaleString('en-US')}  (${(tU.spend/tAll.spend*100).toFixed(1)}% of total spend)`);
console.log(`  grand total:                       spend ${tAll.spend.toLocaleString('en-US')}  revenue ${tAll.revenue.toLocaleString('en-US')}  blended ROAS ${(tAll.revenue/tAll.spend).toFixed(2)}`);
