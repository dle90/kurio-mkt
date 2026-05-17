// Join sheet leads × Meta spend × Getfly revenue.
// Output: code-level ROAS + LP-level ROAS (for paying customers without code).
// Attribution model: FIRST-TOUCH per phone, code preferred, LP-host+path as fallback.
import fs from 'node:fs';
import { renderHtml } from './render_html.js';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend.json', 'utf-8'));
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

function lpKey(url) {
  if (!url) return null;
  try { const u = new URL(url); return u.hostname + u.pathname.replace(/\/$/, '') || u.hostname; } catch { return null; }
}

// 1. phone -> account with total_revenue
const phoneToAccount = {};
for (const a of GF.accounts) {
  const p = normPhone(a.phone_office);
  if (!p) continue;
  if (!phoneToAccount[p] || (a.total_revenue || 0) > (phoneToAccount[p].total_revenue || 0)) {
    phoneToAccount[p] = a;
  }
}

// 2. Meta spend per ad-name-norm
const spendByCode = new Map();
const impByCode = new Map();
const linkClicksByCode = new Map();
for (const r of META) {
  const k = r.ad_name_norm;
  if (!k) continue;
  spendByCode.set(k, (spendByCode.get(k) || 0) + r.spend);
  impByCode.set(k, (impByCode.get(k) || 0) + r.impressions);
  linkClicksByCode.set(k, (linkClicksByCode.get(k) || 0) + r.link_clicks);
}

// 3. Sheet — first-touch per phone, code preferred, LP as fallback
SHEET.sort((a, b) => a.date.localeCompare(b.date));
const phoneAttrib = new Map(); // phone -> { code | null, lp | null, first_date }
for (const lead of SHEET) {
  if (!lead.phone) continue;
  const lp = lpKey(lead.lp_url);
  if (!phoneAttrib.has(lead.phone)) {
    // First sheet row for this phone — code if present, else lp
    phoneAttrib.set(lead.phone, { code: lead.code || null, lp, first_date: lead.date });
  } else {
    // Already have a touch — but if the existing attribution has no code and this one does, upgrade
    const cur = phoneAttrib.get(lead.phone);
    if (!cur.code && lead.code) { cur.code = lead.code; }
    if (!cur.lp && lp) cur.lp = lp;
  }
}

// 4. Build per-code AND per-LP aggregates
const leadsByCode = new Map();
const phonesByCode = new Map();
const leadsByLp = new Map();
const phonesByLp = new Map();
// Lead counts (every row counted by code/LP, not unique-by-phone)
for (const lead of SHEET) {
  if (lead.code) leadsByCode.set(lead.code, (leadsByCode.get(lead.code) || 0) + 1);
  const lp = lpKey(lead.lp_url);
  if (lp) leadsByLp.set(lp, (leadsByLp.get(lp) || 0) + 1);
}
// Unique phones per code/LP using first-touch attribution
for (const [phone, attr] of phoneAttrib.entries()) {
  if (attr.code) {
    if (!phonesByCode.has(attr.code)) phonesByCode.set(attr.code, new Set());
    phonesByCode.get(attr.code).add(phone);
  } else if (attr.lp) {
    if (!phonesByLp.has(attr.lp)) phonesByLp.set(attr.lp, new Set());
    phonesByLp.get(attr.lp).add(phone);
  }
}

// 5. CODE-level rows
function buildRow(key, opts) {
  const spend = opts.spend || 0;
  const leads = opts.leads || 0;
  const uniq = opts.phones?.size || 0;
  let paid = 0, revenue = 0;
  for (const p of (opts.phones || [])) {
    const acct = phoneToAccount[p];
    if (acct && (acct.total_revenue || 0) > 0) { paid++; revenue += +acct.total_revenue; }
  }
  return {
    key,
    spend, impressions: opts.impressions || 0, linkClicks: opts.linkClicks || 0,
    leads, uniquePhones: uniq, paidPhones: paid, revenue,
    cpl: leads > 0 ? spend / leads : null,
    cps: paid > 0 ? spend / paid : null,
    convRate: uniq > 0 ? paid / uniq : 0,
    roas: spend > 0 ? revenue / spend : null,
  };
}

const codeRows = [];
const allCodes = new Set([...spendByCode.keys(), ...leadsByCode.keys()]);
for (const code of allCodes) {
  codeRows.push({
    type: 'code',
    inMeta: spendByCode.has(code),
    inSheet: leadsByCode.has(code),
    ...buildRow(code, {
      spend: spendByCode.get(code), impressions: impByCode.get(code), linkClicks: linkClicksByCode.get(code),
      leads: leadsByCode.get(code), phones: phonesByCode.get(code),
    }),
  });
}
codeRows.sort((a, b) => b.spend - a.spend);

// 6. LP-level rows (only for phones without a code)
const lpRows = [];
for (const [lp] of leadsByLp) {
  lpRows.push({
    type: 'lp',
    ...buildRow(lp, {
      // No Meta spend per LP available without further work
      leads: leadsByLp.get(lp),
      phones: phonesByLp.get(lp),
    }),
  });
}
lpRows.sort((a, b) => b.revenue - a.revenue);

// 7. Totals
const totSpend = codeRows.reduce((s, r) => s + r.spend, 0);
const totCodeRevenue = codeRows.reduce((s, r) => s + r.revenue, 0);
const totLpRevenue = lpRows.reduce((s, r) => s + r.revenue, 0);
const totCodePaid = codeRows.reduce((s, r) => s + r.paidPhones, 0);
const totLpPaid = lpRows.reduce((s, r) => s + r.paidPhones, 0);
const totAttribRevenue = totCodeRevenue + totLpRevenue;

// Universe totals from Getfly
const allPaidAccounts = GF.accounts.filter(a => (a.total_revenue || 0) > 0);
const universePaying = allPaidAccounts.length;
const universeRevenue = allPaidAccounts.reduce((s, a) => s + (+a.total_revenue || 0), 0);

console.log('='.repeat(80));
console.log('PIPELINE TOTALS (2026 YTD)');
console.log('='.repeat(80));
console.log(`  Total spend (Meta):                ${(totSpend|0).toLocaleString()} VND`);
console.log(`  Total revenue (Getfly universe):   ${Math.round(universeRevenue).toLocaleString()} VND`);
console.log(`  Total paying customers:            ${universePaying.toLocaleString()}`);
console.log(`  BLENDED ROAS (universe):           ${(universeRevenue / totSpend).toFixed(2)}`);
console.log('');
console.log(`  Code-attributed revenue:           ${(totCodeRevenue|0).toLocaleString()} VND  (${totCodePaid} paid)`);
console.log(`  LP-attributed revenue (fallback):  ${(totLpRevenue|0).toLocaleString()} VND  (${totLpPaid} paid)`);
console.log(`  Total attributed:                  ${(totAttribRevenue|0).toLocaleString()} VND  (${(totAttribRevenue/universeRevenue*100).toFixed(1)}% of revenue)`);
console.log(`  Unattributable (not in sheet):     ${(universeRevenue-totAttribRevenue|0).toLocaleString()} VND  (${((universeRevenue-totAttribRevenue)/universeRevenue*100).toFixed(1)}%)`);

// CODE TABLE
console.log('\n' + '='.repeat(100));
console.log('TOP 30 CODES BY SPEND');
console.log('='.repeat(100));
console.log('code'.padEnd(22) + '| spend       | leads| paid | revenue     | CPL    | CPS     | ROAS');
console.log('-'.repeat(100));
codeRows.slice(0, 30).forEach(r => {
  console.log([
    r.key.slice(0, 21).padEnd(21),
    (r.spend|0).toLocaleString().padStart(11),
    String(r.leads).padStart(5),
    String(r.paidPhones).padStart(5),
    (r.revenue|0).toLocaleString().padStart(11),
    (r.cpl != null ? (r.cpl|0).toLocaleString() : '—').padStart(7),
    (r.cps != null ? (r.cps|0).toLocaleString() : '—').padStart(8),
    r.roas != null ? r.roas.toFixed(2) : '—',
  ].join(' | '));
});

console.log('\nTop 15 by ROAS (min 1M spend, min 5 leads):');
codeRows.filter(r => r.spend >= 1e6 && r.leads >= 5 && r.roas != null)
  .sort((a, b) => b.roas - a.roas).slice(0, 15)
  .forEach(r => console.log(
    `  ${r.key.padEnd(22)} ROAS=${r.roas.toFixed(2)}  rev=${(r.revenue|0).toLocaleString().padStart(12)}  spend=${(r.spend|0).toLocaleString().padStart(11)}  paid=${r.paidPhones}/${r.uniquePhones}`
  ));

console.log('\nBottom 15 by ROAS (same filter):');
codeRows.filter(r => r.spend >= 1e6 && r.leads >= 5 && r.roas != null)
  .sort((a, b) => a.roas - b.roas).slice(0, 15)
  .forEach(r => console.log(
    `  ${r.key.padEnd(22)} ROAS=${r.roas.toFixed(2)}  rev=${(r.revenue|0).toLocaleString().padStart(12)}  spend=${(r.spend|0).toLocaleString().padStart(11)}  paid=${r.paidPhones}/${r.uniquePhones}`
  ));

// LP TABLE
console.log('\n' + '='.repeat(80));
console.log('LP-LEVEL FALLBACK (paying customers without a code, attributed by LP)');
console.log('='.repeat(80));
console.log('lp'.padEnd(45) + '| leads| paid | revenue       | conv%');
console.log('-'.repeat(80));
lpRows.slice(0, 20).forEach(r => {
  if (r.revenue === 0) return;
  console.log([
    r.key.slice(0, 44).padEnd(44),
    String(r.leads).padStart(5),
    String(r.paidPhones).padStart(5),
    (r.revenue|0).toLocaleString().padStart(13),
    (r.convRate * 100).toFixed(1) + '%',
  ].join(' | '));
});

// CSV outputs
const writeCsv = (path, rows, header) => {
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(header.map(h => {
      const v = r[h];
      if (typeof v === 'string' && (v.includes(',') || v.includes('"'))) return JSON.stringify(v);
      if (typeof v === 'number') return Number.isFinite(v) ? v : '';
      return v ?? '';
    }).join(','));
  }
  fs.writeFileSync(path, lines.join('\n'));
};

writeCsv('out/roas_by_code.csv',
  codeRows.map(r => ({
    code: r.key, spend_vnd: r.spend|0, impressions: r.impressions, link_clicks: r.linkClicks,
    leads: r.leads, unique_phones: r.uniquePhones, paid_phones: r.paidPhones,
    revenue_vnd: r.revenue|0,
    cpl_vnd: r.cpl != null ? (r.cpl|0) : '',
    cps_vnd: r.cps != null ? (r.cps|0) : '',
    conv_rate: r.convRate.toFixed(4),
    roas: r.roas != null ? r.roas.toFixed(3) : '',
    in_meta: r.inMeta, in_sheet: r.inSheet,
  })),
  ['code','spend_vnd','impressions','link_clicks','leads','unique_phones','paid_phones','revenue_vnd','cpl_vnd','cps_vnd','conv_rate','roas','in_meta','in_sheet']
);

writeCsv('out/roas_by_lp.csv',
  lpRows.map(r => ({
    lp: r.key, leads: r.leads, unique_phones: r.uniquePhones, paid_phones: r.paidPhones,
    revenue_vnd: r.revenue|0, conv_rate: r.convRate.toFixed(4),
  })),
  ['lp','leads','unique_phones','paid_phones','revenue_vnd','conv_rate']
);

console.log('\nWrote out/roas_by_code.csv and out/roas_by_lp.csv');

// HTML report
const totalLeads = SHEET.length;
const html = renderHtml({
  totals: {
    spend: totSpend,
    universeRevenue,
    payingCustomers: universePaying,
    totalLeads,
    codeAttrib: { paid: totCodePaid, revenue: totCodeRevenue },
    lpAttrib:   { paid: totLpPaid, revenue: totLpRevenue },
  },
  codeRows, lpRows,
  asOf: new Date().toISOString().slice(0, 10),
});
fs.writeFileSync('out/roas_report.html', html);
console.log('Wrote out/roas_report.html — open in any browser');
