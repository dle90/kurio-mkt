// What does "_kv" / "-kv" mean? LP path? Just naming? Which subset is actually bad?
import fs from 'node:fs';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend.json', 'utf-8'));
const CREATIVE = JSON.parse(fs.readFileSync('.cache/meta_creative.json', 'utf-8'));
const SHEET = JSON.parse(fs.readFileSync('.cache/sheet_leads.json', 'utf-8'));
const GF = JSON.parse(fs.readFileSync('.cache/getfly.json', 'utf-8'));

function normPhone(s) {
  if (!s) return '';
  const d = String(s).replace(/[^\d]/g, '');
  if (d.startsWith('84') && d.length === 11) return '0' + d.slice(2);
  if (d.length === 9) return '0' + d;
  if (d.length === 10 && d.startsWith('0')) return d;
  return d;
}

const phoneToAccount = {};
for (const a of GF.accounts) {
  const p = normPhone(a.phone_office);
  if (p && (!phoneToAccount[p] || (a.total_revenue || 0) > (phoneToAccount[p].total_revenue || 0))) phoneToAccount[p] = a;
}

// 1. Find all distinct LP URLs in sheet that contain "kv" or "_xpage"
const lpCounts = new Map();
for (const lead of SHEET) {
  if (!lead.lp_url) continue;
  try {
    const u = new URL(lead.lp_url);
    const path = u.hostname + u.pathname;
    lpCounts.set(path, (lpCounts.get(path) || 0) + 1);
  } catch {}
}
console.log('=== Distinct LP paths in sheet (top 30 by lead count) ===');
[...lpCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
  .forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));

// 2. Look at codes containing "kv" — get LP URL distribution + ROAS
const kvCodes = new Set();
for (const r of META) if (/[\-_]kv/i.test(r.ad_name_norm || '')) kvCodes.add(r.ad_name_norm);

console.log(`\n=== Codes with "kv" suffix in Meta ad name: ${kvCodes.size} ===`);
const kvAnalysis = [];
for (const code of kvCodes) {
  // Spend
  const spend = META.filter(r => r.ad_name_norm === code).reduce((s, r) => s + r.spend, 0);
  // Leads + first-touch attributed phones
  const leads = SHEET.filter(l => l.code === code);
  const phoneSet = new Set();
  const lpUrlSet = new Set();
  for (const l of leads) {
    if (l.phone) phoneSet.add(l.phone);
    if (l.lp_url) {
      try { lpUrlSet.add(new URL(l.lp_url).hostname + new URL(l.lp_url).pathname); } catch {}
    }
  }
  let paid = 0, revenue = 0;
  for (const p of phoneSet) {
    const acc = phoneToAccount[p];
    if (acc && (acc.total_revenue || 0) > 0) { paid++; revenue += +acc.total_revenue; }
  }
  // Active status from creative cache
  const ads = CREATIVE.filter(a => a.ad_name_norm === code);
  const active = ads.filter(a => a.effective_status === 'ACTIVE').length;
  kvAnalysis.push({
    code, spend, leads: leads.length, paid, revenue,
    roas: spend > 0 ? revenue / spend : null,
    lps: [...lpUrlSet],
    active,
  });
}
kvAnalysis.sort((a, b) => b.spend - a.spend);
console.log('code                | spend     | leads| paid | rev      | ROAS | active | LP destinations');
console.log('-'.repeat(120));
for (const r of kvAnalysis) {
  console.log([
    r.code.padEnd(18),
    (r.spend|0).toLocaleString().padStart(9),
    String(r.leads).padStart(5),
    String(r.paid).padStart(4),
    (r.revenue|0).toLocaleString().padStart(9),
    (r.roas == null ? '—' : r.roas.toFixed(2)).padStart(4),
    String(r.active).padStart(3) + ' ads',
    r.lps.join(', ').slice(0, 60)
  ].join(' | '));
}

// 3. For 13-xpage-kv specifically (a winning kv code) vs 83-xpage-kv (losing):
//    Where do their ads ACTUALLY link to? Pull the ad creative's link from object_story_id behavior
//    Easiest: look at the body text — it usually has the destination LP URL
console.log('\n=== "kv" creative body URLs (extract LPs from body text) ===');
for (const r of kvAnalysis.slice(0, 10)) {
  const ads = CREATIVE.filter(a => a.ad_name_norm === r.code && a.creative?.body);
  if (!ads.length) { console.log(`  ${r.code}: no creative body`); continue; }
  const urls = new Set();
  for (const a of ads) {
    const matches = (a.creative.body || '').match(/https?:\/\/[^\s)\]\}]+/g) || [];
    matches.forEach(u => urls.add(u.replace(/[.,;:]$/, '')));
  }
  console.log(`\n  ${r.code} (ROAS ${r.roas == null ? '—' : r.roas.toFixed(2)}):`);
  for (const u of urls) console.log(`    ${u}`);
}

// 4. Cross-tab: for each distinct LP path, compute aggregate paid conv rate + revenue/visitor
console.log('\n=== LP-level performance (conv rate + rev/visitor) for the top 12 LPs ===');
const lpStats = new Map();
for (const lead of SHEET) {
  if (!lead.lp_url || !lead.phone) continue;
  let path;
  try { const u = new URL(lead.lp_url); path = u.hostname + u.pathname; } catch { continue; }
  if (!lpStats.has(path)) lpStats.set(path, { leads: new Set(), phones: new Set() });
  lpStats.get(path).phones.add(lead.phone);
  lpStats.get(path).leads.add(lead.date + '|' + lead.phone);
}
const lpRows = [];
for (const [path, s] of lpStats) {
  let paid = 0, revenue = 0;
  for (const p of s.phones) {
    const a = phoneToAccount[p];
    if (a && (a.total_revenue || 0) > 0) { paid++; revenue += +a.total_revenue; }
  }
  lpRows.push({ path, leads: s.leads.size, phones: s.phones.size, paid, revenue, conv: s.phones.size > 0 ? paid / s.phones.size : 0 });
}
lpRows.sort((a, b) => b.phones - a.phones);
console.log('LP                                          | leads | phones | paid | rev       | conv% | rev/phone');
console.log('-'.repeat(110));
for (const r of lpRows.slice(0, 12)) {
  console.log([
    r.path.padEnd(43),
    String(r.leads).padStart(5),
    String(r.phones).padStart(6),
    String(r.paid).padStart(4),
    (r.revenue|0).toLocaleString().padStart(9),
    (r.conv * 100).toFixed(1) + '%',
    Math.round(r.revenue / Math.max(1, r.phones)).toLocaleString() + ' VND'
  ].join(' | '));
}
