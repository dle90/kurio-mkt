// Action-oriented summary — PAUSE / SCALE / HOLD recommendations.
//
// Order-based revenue + Getfly ads_code attribution (consistent with
// recompute_codes_ranked.js / compute.js). Spend + registrations from Meta
// monthly insights; 30-day spend from the creative-refresh cache; ad status
// and creative content from meta_creative.json.
import fs from 'node:fs';
import { loadAttribution, normPhone } from './attribution.js';

const META = JSON.parse(fs.readFileSync('.cache/meta_spend_monthly.json', 'utf-8'));
const META30 = JSON.parse(fs.readFileSync('.cache/meta_spend_30d.json', 'utf-8'));
const CREATIVE = JSON.parse(fs.readFileSync('.cache/meta_creative.json', 'utf-8'));
const ORDERS = JSON.parse(fs.readFileSync('.cache/getfly_orders_ytd.json', 'utf-8'));

const { resolveAd, phoneToCode } = loadAttribution();

// ---- spend + registrations YTD per code; spend per ad_id (creative pick) ----
const spendYtd = new Map(), regsYtd = new Map(), spendByAdId = new Map();
for (const r of META) {
  spendByAdId.set(r.ad_id, (spendByAdId.get(r.ad_id) || 0) + (+r.spend || 0));
  const code = resolveAd(r);
  if (!code) continue;
  spendYtd.set(code, (spendYtd.get(code) || 0) + (+r.spend || 0));
  regsYtd.set(code, (regsYtd.get(code) || 0) + (+r.registrations || 0));
}

// ---- 30-day spend per code ----
const spend30d = new Map();
for (const r of META30) {
  const code = resolveAd({ ad_name_norm: r.ad_name_norm, adset_name: '', campaign_name: '' });
  if (!code) continue;
  spend30d.set(code, (spend30d.get(code) || 0) + (+r.spend || 0));
}

// ---- ads (creative + status) per code ----
const adsByCode = new Map();
for (const a of CREATIVE) {
  const code = resolveAd({ ad_name_norm: a.ad_name_norm, adset_name: '', campaign_name: '' });
  if (!code) continue;
  if (!adsByCode.has(code)) adsByCode.set(code, []);
  adsByCode.get(code).push(a);
}

// ---- order-based revenue + paying phones per code ----
const revByCode = new Map(), paidByCode = new Map();
for (const o of ORDERS) {
  if (o.status !== 2) continue;
  const amt = +o.real_amount || 0;
  if (amt <= 0) continue;
  const phone = normPhone(o.account_phone);
  const code = phoneToCode.get(phone);
  if (!code) continue;
  revByCode.set(code, (revByCode.get(code) || 0) + amt);
  if (!paidByCode.has(code)) paidByCode.set(code, new Set());
  paidByCode.get(code).add(phone);
}

// ---- per-code rows ----
const codes = new Set([...spendYtd.keys(), ...revByCode.keys()]);
const rows = [];
for (const code of codes) {
  const ads = adsByCode.get(code) || [];
  const active = ads.filter(a => a.effective_status === 'ACTIVE').length;
  const paused = ads.filter(a => a.effective_status === 'PAUSED').length;
  const archived = ads.filter(a => /ARCHIVED|DELETED|DISAPPROVED/.test(a.effective_status)).length;
  const ytdSpend = spendYtd.get(code) || 0;
  const sp30 = spend30d.get(code) || 0;
  const regs = Math.round(regsYtd.get(code) || 0);
  const revenue = revByCode.get(code) || 0;
  const paid = paidByCode.get(code)?.size || 0;
  rows.push({
    code, ytdSpend, spend30d: sp30, regs, revenue, paid,
    roas: ytdSpend > 0 ? revenue / ytdSpend : null,
    cpr: regs > 0 ? ytdSpend / regs : null,
    cps: paid > 0 ? ytdSpend / paid : null,
    activeAds: active, pausedAds: paused, archivedAds: archived,
    isAlive: active > 0,
  });
}
rows.sort((a, b) => b.ytdSpend - a.ytdSpend);

// ---- classification ----
function classify(r) {
  if (r.ytdSpend < 500_000 && r.regs < 3) return 'TINY';
  if (!r.isAlive) return r.roas != null && r.roas >= 1.5 ? 'HIST-WINNER-PAUSED' : 'DEAD';
  if (r.spend30d < 200_000) return 'ALIVE-LOW-SPEND';
  if (r.paid === 0 && r.spend30d >= 500_000) return 'PAUSE-NOW';
  if (r.roas != null && r.roas >= 1.5) return 'SCALE';
  if (r.roas != null && r.roas >= 1.0) return 'HOLD-PROFITABLE';
  if (r.roas != null && r.roas >= 0.5) return 'WATCH';
  return 'PAUSE-NOW';
}
for (const r of rows) r.action = classify(r);

// ============== OUTPUT ==============
const totSpend30d = rows.reduce((s, r) => s + r.spend30d, 0);
console.log('Attribution: Getfly ads_code · revenue = approved order real_amount');
console.log(`Last-30-day total spend: ${totSpend30d.toLocaleString()} VND across ${rows.filter(r => r.spend30d > 0).length} codes`);

const groups = {};
for (const r of rows) (groups[r.action] = groups[r.action] || []).push(r);

function show(label, list, full) {
  if (!list?.length) return;
  console.log(`\n${'='.repeat(80)}\n${label}\n${'='.repeat(80)}`);
  if (full) {
    console.log('code'.padEnd(22) + '| YTDspend  | 30dspend  | regs | paid | rev      | ROAS | active');
    console.log('-'.repeat(95));
    list.forEach(r => console.log([
      r.code.slice(0, 21).padEnd(21),
      (r.ytdSpend | 0).toLocaleString().padStart(10),
      (r.spend30d | 0).toLocaleString().padStart(10),
      String(r.regs).padStart(5),
      String(r.paid).padStart(4),
      (r.revenue | 0).toLocaleString().padStart(9),
      (r.roas == null ? '—' : r.roas.toFixed(2)).padStart(5),
      String(r.activeAds).padStart(3) + ' ads',
    ].join(' | ')));
  }
  const subSpend30d = list.reduce((s, r) => s + r.spend30d, 0);
  const subRev = list.reduce((s, r) => s + r.revenue, 0);
  console.log(`  → ${list.length} codes  ·  30d spend: ${subSpend30d.toLocaleString()} VND  ·  total revenue: ${subRev.toLocaleString()} VND`);
}

const scaleSorted = (groups.SCALE || []).sort((a, b) => b.roas - a.roas);
const holdSorted = (groups['HOLD-PROFITABLE'] || []).sort((a, b) => b.spend30d - a.spend30d);
const watchSorted = (groups.WATCH || []).sort((a, b) => b.spend30d - a.spend30d);
const pauseSorted = (groups['PAUSE-NOW'] || []).sort((a, b) => b.spend30d - a.spend30d);
const histWinners = (groups['HIST-WINNER-PAUSED'] || []).sort((a, b) => b.revenue - a.revenue);

show('🟢 SCALE — alive, ROAS ≥ 1.5, has spend', scaleSorted, true);
show('🟡 HOLD — alive + profitable (1.0–1.5)', holdSorted, true);
show('🟡 WATCH — alive + breakeven-ish (0.5–1.0)', watchSorted, true);
show('🔴 PAUSE NOW — alive + burning (ROAS<0.5 OR 0 paid + ≥500k spend in 30d)', pauseSorted, true);
show('💤 HISTORICALLY GOOD BUT PAUSED — consider relaunching with fresh creative', histWinners, true);

// === BUDGET REALLOCATION PROPOSAL ===
const pauseSpend30d = pauseSorted.reduce((s, r) => s + r.spend30d, 0);
const scaleSpend30d = scaleSorted.reduce((s, r) => s + r.spend30d, 0);
console.log('\n' + '='.repeat(80));
console.log('💰 BUDGET REALLOCATION PROPOSAL');
console.log('='.repeat(80));
console.log(`Free up by pausing:    ${pauseSpend30d.toLocaleString()} VND/month`);
console.log(`Current SCALE budget:  ${scaleSpend30d.toLocaleString()} VND/month`);
if (scaleSorted.length) {
  console.log('Recommended: redirect freed spend proportionally to SCALE codes by ROAS:\n');
  const totWeights = scaleSorted.reduce((s, r) => s + r.roas * (r.spend30d || 100_000), 0);
  for (const r of scaleSorted.slice(0, 10)) {
    const weight = r.roas * (r.spend30d || 100_000);
    const share = weight / totWeights;
    const newSpend = r.spend30d + Math.round(pauseSpend30d * share);
    const delta = newSpend - r.spend30d;
    console.log(`  ${r.code.padEnd(22)} ROAS ${r.roas.toFixed(2)} | now ${r.spend30d.toLocaleString().padStart(10)} → +${delta.toLocaleString().padStart(9)} = ${newSpend.toLocaleString().padStart(10)} VND/mo`);
  }
}

// === CREATIVE CONTENT for top winners ===
console.log('\n' + '='.repeat(80));
console.log('🎨 WINNING CREATIVE CONTENT (top 15 by ROAS at ≥5M YTD spend, ≥10 regs)');
console.log('='.repeat(80));
const topWinners = rows
  .filter(r => r.ytdSpend >= 5_000_000 && r.regs >= 10 && r.roas != null)
  .sort((a, b) => b.roas - a.roas).slice(0, 15);

for (const r of topWinners) {
  const ads = adsByCode.get(r.code) || [];
  const candidate = ads
    .filter(a => a.creative?.body && a.creative.body.trim())
    .sort((a, b) => (spendByAdId.get(b.ad_id) || 0) - (spendByAdId.get(a.ad_id) || 0))[0]
    || ads.find(a => a.creative);
  if (!candidate?.creative) { console.log(`\n--- ${r.code} (ROAS ${r.roas.toFixed(2)}) — no creative content available ---`); continue; }
  const c = candidate.creative;
  console.log(`\n--- ${r.code} ─ ROAS ${r.roas.toFixed(2)} ─ rev ${(r.revenue | 0).toLocaleString()} VND ─ ${r.activeAds} active ad(s) ─ format ${c.object_type || 'unknown'} ---`);
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
for (const r of pauseSorted.slice(0, 10)) {
  const ads = adsByCode.get(r.code) || [];
  const candidate = ads.filter(a => a.creative?.body)[0] || ads.find(a => a.creative);
  if (!candidate?.creative) { console.log(`\n--- ${r.code} (ROAS ${r.roas?.toFixed(2) || '—'}) — no creative content ---`); continue; }
  const c = candidate.creative;
  console.log(`\n--- ${r.code} ─ ROAS ${r.roas?.toFixed(2) || '—'} ─ spend30d ${r.spend30d.toLocaleString()} ─ paid ${r.paid}/${r.regs} regs ---`);
  console.log(`  Title: ${(c.title || '').slice(0, 200)}`);
  console.log(`  Body:  ${(c.body || '').slice(0, 500).replace(/\s+/g, ' ')}`);
}

fs.writeFileSync('.cache/actionable.json', JSON.stringify({
  totSpend30d, groups: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
  scaleSorted, holdSorted, watchSorted, pauseSorted, histWinners, topWinners,
}, null, 2));
console.log('\nWrote .cache/actionable.json');
