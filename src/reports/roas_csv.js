// Convert data/revenue-by-campaign-0401-0510.tsv into a clean CSV that Excel
// opens natively (UTF-8 BOM, plain numeric values, dot decimal separator).
//
//   node src/reports/roas_csv.js
//
// Outputs data/roas-by-campaign-0401-0510.csv, sorted by spend desc, with a
// recomputed totals row at the bottom.

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'data/revenue-by-campaign-0401-0510.tsv';
const OUT = 'data/roas-by-campaign-0401-0510.csv';

const toInt = s => {
  if (!s || s === '#DIV/0!') return null;
  const n = Number(s.replace(/\./g, ''));
  return Number.isFinite(n) ? n : null;
};

const lines = readFileSync(SRC, 'utf8').split(/\r?\n/).filter(Boolean);
const rows = [];
for (const line of lines.slice(1)) {
  const [name, lead, spend, , orders, revenue] = line.split('\t');
  if (!name || name === 'Tổng cộng') continue;
  const s = toInt(spend);
  const r = toInt(revenue);
  const l = toInt(lead);
  const o = toInt(orders);
  rows.push({
    campaign: name,
    spend: s ?? 0,
    leads: l ?? 0,
    cpl: l > 0 ? Math.round(s / l) : null,
    orders: o ?? 0,
    revenue: r ?? 0,
    roas: s > 0 ? (r ?? 0) / s : null,
  });
}

rows.sort((a, b) => b.spend - a.spend);

const tot = rows.reduce((a, r) => ({
  spend: a.spend + r.spend,
  leads: a.leads + r.leads,
  orders: a.orders + r.orders,
  revenue: a.revenue + r.revenue,
}), { spend: 0, leads: 0, orders: 0, revenue: 0 });

const fmt = v => v == null ? '' : String(v);
const csv = ['Campaign,Spend (VND),Leads,CPL (VND),Orders,Revenue (VND),ROAS'];
for (const r of rows) {
  csv.push([r.campaign, r.spend, r.leads, fmt(r.cpl), r.orders, r.revenue,
    r.roas == null ? '' : r.roas.toFixed(2)].join(','));
}
csv.push(['TOTAL', tot.spend, tot.leads, Math.round(tot.spend / tot.leads),
  tot.orders, tot.revenue, (tot.revenue / tot.spend).toFixed(2)].join(','));

writeFileSync(OUT, '﻿' + csv.join('\r\n') + '\r\n');
console.log(`Wrote ${OUT}: ${rows.length} campaigns`);
console.log(`Total spend: ${tot.spend.toLocaleString('en-US')} VND  ` +
  `revenue: ${tot.revenue.toLocaleString('en-US')} VND  ` +
  `ROAS: ${(tot.revenue / tot.spend).toFixed(2)}`);
