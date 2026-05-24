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

  console.error('\nDone.');
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
