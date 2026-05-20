// Code-level ROAS pipeline → out/roas_report.html + out/roas_by_code.csv
//
// Order-based revenue (approved sale_orders.real_amount) with Getfly ads_code
// attribution. Spend + registrations from Meta monthly insights. Consistent
// with recompute_codes_ranked.js (ATTRIB=getfly).
import fs from 'node:fs';
import { renderHtml } from './render_html.js';
import { loadAttribution, normPhone, isXpage } from './attribution.js';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json', 'utf8'));
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json', 'utf8'));

const { resolveAd, phoneToCode } = loadAttribution();

// ---- spend + registrations per code (YTD) ----
const spendByCode = new Map();
const impByCode = new Map();
const clicksByCode = new Map();
const regsByCode = new Map();
for (const r of META) {
  const code = resolveAd(r);
  if (!code) continue;
  spendByCode.set(code, (spendByCode.get(code) || 0) + (+r.spend || 0));
  impByCode.set(code, (impByCode.get(code) || 0) + (+r.impressions || 0));
  clicksByCode.set(code, (clicksByCode.get(code) || 0) + (+r.clicks || 0));
  regsByCode.set(code, (regsByCode.get(code) || 0) + (+r.registrations || 0));
}

// ---- order-based revenue + paying phones per code (YTD) ----
const revByCode = new Map();
const paidPhonesByCode = new Map();   // code -> Set(phone)
let totalRevenue = 0, codeAttribRevenue = 0;
const payingPhones = new Set();
for (const o of ORDERS) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const phone = normPhone(o.account_phone);
  totalRevenue += amt;
  if (phone) payingPhones.add(phone);
  const code = phoneToCode.get(phone);
  if (!code) continue;
  revByCode.set(code, (revByCode.get(code) || 0) + amt);
  codeAttribRevenue += amt;
  if (!paidPhonesByCode.has(code)) paidPhonesByCode.set(code, new Set());
  paidPhonesByCode.get(code).add(phone);
}

// ---- build code rows ----
const allCodes = new Set([...spendByCode.keys(), ...revByCode.keys()]);
const codeRows = [];
for (const code of allCodes) {
  const spend = spendByCode.get(code) || 0;
  const revenue = revByCode.get(code) || 0;
  const registrations = Math.round(regsByCode.get(code) || 0);
  const paidPhones = paidPhonesByCode.get(code)?.size || 0;
  codeRows.push({
    key: code, isXpage: isXpage(code),
    spend, impressions: impByCode.get(code) || 0, clicks: clicksByCode.get(code) || 0,
    registrations, paidPhones, revenue,
    cpr: registrations > 0 ? spend / registrations : null,
    cps: paidPhones > 0 ? spend / paidPhones : null,
    convRate: registrations > 0 ? paidPhones / registrations : 0,
    roas: spend > 0 ? revenue / spend : null,
  });
}
codeRows.sort((a, b) => b.spend - a.spend);

const totSpend = codeRows.reduce((s, r) => s + r.spend, 0);
const totReg = codeRows.reduce((s, r) => s + r.registrations, 0);

// ---- console summary ----
const L = '='.repeat(80);
console.log(L);
console.log('ROAS PIPELINE — 2026 YTD  (order-based revenue, Getfly ads_code attribution)');
console.log(L);
console.log(`  Meta spend (code-matched):      ${Math.round(totSpend).toLocaleString()} VND`);
console.log(`  Total approved revenue (Getfly):${Math.round(totalRevenue).toLocaleString()} VND`);
console.log(`  Ad-code-attributed revenue:     ${Math.round(codeAttribRevenue).toLocaleString()} VND  (${(codeAttribRevenue / totalRevenue * 100).toFixed(0)}% of total)`);
console.log(`  Blended ROAS (ad-attrib/spend): ${(codeAttribRevenue / totSpend).toFixed(2)}`);
console.log(`  Registrations:                  ${totReg.toLocaleString()}`);
console.log(`  Blended CPR:                    ${Math.round(totSpend / totReg).toLocaleString()} VND`);
console.log(`  Paying customers (universe):    ${payingPhones.size.toLocaleString()}`);

console.log('\nTop 30 codes by spend:');
console.log('code'.padEnd(22) + '| spend       | reg  | paid | revenue     | CPR    | ROAS');
console.log('-'.repeat(80));
for (const r of codeRows.slice(0, 30)) {
  console.log([
    r.key.slice(0, 21).padEnd(21),
    Math.round(r.spend).toLocaleString().padStart(11),
    String(r.registrations).padStart(5),
    String(r.paidPhones).padStart(5),
    Math.round(r.revenue).toLocaleString().padStart(11),
    (r.cpr != null ? Math.round(r.cpr).toLocaleString() : '—').padStart(7),
    r.roas != null ? r.roas.toFixed(2) : '—',
  ].join(' | '));
}

// ---- CSV ----
const esc = v => {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  const s = String(v);
  return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const cols = ['code', 'is_xpage', 'spend_vnd', 'impressions', 'clicks', 'registrations',
  'paid_phones', 'revenue_vnd', 'cpr_vnd', 'cps_vnd', 'conv_rate', 'roas'];
const csvLines = [cols.join(',')];
for (const r of codeRows) {
  csvLines.push([
    esc(r.key), r.isXpage ? 'TRUE' : 'FALSE', Math.round(r.spend), r.impressions, r.clicks,
    r.registrations, r.paidPhones, Math.round(r.revenue),
    r.cpr != null ? Math.round(r.cpr) : '', r.cps != null ? Math.round(r.cps) : '',
    r.convRate.toFixed(4), r.roas != null ? r.roas.toFixed(3) : '',
  ].join(','));
}
fs.writeFileSync('out/roas_by_code.csv', csvLines.join('\n'));
console.log('\nWrote out/roas_by_code.csv');

// ---- HTML ----
const html = renderHtml({
  totals: {
    spend: totSpend,
    totalRevenue,
    codeAttribRevenue,
    payingCustomers: payingPhones.size,
    totalRegistrations: totReg,
  },
  codeRows,
  asOf: new Date().toISOString().slice(0, 10),
});
fs.writeFileSync('out/roas_report.html', html);
console.log('Wrote out/roas_report.html — open in any browser');
