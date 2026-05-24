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

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
  { id: 'act_1069029708221793', name: 'Kurio 5' },
];

const TARGET_CPR = 350_000;       // VND, baseline from FINDINGS
const SCALE_CPR  = TARGET_CPR * 0.7;   // 245k — clear winner
const CUT_CPR    = TARGET_CPR * 2.0;   // 700k — clear loser
const FATIGUE_RATIO = 1.5;
const MIN_VOL_FOR_CUT = 3;
const MIN_VOL_FOR_SCALE = 5;
const MIN_VOL_FOR_PICK = 3;
const DEAD_FLOOR = 50_000;        // both periods under this → already off-roster
const ZERO_REG_BURN = 500_000;    // 7d spend with 0 reg → cut
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
      });
    }
  }

  // Classify
  const classify = a => {
    if (a.spend_7d < DEAD_FLOOR && a.spend_prior < DEAD_FLOOR) return { tag: 'DEAD', note: 'both periods <50k' };
    if (a.reg_7d === 0 && a.spend_7d >= ZERO_REG_BURN) return { tag: 'CUT', note: `0 reg burning ${fmt(a.spend_7d)}` };
    if (a.cpr_7d != null && a.cpr_7d >= CUT_CPR && a.reg_7d >= MIN_VOL_FOR_CUT) return { tag: 'CUT', note: `CPR ${fmt(a.cpr_7d)} ≥ 2×target` };
    if (a.cpr_7d != null && a.cpr_7d <= SCALE_CPR && a.reg_7d >= MIN_VOL_FOR_SCALE) return { tag: 'SCALE', note: `CPR ${fmt(a.cpr_7d)} ≤ 245k, ${a.reg_7d} reg` };
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
  const pickable = live.filter(a => a.cpr_7d != null && a.reg_7d >= MIN_VOL_FOR_PICK && a.tag !== 'CUT' && a.tag !== 'FATIGUE')
    .sort((x, y) => x.cpr_7d - y.cpr_7d);
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
  P(`  Of which: SCALE ${byTag('SCALE').length}  |  CUT ${byTag('CUT').length}  |  FATIGUE ${byTag('FATIGUE').length}  |  HOLD ${hold.length}`);
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
    summary: {
      live: live.length, scale: byTag('SCALE').length, cut: byTag('CUT').length,
      fatigue: byTag('FATIGUE').length, hold: byTag('HOLD').length, dead: all.length - live.length,
      spend_7d: totSpend7d, reg_7d: totReg7d,
    },
    picks: pickable.slice(0, 5).map(({ tag, note, ...rest }) => rest),
    scale: byTag('SCALE'), cut: byTag('CUT'), fatigue: byTag('FATIGUE'),
  }, null, 2));
  console.error(`\nDone. Snapshots written to:\n  ${OUT_MD}\n  ${OUT_HTML}\n  ${OUT_JSON}`);
};

function renderMarkdown({ all, live, byTag, pickable, totSpend7d, totReg7d, YDAY, D7_SINCE, D28_SINCE }) {
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const escape = s => String(s || '').replace(/\|/g, '\\|');
  const row = a => `| ${escape(`${a.campaign_name || ''} › ${a.adset_name || ''}`)} | ${escape(a.account)} | ${fmt(a.spend_7d)} | ${a.reg_7d} | ${a.cpr_7d != null ? fmt(a.cpr_7d) : '—'} |`;
  const rowWithReason = a => `${row(a)} ${escape(a.note)} |`;
  const scale = byTag('SCALE'), cut = byTag('CUT'), fatigue = byTag('FATIGUE'), hold = byTag('HOLD');
  const dead = all.length - live.length;
  return `# Ad-set roster — ${YDAY}

Window: 7d (${D7_SINCE} → ${YDAY}) and 28d (${D28_SINCE} → ${YDAY}).
Generated by [src/reports/adset_roster.js](../src/reports/adset_roster.js).

## Summary

- Live ad sets (≥50k either period): **${live.length}**
- SCALE: **${scale.length}** · CUT: **${cut.length}** · FATIGUE: **${fatigue.length}** · HOLD: ${hold.length} · Dropped (DEAD): ${dead}
- 7d totals: spend **${fmt(totSpend7d)} VND** · reg **${totReg7d}** · blended CPR **${totReg7d ? fmt(totSpend7d / totReg7d) : '—'} VND**

---

## AD-SETS OF THE DAY — top 5 lowest 7d CPR (≥3 reg)

| Rank | Campaign / Adset | Acct | 7d spend | Reg | 7d CPR |
|---:|---|---|---:|---:|---:|
${pickable.slice(0, 5).map((a, i) => `| ${i + 1} | ${escape(`${a.campaign_name || ''} › ${a.adset_name || ''}`)} | ${escape(a.account)} | ${fmt(a.spend_7d)} | ${a.reg_7d} | ${fmt(a.cpr_7d)} |`).join('\n')}

---

## SCALE (${scale.length}) — increase budget tomorrow

| Campaign / Adset | Acct | 7d spend | Reg | 7d CPR |
|---|---|---:|---:|---:|
${scale.map(row).join('\n') || '| (none) | | | | |'}

---

## CUT (${cut.length}) — pause / kill

| Campaign / Adset | Acct | 7d spend | Reg | 7d CPR | Reason |
|---|---|---:|---:|---:|---|
${cut.map(rowWithReason).join('\n') || '| (none) | | | | | |'}

---

## FATIGUE (${fatigue.length}) — refresh creative (CPR drift > 1.5×)

| Campaign / Adset | Acct | 7d spend | Reg | 7d CPR | Drift |
|---|---|---:|---:|---:|---|
${fatigue.map(rowWithReason).join('\n') || '| (none) | | | | | |'}

---

## HOLD (${hold.length})

Within target band — leave alone.
`;
}

function renderHtml({ all, live, byTag, pickable, totSpend7d, totReg7d, YDAY, D7_SINCE, D28_SINCE, TARGET_CPR, SCALE_CPR, CUT_CPR }) {
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const scale = byTag('SCALE'), cut = byTag('CUT'), fatigue = byTag('FATIGUE'), hold = byTag('HOLD');
  const dead = all.length - live.length;
  const blended = totReg7d ? totSpend7d / totReg7d : 0;
  const acctClass = a => a === 'Kurio 2' ? 'k2' : a === 'Kurio 3' ? 'k3' : 'k5';
  const cprClass = c => c == null ? '' : c <= SCALE_CPR ? 'good' : c >= CUT_CPR ? 'bad' : c > TARGET_CPR ? 'warn' : '';
  const row = (a, extra) => `<tr>
    <td>${esc(a.campaign_name || '')} <span class="muted">›</span> ${esc(a.adset_name || '')}</td>
    <td><span class="acct ${acctClass(a.account)}">${esc(a.account)}</span></td>
    <td class="num">${fmt(a.spend_7d)}</td>
    <td class="num">${a.reg_7d}</td>
    <td class="num ${cprClass(a.cpr_7d)}">${a.cpr_7d != null ? fmt(a.cpr_7d) : '—'}</td>${extra || ''}
  </tr>`;

  const tableHead = withReason => `<thead><tr>
    <th>Campaign / Adset</th><th>Acct</th><th class="num">7d spend</th><th class="num">Reg</th><th class="num">7d CPR</th>${withReason ? '<th>Reason</th>' : ''}
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
  .tag-cut     { background: #ef4444; color: white; }
  .tag-fatigue { background: #f59e0b; color: white; }
  .tag-hold    { background: #9ca3af; color: white; }
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
  <a href="#cut">CUT</a>
  <a href="#fatigue">FATIGUE</a>
  <a href="#hold">HOLD</a>
</nav>

<section id="pick" class="bucket">
  <h2><span class="tag tag-pick">PICK</span> Ad-sets of the day — top 5 lowest 7d CPR (≥3 reg)</h2>
  <table>${tableHead(false)}<tbody>
    ${pickable.slice(0, 5).map((a, i) => `<tr>
      <td><span class="rank">${i + 1}</span>${esc(a.campaign_name || '')} <span class="muted">›</span> ${esc(a.adset_name || '')}</td>
      <td><span class="acct ${acctClass(a.account)}">${esc(a.account)}</span></td>
      <td class="num">${fmt(a.spend_7d)}</td>
      <td class="num">${a.reg_7d}</td>
      <td class="num ${cprClass(a.cpr_7d)}">${fmt(a.cpr_7d)}</td>
    </tr>`).join('')}
  </tbody></table>
</section>

${section('scale', 'SCALE — increase budget tomorrow', scale, 'SCALE', false)}
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
