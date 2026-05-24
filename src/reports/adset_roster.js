// Ad-set roster: pick / scale / cut decisions for tomorrow.
//
// For each active ad set, pulls 7d and 28d aggregated insights at adset level,
// derives prior-21d by subtraction, then classifies:
//   PICK    — top N candidates for "ad-set of the day" (low recent CPR + volume)
//   SCALE   — recent CPR ≤ 0.7×target AND ≥5 regs in 7d (clear winner with volume)
//   CUT     — recent 7d burns budget with no output, or recent CPR ≥ 2×target with volume
//   FATIGUE — recent CPR > 1.5× prior CPR (signals creative fatigue per FINDINGS)
//   HOLD    — everything else
//   DEAD    — spent <50k both periods (already paused effectively; suppressed from table)
//
// Target CPR baseline ~350k VND (per FINDINGS.md seasonal_cpr_flat).
//
// Usage:  node src/reports/adset_roster.js
//         REPORT_DATE=2026-05-23 node src/reports/adset_roster.js
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { meta } from '../client.js';
import { loadAttribution } from '../roas/attribution.js';

// ---- CSV → Map(code → {ytd_roas, apr_may_roas, m_2026_05_roas}) ----
function parseCSV(text) {
  const out = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line) continue;
    const cells = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { cells.push(cur); cur = ''; }
        else cur += c;
      }
    }
    cells.push(cur);
    out.push(cells);
  }
  return out;
}
// Local code resolver: prefers the LONGEST code from codeSet that appears as a
// substring of the (campaign + adset) name, after stripping separators. This
// fixes a bug where attribution.js's resolveAd picks the shorter base code
// (e.g. `code83`) when the actual LP-stamped code is the longer xpage variant
// (e.g. `83-xpage-kv`). High-confidence matches (substring) gate ROAS decisions;
// low-confidence (fallback to attribution.resolveAd) doesn't.
function normalizeForMatch(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
// Variant suffixes that appear in real codes (xpage / xp / kv / reup / tg / lt).
// If the corpus contains one but the matched code's normalized form does not,
// the match is incomplete — demote confidence so we don't gate ROAS on it.
const VARIANT_SUFFIXES = ['xpagekv', 'xpage', 'reup', 'kv', 'tg', 'lt', 'xp'];

function smartResolve(adset, campaign, codeSet, fallback) {
  const corpus = normalizeForMatch(`${campaign} ${adset}`);
  let best = null;
  for (const code of codeSet) {
    const cnorm = normalizeForMatch(code);
    if (cnorm.length < 4) continue;  // single digits / short tokens too noisy
    if (corpus.includes(cnorm) && (!best || cnorm.length > best.normLen)) {
      best = { code, normLen: cnorm.length, cnorm };
    }
  }
  if (best) {
    const corpusHasSuffix = VARIANT_SUFFIXES.find(sfx => corpus.includes(sfx));
    const matchHasSuffix = corpusHasSuffix && best.cnorm.includes(corpusHasSuffix);
    return { code: best.code, confidence: (corpusHasSuffix && !matchHasSuffix) ? 'token' : 'substring' };
  }
  if (fallback) {
    const code = fallback({ ad_name_norm: '', adset_name: adset || '', campaign_name: campaign || '' });
    if (code) return { code, confidence: 'token' };
  }
  return { code: null, confidence: null };
}

function loadCodeRoas(p = 'data/roas-codes-ranked.csv') {
  if (!fs.existsSync(p)) return new Map();
  const rows = parseCSV(fs.readFileSync(p, 'utf8'));
  if (rows.length < 2) return new Map();
  const header = rows[0];
  const find = (...candidates) => {
    for (const name of candidates) {
      const i = header.findIndex(h => h.trim() === name);
      if (i >= 0) return i;
    }
    return -1;
  };
  const codeI = find('Code');
  const ytdI = find('YTD ROAS');
  const aprMayI = find('Apr+May ROAS');
  const currMoI = find('2026-05 ROAS', '2026-04 ROAS');
  const m = new Map();
  for (let r = 1; r < rows.length; r++) {
    const code = (rows[r][codeI] || '').trim().toLowerCase();
    if (!code) continue;
    const num = i => { const v = parseFloat(rows[r][i]); return isFinite(v) ? v : null; };
    m.set(code, { ytd_roas: num(ytdI), apr_may_roas: num(aprMayI), curr_mo_roas: num(currMoI) });
  }
  return m;
}

// Fresh per-code ROAS from the cohort drill-down's rolling window. Written by
// src/dashboard/cohort_drilldown.js as data/code-roas-window.json.
function loadWindowRoas(p = 'data/code-roas-window.json') {
  if (!fs.existsSync(p)) return null;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  return { since: j.since, until: j.until, days: j.days, built_at: j.built_at,
    codes: new Map(Object.entries(j.codes || {})) };
}

// Pick the freshest trustworthy ROAS for a code.
//   1. cohort_drilldown window JSON (default 21d) if code has ≥1M spend AND ≥3 reg
//   2. Apr+May aggregate from CSV
//   3. YTD aggregate from CSV
// Returns { roas, window, source } or { roas: null, window: null, source: null }.
function resolveRoas(code, windowMap, csvMap) {
  if (!code) return { roas: null, window: null, source: null };
  const w = windowMap?.codes.get(code);
  if (w && w.spend >= 1_000_000 && w.reg >= 3 && w.roas != null) {
    return { roas: w.roas, window: `${windowMap.days}d window`, source: 'cohort-drilldown' };
  }
  const c = csvMap.get(code);
  if (c?.apr_may_roas != null) return { roas: c.apr_may_roas, window: 'Apr+May', source: 'csv' };
  if (c?.ytd_roas != null) return { roas: c.ytd_roas, window: 'YTD', source: 'csv' };
  // Last resort — fresh window even if thin
  if (w?.roas != null) return { roas: w.roas, window: `${windowMap.days}d window (thin)`, source: 'cohort-drilldown-thin' };
  return { roas: null, window: null, source: null };
}

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
  { id: 'act_1069029708221793', name: 'Kurio 5' },
];

const TARGET_CPR = 350_000;       // VND, baseline from FINDINGS
const SCALE_CPR  = TARGET_CPR * 0.7;   // 245k — clear winner on CPR alone
const CUT_CPR    = TARGET_CPR * 2.0;   // 700k — clear loser on CPR alone
const FATIGUE_RATIO = 1.5;
const MIN_VOL_FOR_CUT = 3;
const MIN_VOL_FOR_SCALE = 5;
const MIN_VOL_FOR_PICK = 3;
const DEAD_FLOOR = 50_000;        // both periods under this → already off-roster
const ZERO_REG_BURN = 500_000;    // 7d spend with 0 reg → cut
// ROAS gates (per code, Apr+May aggregate from data/roas-codes-ranked.csv).
// Apr+May was chosen as the stable signal: 2 months of maturation, attribution
// rate is healthy (~60% per FINDINGS), spans the post-IKMC window.
const SCALE_ROAS_MIN = 0.7;       // below this → don't scale, hold and verify
const CUT_ROAS_MAX = 0.4;         // below this + cheap CPR → cheap-junk leads, CUT
const REG_TYPE = 'complete_registration';
const fmt = n => Math.round(n).toLocaleString('en-US');

const iso = d => d.toISOString().slice(0, 10);
const TODAY = process.env.REPORT_TODAY || iso(new Date());
const YDAY  = process.env.REPORT_DATE || iso(new Date(Date.parse(TODAY) - 86400_000));
const D7_SINCE  = iso(new Date(Date.parse(YDAY) - 6 * 86400_000));
const D28_SINCE = iso(new Date(Date.parse(YDAY) - 27 * 86400_000));

async function fetchAggregate(accId, since, until) {
  const rows = await meta.getAll(`/${accId}/insights`, {
    level: 'adset',
    fields: 'adset_id,adset_name,campaign_id,campaign_name,spend,impressions,actions',
    time_range: { since, until },
    limit: 500,
  });
  const m = new Map();
  for (const r of rows) {
    const reg = +((r.actions || []).find(a => a.action_type === REG_TYPE)?.value || 0);
    m.set(r.adset_id, {
      adset_id: r.adset_id,
      adset_name: r.adset_name,
      campaign_name: r.campaign_name,
      spend: +r.spend || 0,
      reg,
      impressions: +r.impressions || 0,
    });
  }
  return m;
}

const main = async () => {
  console.error(`Ad-set roster — yesterday=${YDAY}`);
  console.error(`  7d window:  ${D7_SINCE} .. ${YDAY}`);
  console.error(`  28d window: ${D28_SINCE} .. ${YDAY}\n`);

  // ---- optional ROAS overlay (code-level ROAS, fresh window preferred) ----
  let codeSet = null, fallbackResolve = null;
  let codeRoas = new Map();
  let windowRoas = null;
  try {
    const attr = loadAttribution();
    codeSet = attr.codeSet;
    fallbackResolve = attr.resolveAd;
    codeRoas = loadCodeRoas();
    windowRoas = loadWindowRoas();
    if (windowRoas) {
      console.error(`ROAS overlay loaded: ${windowRoas.codes.size} codes from data/code-roas-window.json (${windowRoas.days}d, ${windowRoas.since} → ${windowRoas.until})  +  ${codeRoas.size} codes from data/roas-codes-ranked.csv (Apr+May / YTD fallback)\n`);
    } else {
      console.error(`ROAS overlay loaded: ${codeRoas.size} codes from data/roas-codes-ranked.csv (Apr+May / YTD). For fresh 21d ROAS, run: node src/dashboard/cohort_drilldown.js\n`);
    }
  } catch (e) {
    console.error(`ROAS overlay UNAVAILABLE (${e.message.slice(0, 80)}). Classifier will run on CPR only.\n`);
  }

  const all = [];
  for (const acc of ACCOUNTS) {
    console.error(`Fetching ${acc.name} ...`);
    let d7, d28;
    try {
      d7  = await fetchAggregate(acc.id, D7_SINCE, YDAY);
      d28 = await fetchAggregate(acc.id, D28_SINCE, YDAY);
    } catch (e) { console.error(`  ${acc.name} ERR: ${e.message}`); continue; }
    const ids = new Set([...d7.keys(), ...d28.keys()]);
    console.error(`  ${ids.size} ad sets`);
    for (const id of ids) {
      const r7 = d7.get(id);
      const r28 = d28.get(id);
      const base = r7 || r28;
      const s7  = r7?.spend  || 0,  reg7  = r7?.reg  || 0;
      const s28 = r28?.spend || 0,  reg28 = r28?.reg || 0;
      const sP  = Math.max(0, s28 - s7);
      const regP = Math.max(0, reg28 - reg7);
      const resolved = codeSet
        ? smartResolve(base.adset_name, base.campaign_name, codeSet, fallbackResolve)
        : { code: null, confidence: null };
      const rr = resolveRoas(resolved.code, windowRoas, codeRoas);
      all.push({
        account: acc.name,
        adset_id: id,
        adset_name: base.adset_name,
        campaign_name: base.campaign_name,
        spend_7d: s7, reg_7d: reg7,
        spend_prior: sP, reg_prior: regP,
        spend_28d: s28, reg_28d: reg28,
        cpr_7d: reg7 ? s7 / reg7 : null,
        cpr_prior: regP ? sP / regP : null,
        cpr_28d: reg28 ? s28 / reg28 : null,
        code: resolved.code,
        code_confidence: resolved.confidence,
        code_roas: rr.roas,
        code_roas_window: rr.window,
        code_roas_source: rr.source,
      });
    }
  }

  // Classify — CPR-based, with ROAS overlay when the adset's code has data
  const classify = a => {
    if (a.spend_7d < DEAD_FLOOR && a.spend_prior < DEAD_FLOOR) return { tag: 'DEAD', note: 'both periods <50k' };
    if (a.reg_7d === 0 && a.spend_7d >= ZERO_REG_BURN) return { tag: 'CUT', note: `0 reg burning ${fmt(a.spend_7d)}` };
    if (a.cpr_7d != null && a.cpr_7d >= CUT_CPR && a.reg_7d >= MIN_VOL_FOR_CUT) return { tag: 'CUT', note: `CPR ${fmt(a.cpr_7d)} ≥ 2×target` };

    const cheapWithVol = a.cpr_7d != null && a.cpr_7d <= SCALE_CPR && a.reg_7d >= MIN_VOL_FOR_SCALE;
    // ROAS gating only applies on HIGH-confidence code matches. Token-fallback
    // resolutions are too easy to get wrong (e.g. `code83+86_reup` → `code83`
    // instead of `code83-reup`) — gating on those would mis-classify winners.
    const roasIsTrustworthy = cheapWithVol && a.code_roas != null && a.code_confidence === 'substring';
    if (roasIsTrustworthy && a.code_roas < CUT_ROAS_MAX) {
      return { tag: 'CUT', note: `cheap CPR ${fmt(a.cpr_7d)} but code "${a.code}" ROAS ${a.code_roas.toFixed(2)} (${a.code_roas_window}) — junk leads` };
    }
    if (roasIsTrustworthy && a.code_roas < SCALE_ROAS_MIN) {
      return { tag: 'WATCH', note: `CPR ${fmt(a.cpr_7d)} good but code "${a.code}" ROAS ${a.code_roas.toFixed(2)} (${a.code_roas_window}) — verify before scaling` };
    }
    if (cheapWithVol) {
      const roasNote = a.code_roas != null
        ? `, ROAS ${a.code_roas.toFixed(2)}${a.code_confidence === 'token' ? '?' : ''}`
        : (a.code ? `, ROAS n/a` : '');
      return { tag: 'SCALE', note: `CPR ${fmt(a.cpr_7d)} ≤ 245k, ${a.reg_7d} reg${roasNote}` };
    }
    if (a.cpr_7d != null && a.cpr_prior != null && a.reg_7d >= 3 && a.reg_prior >= 3 && a.cpr_7d > a.cpr_prior * FATIGUE_RATIO) {
      return { tag: 'FATIGUE', note: `CPR ${fmt(a.cpr_prior)} → ${fmt(a.cpr_7d)} (×${(a.cpr_7d / a.cpr_prior).toFixed(2)})` };
    }
    return { tag: 'HOLD', note: '' };
  };
  for (const a of all) Object.assign(a, classify(a));

  const live = all.filter(a => a.tag !== 'DEAD');
  const byTag = g => live.filter(a => a.tag === g).sort((x, y) => y.spend_7d - x.spend_7d);

  const P = s => console.log(s);
  const line = '='.repeat(108);

  // ===== PICKS for tomorrow =====
  // Blended score = (target_cpr / cpr_7d) * (1 + code_roas).
  // Lower CPR → higher score. Known good ROAS amplifies. Unknown ROAS = neutral (×1).
  // Known bad ROAS is already filtered out (those are CUT or WATCH).
  const pickScore = a => (TARGET_CPR / a.cpr_7d) * (1 + (a.code_roas ?? 0));
  const pickable = live.filter(a => a.cpr_7d != null && a.reg_7d >= MIN_VOL_FOR_PICK
    && a.tag !== 'CUT' && a.tag !== 'FATIGUE' && a.tag !== 'WATCH')
    .sort((x, y) => pickScore(y) - pickScore(x));
  P(line);
  P(`  AD-SETS OF THE DAY — top 5 lowest 7d CPR (min ${MIN_VOL_FOR_PICK} reg) — candidates to scale tomorrow`);
  P(line);
  P('  ' + 'rank  campaign / adset'.padEnd(72) + 'acct'.padEnd(8) + ' ' +
    '7d spd'.padStart(8) + ' ' + 'reg'.padStart(4) + ' ' + '7d CPR'.padStart(8) + '  tag');
  P('  ' + '-'.repeat(104));
  pickable.slice(0, 5).forEach((a, i) => {
    P('  ' + String(i + 1).padStart(4) + '  ' +
      `${a.campaign_name || ''}  ›  ${a.adset_name || ''}`.slice(0, 68).padEnd(70) + ' ' +
      a.account.padEnd(8) + ' ' +
      fmt(a.spend_7d).padStart(8) + ' ' +
      String(a.reg_7d).padStart(4) + ' ' +
      fmt(a.cpr_7d).padStart(8) + '  ' + a.tag);
  });

  // ===== Each bucket =====
  const printGroup = (label, list, maxRows = 30) => {
    P('');
    P(line);
    P(`  ${label}  (${list.length})`);
    P(line);
    if (!list.length) { P('  (none)'); return; }
    P('  ' + 'campaign / adset'.padEnd(72) + 'acct'.padEnd(8) + ' ' +
      '7d spd'.padStart(8) + ' ' + 'reg'.padStart(4) + ' ' + '7d CPR'.padStart(8) + '  reason');
    P('  ' + '-'.repeat(104));
    for (const a of list.slice(0, maxRows)) {
      P('  ' + `${a.campaign_name || ''}  ›  ${a.adset_name || ''}`.slice(0, 70).padEnd(72) +
        a.account.padEnd(8) + ' ' +
        fmt(a.spend_7d).padStart(8) + ' ' +
        String(a.reg_7d).padStart(4) + ' ' +
        (a.cpr_7d != null ? fmt(a.cpr_7d) : '—').padStart(8) + '  ' + a.note);
    }
    if (list.length > maxRows) P(`  ... +${list.length - maxRows} more`);
  };
  printGroup('SCALE — increase budget tomorrow', byTag('SCALE'));
  printGroup('WATCH — cheap CPR but ROAS marginal — verify before scaling', byTag('WATCH'));
  printGroup('CUT — pause / kill', byTag('CUT'));
  printGroup('FATIGUE — refresh creative (CPR drift > 1.5×)', byTag('FATIGUE'));

  const hold = byTag('HOLD');
  P('');
  P(line);
  P(`  HOLD  (${hold.length}) — within target band; leave alone`);
  P(line);

  // ===== Summary =====
  const totSpend7d = live.reduce((s, a) => s + a.spend_7d, 0);
  const totReg7d = live.reduce((s, a) => s + a.reg_7d, 0);
  P('');
  P(line);
  P('  SUMMARY');
  P(line);
  P(`  Live ad sets (>=50k either period):  ${live.length}`);
  P(`  Of which: SCALE ${byTag('SCALE').length}  |  WATCH ${byTag('WATCH').length}  |  CUT ${byTag('CUT').length}  |  FATIGUE ${byTag('FATIGUE').length}  |  HOLD ${hold.length}`);
  const withRoas = live.filter(a => a.code_roas != null).length;
  P(`  ROAS coverage: ${withRoas}/${live.length} live ad sets have code-level ROAS (${Math.round(withRoas / live.length * 100)}%)`);
  P(`  Dropped (DEAD):  ${all.length - live.length}`);
  P(`  7d totals:  spend ${fmt(totSpend7d)} VND  |  reg ${totReg7d}  |  blended CPR ${totReg7d ? fmt(totSpend7d / totReg7d) : '—'} VND`);
  P(`  Target CPR baseline: ${fmt(TARGET_CPR)} VND  (scale ≤${fmt(SCALE_CPR)} ; cut ≥${fmt(CUT_CPR)})`);

  // ---------- write snapshots ----------
  const ctx = { all, live, byTag, pickable, totSpend7d, totReg7d, YDAY, D7_SINCE, D28_SINCE,
    TARGET_CPR, SCALE_CPR, CUT_CPR };
  const OUT_MD = process.env.ROSTER_OUT || `data/roster-${YDAY}.md`;
  const OUT_HTML = process.env.ROSTER_OUT_HTML || `data/roster-${YDAY}.html`;
  const OUT_JSON = process.env.ROSTER_OUT_JSON || `data/roster-${YDAY}.json`;
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_MD, renderMarkdown(ctx));
  fs.writeFileSync(OUT_HTML, renderHtml(ctx));
  fs.writeFileSync(OUT_JSON, JSON.stringify({
    yday: YDAY, d7_since: D7_SINCE, d28_since: D28_SINCE,
    target_cpr: TARGET_CPR, scale_cpr: SCALE_CPR, cut_cpr: CUT_CPR,
    scale_roas_min: SCALE_ROAS_MIN, cut_roas_max: CUT_ROAS_MAX,
    roas_coverage: { with_roas: live.filter(a => a.code_roas != null).length, total_live: live.length },
    summary: {
      live: live.length, scale: byTag('SCALE').length, watch: byTag('WATCH').length,
      cut: byTag('CUT').length, fatigue: byTag('FATIGUE').length, hold: byTag('HOLD').length,
      dead: all.length - live.length, spend_7d: totSpend7d, reg_7d: totReg7d,
    },
    picks: pickable.slice(0, 5).map(({ tag, note, ...rest }) => rest),
    scale: byTag('SCALE'), watch: byTag('WATCH'), cut: byTag('CUT'), fatigue: byTag('FATIGUE'),
  }, null, 2));
  console.error(`\nDone. Snapshots written to:\n  ${OUT_MD}\n  ${OUT_HTML}\n  ${OUT_JSON}`);
};

function renderMarkdown({ all, live, byTag, pickable, totSpend7d, totReg7d, YDAY, D7_SINCE, D28_SINCE }) {
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const roasStr = a => a.code_roas != null ? a.code_roas.toFixed(2) : (a.code ? '—' : 'n/a');
  const escape = s => String(s || '').replace(/\|/g, '\\|');
  const row = a => `| ${escape(`${a.campaign_name || ''} › ${a.adset_name || ''}`)} | ${escape(a.account)} | ${escape(a.code || '—')} | ${fmt(a.spend_7d)} | ${a.reg_7d} | ${a.cpr_7d != null ? fmt(a.cpr_7d) : '—'} | ${roasStr(a)} |`;
  const rowWithReason = a => `${row(a)} ${escape(a.note)} |`;
  const scale = byTag('SCALE'), watch = byTag('WATCH'), cut = byTag('CUT'), fatigue = byTag('FATIGUE'), hold = byTag('HOLD');
  const dead = all.length - live.length;
  const withRoas = live.filter(a => a.code_roas != null).length;
  return `# Ad-set roster — ${YDAY}

Window: 7d (${D7_SINCE} → ${YDAY}) and 28d (${D28_SINCE} → ${YDAY}).
Generated by [src/reports/adset_roster.js](../src/reports/adset_roster.js).

## Summary

- Live ad sets (≥50k either period): **${live.length}**
- SCALE: **${scale.length}** · WATCH: **${watch.length}** · CUT: **${cut.length}** · FATIGUE: **${fatigue.length}** · HOLD: ${hold.length} · Dropped (DEAD): ${dead}
- 7d totals: spend **${fmt(totSpend7d)} VND** · reg **${totReg7d}** · blended CPR **${totReg7d ? fmt(totSpend7d / totReg7d) : '—'} VND**
- ROAS overlay: ${withRoas}/${live.length} live ad sets carry code-level ROAS (Apr+May aggregate). SCALE requires ROAS ≥ 0.7 when known. WATCH = cheap CPR but ROAS in 0.4–0.7. Cheap CPR + ROAS < 0.4 escalates to CUT (junk leads).

---

## AD-SETS OF THE DAY — top 5 by blended score (lower CPR × higher ROAS, ≥3 reg)

| Rank | Campaign / Adset | Acct | Code | 7d spend | Reg | 7d CPR | ROAS |
|---:|---|---|---|---:|---:|---:|---:|
${pickable.slice(0, 5).map((a, i) => `| ${i + 1} | ${escape(`${a.campaign_name || ''} › ${a.adset_name || ''}`)} | ${escape(a.account)} | ${escape(a.code || '—')} | ${fmt(a.spend_7d)} | ${a.reg_7d} | ${fmt(a.cpr_7d)} | ${roasStr(a)} |`).join('\n')}

---

## SCALE (${scale.length}) — increase budget tomorrow

| Campaign / Adset | Acct | Code | 7d spend | Reg | 7d CPR | ROAS |
|---|---|---|---:|---:|---:|---:|
${scale.map(row).join('\n') || '| (none) | | | | | | |'}

---

## WATCH (${watch.length}) — cheap CPR but code ROAS marginal (0.4–0.7) — verify before scaling

| Campaign / Adset | Acct | Code | 7d spend | Reg | 7d CPR | ROAS | Reason |
|---|---|---|---:|---:|---:|---:|---|
${watch.map(rowWithReason).join('\n') || '| (none) | | | | | | | |'}

---

## CUT (${cut.length}) — pause / kill

| Campaign / Adset | Acct | Code | 7d spend | Reg | 7d CPR | ROAS | Reason |
|---|---|---|---:|---:|---:|---:|---|
${cut.map(rowWithReason).join('\n') || '| (none) | | | | | | | |'}

---

## FATIGUE (${fatigue.length}) — refresh creative (CPR drift > 1.5×)

| Campaign / Adset | Acct | Code | 7d spend | Reg | 7d CPR | ROAS | Drift |
|---|---|---|---:|---:|---:|---:|---|
${fatigue.map(rowWithReason).join('\n') || '| (none) | | | | | | | |'}

---

## HOLD (${hold.length})

Within target band — leave alone.
`;
}

function renderHtml({ all, live, byTag, pickable, totSpend7d, totReg7d, YDAY, D7_SINCE, D28_SINCE, TARGET_CPR, SCALE_CPR, CUT_CPR }) {
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const scale = byTag('SCALE'), watch = byTag('WATCH'), cut = byTag('CUT'), fatigue = byTag('FATIGUE'), hold = byTag('HOLD');
  const dead = all.length - live.length;
  const blended = totReg7d ? totSpend7d / totReg7d : 0;
  const acctClass = a => a === 'Kurio 2' ? 'k2' : a === 'Kurio 3' ? 'k3' : 'k5';
  const cprClass = c => c == null ? '' : c <= SCALE_CPR ? 'good' : c >= CUT_CPR ? 'bad' : c > TARGET_CPR ? 'warn' : '';
  const roasClass = r => r == null ? 'muted' : r >= 0.9 ? 'good' : r < 0.4 ? 'bad' : r < 0.7 ? 'warn' : '';
  const roasCell = a => a.code_roas != null
    ? `<td class="num ${roasClass(a.code_roas)}" title="${esc(a.code_roas_window || '')} ROAS for code ${esc(a.code || '')}">${a.code_roas.toFixed(2)}</td>`
    : `<td class="num muted">${a.code ? '—' : 'n/a'}</td>`;
  const row = (a, extra) => `<tr>
    <td>${esc(a.campaign_name || '')} <span class="muted">›</span> ${esc(a.adset_name || '')}</td>
    <td><span class="acct ${acctClass(a.account)}">${esc(a.account)}</span></td>
    <td class="muted code">${esc(a.code || '—')}</td>
    <td class="num">${fmt(a.spend_7d)}</td>
    <td class="num">${a.reg_7d}</td>
    <td class="num ${cprClass(a.cpr_7d)}">${a.cpr_7d != null ? fmt(a.cpr_7d) : '—'}</td>
    ${roasCell(a)}${extra || ''}
  </tr>`;

  const tableHead = withReason => `<thead><tr>
    <th>Campaign / Adset</th><th>Acct</th><th>Code</th><th class="num">7d spend</th><th class="num">Reg</th><th class="num">7d CPR</th><th class="num">ROAS</th>${withReason ? '<th>Reason</th>' : ''}
  </tr></thead>`;

  const section = (id, title, list, tag, withReason) => `
  <section id="${id}" class="bucket bucket-${tag.toLowerCase()}">
    <h2><span class="tag tag-${tag.toLowerCase()}">${tag}</span> ${esc(title)} <span class="muted">(${list.length})</span></h2>
    ${list.length ? `<table>${tableHead(withReason)}<tbody>${list.map(a => row(a, withReason ? `<td class="muted">${esc(a.note)}</td>` : '')).join('')}</tbody></table>` : '<p class="muted">(none)</p>'}
  </section>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ad-set roster — ${esc(YDAY)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif; margin: 0; padding: 24px 32px; background: #f6f7f9; color: #1f2937; max-width: 1200px; margin-inline: auto; }
  @media (prefers-color-scheme: dark) { body { background: #0f172a; color: #e2e8f0; } table { background: #1e293b; } th { background: #0b1220 !important; } tr:hover { background: #1e3a5f !important; } .summary { background: #1e293b !important; } .muted { color: #94a3b8 !important; } }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; display: flex; align-items: center; gap: 10px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 16px; }
  .summary { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
  .stat { display: flex; flex-direction: column; }
  .stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
  .stat .value { font-size: 18px; font-weight: 600; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; background: #fff; font-size: 13px; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
  th, td { padding: 7px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
  th { background: #f3f4f6; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #4b5563; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:hover { background: #f9fafb; }
  .muted { color: #9ca3af; }
  .num.good { color: #15803d; font-weight: 600; }
  .num.warn { color: #b45309; }
  .num.bad  { color: #b91c1c; font-weight: 600; }
  .acct { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .acct.k2 { background: #dbeafe; color: #1e40af; }
  .acct.k3 { background: #dcfce7; color: #166534; }
  .acct.k5 { background: #fef3c7; color: #92400e; }
  .tag { display: inline-block; padding: 2px 9px; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
  .tag-pick    { background: #10b981; color: white; }
  .tag-scale   { background: #3b82f6; color: white; }
  .tag-watch   { background: #a855f7; color: white; }
  .tag-cut     { background: #ef4444; color: white; }
  .tag-fatigue { background: #f59e0b; color: white; }
  .tag-hold    { background: #9ca3af; color: white; }
  .code        { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11.5px; }
  .nav { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 4px; }
  .nav a { padding: 4px 10px; background: #e5e7eb; color: #1f2937; text-decoration: none; border-radius: 4px; font-size: 12px; font-weight: 500; }
  .nav a:hover { background: #d1d5db; }
  .rank { display: inline-block; width: 22px; height: 22px; border-radius: 50%; background: #10b981; color: white; text-align: center; font-weight: 700; font-size: 12px; line-height: 22px; margin-right: 8px; }
  @media print { body { background: white; } table { box-shadow: none; } .nav { display: none; } }
</style>
</head>
<body>
<h1>Ad-set roster — ${esc(YDAY)}</h1>
<p class="meta">7d window <strong>${esc(D7_SINCE)} → ${esc(YDAY)}</strong> · 28d window <strong>${esc(D28_SINCE)} → ${esc(YDAY)}</strong> · target CPR <strong>${fmt(TARGET_CPR)}</strong> VND (scale ≤${fmt(SCALE_CPR)}, cut ≥${fmt(CUT_CPR)})</p>

<div class="summary">
  <div class="stat"><span class="label">Live ad sets</span><span class="value">${live.length}</span></div>
  <div class="stat"><span class="label">SCALE</span><span class="value">${scale.length}</span></div>
  <div class="stat"><span class="label">WATCH</span><span class="value">${watch.length}</span></div>
  <div class="stat"><span class="label">CUT</span><span class="value">${cut.length}</span></div>
  <div class="stat"><span class="label">FATIGUE</span><span class="value">${fatigue.length}</span></div>
  <div class="stat"><span class="label">HOLD</span><span class="value">${hold.length}</span></div>
  <div class="stat"><span class="label">Dropped</span><span class="value">${dead}</span></div>
  <div class="stat"><span class="label">7d spend</span><span class="value">${fmt(totSpend7d)}</span></div>
  <div class="stat"><span class="label">7d reg</span><span class="value">${totReg7d}</span></div>
  <div class="stat"><span class="label">Blended CPR</span><span class="value ${cprClass(blended)}">${fmt(blended)}</span></div>
</div>

<nav class="nav">
  <a href="#pick">Picks</a>
  <a href="#scale">SCALE</a>
  <a href="#watch">WATCH</a>
  <a href="#cut">CUT</a>
  <a href="#fatigue">FATIGUE</a>
  <a href="#hold">HOLD</a>
</nav>

<section id="pick" class="bucket">
  <h2><span class="tag tag-pick">PICK</span> Ad-sets of the day — top 5 by blended (low CPR × high ROAS) score, ≥3 reg</h2>
  <table>${tableHead(false)}<tbody>
    ${pickable.slice(0, 5).map((a, i) => `<tr>
      <td><span class="rank">${i + 1}</span>${esc(a.campaign_name || '')} <span class="muted">›</span> ${esc(a.adset_name || '')}</td>
      <td><span class="acct ${acctClass(a.account)}">${esc(a.account)}</span></td>
      <td class="muted code">${esc(a.code || '—')}</td>
      <td class="num">${fmt(a.spend_7d)}</td>
      <td class="num">${a.reg_7d}</td>
      <td class="num ${cprClass(a.cpr_7d)}">${fmt(a.cpr_7d)}</td>
      ${roasCell(a)}
    </tr>`).join('')}
  </tbody></table>
</section>

${section('scale', 'SCALE — increase budget tomorrow', scale, 'SCALE', false)}
${section('watch', 'WATCH — cheap CPR but code ROAS marginal (0.4–0.7) — verify before scaling', watch, 'WATCH', true)}
${section('cut', 'CUT — pause / kill', cut, 'CUT', true)}
${section('fatigue', 'FATIGUE — refresh creative (CPR drift > 1.5×)', fatigue, 'FATIGUE', true)}

<section id="hold" class="bucket">
  <h2><span class="tag tag-hold">HOLD</span> Within target band — leave alone <span class="muted">(${hold.length})</span></h2>
  <p class="muted">Suppressed from this view — see the markdown snapshot or re-run with the full table needed.</p>
</section>

<p class="meta" style="margin-top: 32px;">Generated by <code>src/reports/adset_roster.js</code>.</p>
</body>
</html>`;
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
