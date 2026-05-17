// Generate an action-oriented summary:
//   - which codes are ALIVE (have ads with effective_status=ACTIVE)
//   - YTD ROAS + 30-day spend + 30-day vs YTD trend
//   - creative content for the top winners
//   - explicit PAUSE / SCALE / HOLD recommendations + budget shifts
import fs from 'node:fs';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend.json', 'utf-8'));
const META30 = JSON.parse(fs.readFileSync('.cache/meta_spend_30d.json', 'utf-8'));
const CREATIVE = JSON.parse(fs.readFileSync('.cache/meta_creative.json', 'utf-8'));
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

// Phone → account (with revenue)
const phoneToAccount = {};
for (const a of GF.accounts) {
  const p = normPhone(a.phone_office);
  if (p && (!phoneToAccount[p] || (a.total_revenue || 0) > (phoneToAccount[p].total_revenue || 0))) {
    phoneToAccount[p] = a;
  }
}

// First-touch attribution
SHEET.sort((a, b) => a.date.localeCompare(b.date));
const phoneFirstCode = new Map();
for (const lead of SHEET) {
  if (!lead.phone || !lead.code) continue;
  if (!phoneFirstCode.has(lead.phone)) phoneFirstCode.set(lead.phone, lead.code);
}
const phonesByCode = new Map();
for (const [phone, code] of phoneFirstCode) {
  if (!phonesByCode.has(code)) phonesByCode.set(code, new Set());
  phonesByCode.get(code).add(phone);
}

// Spend / leads aggregations
const spendYtd = new Map();
const spend30d = new Map();
const adsByCode = new Map(); // code -> [{ad_id, status, creative, ...}]
const leadsByCode = new Map();

for (const r of META) spendYtd.set(r.ad_name_norm, (spendYtd.get(r.ad_name_norm) || 0) + r.spend);
for (const r of META30) spend30d.set(r.ad_name_norm, (spend30d.get(r.ad_name_norm) || 0) + r.spend);
for (const a of CREATIVE) {
  if (!a.ad_name_norm) continue;
  if (!adsByCode.has(a.ad_name_norm)) adsByCode.set(a.ad_name_norm, []);
  adsByCode.get(a.ad_name_norm).push(a);
}
for (const lead of SHEET) if (lead.code) leadsByCode.set(lead.code, (leadsByCode.get(lead.code) || 0) + 1);

// Build per-code summary
const codes = new Set([...spendYtd.keys(), ...leadsByCode.keys()]);
const rows = [];
for (const code of codes) {
  const ads = adsByCode.get(code) || [];
  const active = ads.filter(a => a.effective_status === 'ACTIVE').length;
  const paused = ads.filter(a => a.effective_status === 'PAUSED').length;
  const archived = ads.filter(a => /ARCHIVED|DELETED|DISAPPROVED/.test(a.effective_status)).length;

  const phones = phonesByCode.get(code) || new Set();
  let paid = 0, revenue = 0;
  for (const p of phones) {
    const acct = phoneToAccount[p];
    if (acct && (acct.total_revenue || 0) > 0) { paid++; revenue += +acct.total_revenue; }
  }
  const ytdSpend = spendYtd.get(code) || 0;
  const sp30 = spend30d.get(code) || 0;
  const leads = leadsByCode.get(code) || 0;
  rows.push({
    code,
    ytdSpend, spend30d: sp30,
    sharePct30d: sp30 > 0 && ytdSpend > 0 ? (sp30 / ytdSpend) : 0,  // 30d-of-ytd ratio
    leads, phones: phones.size, paid, revenue,
    roas: ytdSpend > 0 ? revenue / ytdSpend : null,
    cps: paid > 0 ? ytdSpend / paid : null,
    activeAds: active, pausedAds: paused, archivedAds: archived,
    isAlive: active > 0,
  });
}
rows.sort((a, b) => b.ytdSpend - a.ytdSpend);

// Classification
function classify(r) {
  if (r.ytdSpend < 500_000 && r.leads < 3) return 'TINY';
  if (!r.isAlive) return r.roas != null && r.roas >= 1.5 ? 'HIST-WINNER-PAUSED' : 'DEAD';
  // ALIVE — judge
  if (r.spend30d < 200_000) return 'ALIVE-LOW-SPEND';      // running but minimal
  if (r.paid === 0 && r.spend30d >= 500_000) return 'PAUSE-NOW';   // burning, zero results
  if (r.roas != null && r.roas >= 1.5) return 'SCALE';
  if (r.roas != null && r.roas >= 1.0) return 'HOLD-PROFITABLE';
  if (r.roas != null && r.roas >= 0.5) return 'WATCH';
  return 'PAUSE-NOW';
}
for (const r of rows) r.action = classify(r);

// ============== OUTPUT ==============
const totSpend30d = rows.reduce((s, r) => s + r.spend30d, 0);
console.log(`\nLast-30-day total spend: ${totSpend30d.toLocaleString()} VND across ${rows.filter(r => r.spend30d > 0).length} codes`);

const groups = {};
for (const r of rows) (groups[r.action] = groups[r.action] || []).push(r);

function show(label, list, cols) {
  if (!list?.length) return;
  console.log(`\n${'='.repeat(80)}\n${label}\n${'='.repeat(80)}`);
  if (cols === 'full') {
    console.log('code'.padEnd(22) + '| YTDspend  | 30dspend  | leads | paid | rev      | ROAS | active');
    console.log('-'.repeat(95));
    list.forEach(r => console.log([
      r.code.slice(0,21).padEnd(21),
      (r.ytdSpend|0).toLocaleString().padStart(10),
      (r.spend30d|0).toLocaleString().padStart(10),
      String(r.leads).padStart(5),
      String(r.paid).padStart(4),
      (r.revenue|0).toLocaleString().padStart(9),
      (r.roas == null ? '—' : r.roas.toFixed(2)).padStart(5),
      String(r.activeAds).padStart(3) + ' ads'
    ].join(' | ')));
  }
  const subSpend30d = list.reduce((s, r) => s + r.spend30d, 0);
  const subRev = list.reduce((s, r) => s + r.revenue, 0);
  console.log(`  → ${list.length} codes  ·  30d spend: ${subSpend30d.toLocaleString()} VND  ·  total revenue: ${subRev.toLocaleString()} VND`);
}

const scaleSorted = (groups.SCALE || []).sort((a, b) => b.roas - a.roas);
const holdSorted  = (groups['HOLD-PROFITABLE'] || []).sort((a, b) => b.spend30d - a.spend30d);
const watchSorted = (groups.WATCH || []).sort((a, b) => b.spend30d - a.spend30d);
const pauseSorted = (groups['PAUSE-NOW'] || []).sort((a, b) => b.spend30d - a.spend30d);
const histWinners = (groups['HIST-WINNER-PAUSED'] || []).sort((a, b) => b.revenue - a.revenue);

show('🟢 SCALE — alive, ROAS ≥ 1.5, has spend', scaleSorted, 'full');
show('🟡 HOLD — alive + profitable (1.0–1.5)', holdSorted, 'full');
show('🟡 WATCH — alive + breakeven-ish (0.5–1.0)', watchSorted, 'full');
show('🔴 PAUSE NOW — alive + burning (ROAS<0.5 OR 0 paid + ≥500k spend in 30d)', pauseSorted, 'full');
show('💤 HISTORICALLY GOOD BUT PAUSED — consider relaunching with fresh creative', histWinners, 'full');

// === BUDGET REALLOCATION PROPOSAL ===
const pauseSpend30d = pauseSorted.reduce((s, r) => s + r.spend30d, 0);
const scaleSpend30d = scaleSorted.reduce((s, r) => s + r.spend30d, 0);
console.log('\n' + '='.repeat(80));
console.log('💰 BUDGET REALLOCATION PROPOSAL');
console.log('='.repeat(80));
console.log(`Free up by pausing:    ${pauseSpend30d.toLocaleString()} VND/month`);
console.log(`Current SCALE budget:  ${scaleSpend30d.toLocaleString()} VND/month`);
console.log(`Recommended: redirect freed spend proportionally to SCALE codes by ROAS:\n`);
const totWeights = scaleSorted.reduce((s, r) => s + r.roas * (r.spend30d || 100_000), 0); // weight by roas × current spend (avoid zeros)
for (const r of scaleSorted.slice(0, 10)) {
  const weight = r.roas * (r.spend30d || 100_000);
  const share = weight / totWeights;
  const newSpend = r.spend30d + Math.round(pauseSpend30d * share);
  const delta = newSpend - r.spend30d;
  console.log(`  ${r.code.padEnd(22)} ROAS ${r.roas.toFixed(2)} | now ${r.spend30d.toLocaleString().padStart(10)} → +${delta.toLocaleString().padStart(9)} = ${newSpend.toLocaleString().padStart(10)} VND/mo`);
}

// === CREATIVE CONTENT for top winners ===
console.log('\n' + '='.repeat(80));
console.log('🎨 WINNING CREATIVE CONTENT (top 15 by ROAS at ≥5M YTD spend, ≥10 leads)');
console.log('='.repeat(80));
const topWinners = rows
  .filter(r => r.ytdSpend >= 5_000_000 && r.leads >= 10 && r.roas != null)
  .sort((a, b) => b.roas - a.roas).slice(0, 15);

for (const r of topWinners) {
  const ads = adsByCode.get(r.code) || [];
  // Pick the highest-spend ad with non-empty creative body (most-budget version is most representative)
  const candidate = ads
    .filter(a => a.creative?.body && a.creative.body.trim())
    .sort((a, b) => (META.find(m => m.ad_id === b.ad_id)?.spend || 0) - (META.find(m => m.ad_id === a.ad_id)?.spend || 0))[0]
    || ads.find(a => a.creative);
  if (!candidate) { console.log(`\n--- ${r.code} (ROAS ${r.roas.toFixed(2)}) — no creative content available ---`); continue; }
  const c = candidate.creative;
  console.log(`\n--- ${r.code} ─ ROAS ${r.roas.toFixed(2)} ─ rev ${(r.revenue|0).toLocaleString()} VND ─ ${r.activeAds} active ad(s) ─ format ${c.object_type || 'unknown'} ---`);
  console.log(`  Title: ${(c.title || '').slice(0, 200)}`);
  console.log(`  Body:  ${(c.body || '').slice(0, 800).replace(/\s+/g, ' ')}`);
  if (c.image_url) console.log(`  Image: ${c.image_url}`);
  if (c.video_id) console.log(`  Video ID: ${c.video_id}`);
  console.log(`  CTA: ${c.cta || '(none)'}`);
}

// === CREATIVE CONTENT for top LOSERS for contrast ===
console.log('\n' + '='.repeat(80));
console.log('🔴 LOSER CREATIVE CONTENT (top 10 by spend among PAUSE-NOW)');
console.log('='.repeat(80));
const topLosers = pauseSorted.slice(0, 10);
for (const r of topLosers) {
  const ads = adsByCode.get(r.code) || [];
  const candidate = ads.filter(a => a.creative?.body)[0] || ads.find(a => a.creative);
  if (!candidate?.creative) { console.log(`\n--- ${r.code} (ROAS ${r.roas?.toFixed(2) || '—'}) — no creative content ---`); continue; }
  const c = candidate.creative;
  console.log(`\n--- ${r.code} ─ ROAS ${r.roas?.toFixed(2) || '—'} ─ spend30d ${r.spend30d.toLocaleString()} ─ paid ${r.paid}/${r.leads} ---`);
  console.log(`  Title: ${(c.title || '').slice(0, 200)}`);
  console.log(`  Body:  ${(c.body || '').slice(0, 500).replace(/\s+/g, ' ')}`);
}

// Save full report as JSON for downstream tools
fs.writeFileSync('.cache/actionable.json', JSON.stringify({
  totSpend30d, groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
  scaleSorted, holdSorted, watchSorted, pauseSorted, histWinners, topWinners,
}, null, 2));
console.log('\nWrote .cache/actionable.json');
