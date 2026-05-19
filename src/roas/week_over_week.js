// Compare ad-level spend last week vs the prior week, joined with current status.
// Goal: surface what changed in running ads, and what needs action.
import 'dotenv/config';
import fs from 'node:fs';
import { meta } from '../client.js';
import { normalizeName } from './fetch_meta_spend.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];

const today = new Date();
const fmt = d => d.toISOString().slice(0, 10);
const minusDays = (d, n) => new Date(d.getTime() - n * 86400_000);

// Last 7 days = today-6 .. today
const W1 = { since: fmt(minusDays(today, 6)), until: fmt(today) };
// Prior 7 days = today-13 .. today-7
const W0 = { since: fmt(minusDays(today, 13)), until: fmt(minusDays(today, 7)) };

async function fetchSpend(window) {
  const rows = [];
  for (const acc of ACCOUNTS) {
    const r = await meta.getAll(`/${acc.id}/insights`, {
      level: 'ad',
      fields: 'ad_id,ad_name,spend,impressions,clicks',
      time_range: window,
      limit: 200,
    });
    for (const x of r) {
      rows.push({
        account: acc.name,
        ad_id: x.ad_id,
        ad_name: x.ad_name,
        ad_name_norm: normalizeName(x.ad_name),
        spend: +x.spend || 0,
      });
    }
  }
  return rows;
}

const main = async () => {
  console.log(`THIS WEEK: ${W1.since} → ${W1.until}`);
  console.log(`PRIOR WEEK: ${W0.since} → ${W0.until}\n`);

  console.log('Fetching this-week spend...');
  const thisWeek = await fetchSpend(W1);
  console.log(`  ${thisWeek.length} ad rows`);

  console.log('Fetching prior-week spend...');
  const priorWeek = await fetchSpend(W0);
  console.log(`  ${priorWeek.length} ad rows`);

  // Load existing data
  const creative = JSON.parse(fs.readFileSync('.cache/meta_creative.json', 'utf-8'));
  const statusById = new Map(creative.map(a => [a.ad_id, a.effective_status]));
  const codeById = new Map(creative.map(a => [a.ad_id, a.ad_name_norm]));
  const nameById = new Map(creative.map(a => [a.ad_id, a.ad_name]));

  // Build YTD-code ROAS map (for context per ad)
  const meta_ytd = JSON.parse(fs.readFileSync('.cache/meta_spend.json', 'utf-8'));
  const sheet = JSON.parse(fs.readFileSync('.cache/sheet_leads.json', 'utf-8'));
  const gf = JSON.parse(fs.readFileSync('.cache/getfly.json', 'utf-8'));
  function normPhone(s) {
    if (!s) return '';
    const d = String(s).replace(/[^\d]/g, '');
    if (d.startsWith('84') && d.length >= 11) return '0' + d.slice(2);
    if (d.length === 9) return '0' + d;
    if (d.length === 10) return d.startsWith('0') ? d : '0' + d.slice(1);
    return d;
  }
  const phoneToRev = {};
  for (const a of gf.accounts) {
    const p = normPhone(a.phone_office);
    if (p && (!phoneToRev[p] || (a.total_revenue||0) > (phoneToRev[p]||0))) {
      phoneToRev[p] = a.total_revenue || 0;
    }
  }
  sheet.sort((a,b) => a.date.localeCompare(b.date));
  const phoneFirstCode = new Map();
  for (const l of sheet) {
    if (l.phone && l.code && !phoneFirstCode.has(l.phone)) phoneFirstCode.set(l.phone, l.code);
  }
  const spendByCode = new Map();
  for (const r of meta_ytd) spendByCode.set(r.ad_name_norm, (spendByCode.get(r.ad_name_norm)||0) + r.spend);
  const revByCode = new Map();
  for (const [phone, code] of phoneFirstCode) {
    const r = phoneToRev[phone] || 0;
    if (r > 0) revByCode.set(code, (revByCode.get(code)||0) + r);
  }
  const roasByCode = new Map();
  for (const [code, spend] of spendByCode) {
    if (spend > 0) roasByCode.set(code, (revByCode.get(code)||0) / spend);
  }

  // Aggregate by ad_id
  const w1ById = new Map();
  for (const r of thisWeek) w1ById.set(r.ad_id, (w1ById.get(r.ad_id)||0) + r.spend);
  const w0ById = new Map();
  for (const r of priorWeek) w0ById.set(r.ad_id, (w0ById.get(r.ad_id)||0) + r.spend);

  // Universe = union of any ad with spend in either window
  const universe = new Set([...w1ById.keys(), ...w0ById.keys()]);

  const buckets = {
    NEW: [],          // spent this week, not prior
    STOPPED: [],      // spent prior week, not this week
    SCALED_UP: [],    // both, ↑ ≥ 2x or +500k
    SCALED_DOWN: [],  // both, ↓ ≥ 50% or -500k
    STEADY: [],       // both, within ±50%
  };
  for (const id of universe) {
    const w1 = w1ById.get(id) || 0;
    const w0 = w0ById.get(id) || 0;
    const name = nameById.get(id) || `(unknown ad ${id})`;
    const code = codeById.get(id) || normalizeName(name);
    const status = statusById.get(id) || '?';
    const roas = roasByCode.get(code);
    const rec = { id, name, code, status, w1, w0, delta: w1 - w0, roas };
    if (w0 < 1 && w1 >= 1) buckets.NEW.push(rec);
    else if (w1 < 1 && w0 >= 1) buckets.STOPPED.push(rec);
    else if (w0 > 0 && (w1 / w0 >= 2 || (w1 - w0) >= 500_000)) buckets.SCALED_UP.push(rec);
    else if (w0 > 0 && (w1 / w0 <= 0.5 || (w0 - w1) >= 500_000)) buckets.SCALED_DOWN.push(rec);
    else buckets.STEADY.push(rec);
  }

  const fmtV = n => (n|0).toLocaleString();
  const fmtR = r => r === undefined ? '   —' : r.toFixed(2);
  function row(r) {
    const code = (r.code || '').slice(0, 22).padEnd(22);
    const status = (r.status || '?').slice(0, 10).padEnd(10);
    const roas = fmtR(r.roas).padStart(5);
    return `  ${code} | ${status} | w1=${fmtV(r.w1).padStart(10)} | w0=${fmtV(r.w0).padStart(10)} | Δ=${(r.delta>=0?'+':'')+fmtV(r.delta).padStart(10)} | ROAS=${roas} | ${r.name.slice(0,40)}`;
  }
  function summarize(label, items, sortFn) {
    items.sort(sortFn);
    const tot1 = items.reduce((s,r)=>s+r.w1,0);
    const tot0 = items.reduce((s,r)=>s+r.w0,0);
    console.log(`\n${'='.repeat(95)}\n${label}  (${items.length} ads · w1=${fmtV(tot1)} VND · w0=${fmtV(tot0)} VND · Δ=${fmtV(tot1-tot0)})\n${'='.repeat(95)}`);
    console.log(`  code                   | status     | spend w1   | spend w0   | delta       | ROAS  | ad name`);
    console.log(`  -----------------------+------------+------------+------------+-------------+-------+--------`);
    for (const r of items.slice(0, 30)) console.log(row(r));
    if (items.length > 30) console.log(`  ... +${items.length - 30} more`);
  }

  summarize('🆕 NEW THIS WEEK — spent ≥1 VND this week, 0 prior',
    buckets.NEW, (a,b) => b.w1 - a.w1);
  summarize('🛑 STOPPED — spent prior week, 0 this week',
    buckets.STOPPED, (a,b) => b.w0 - a.w0);
  summarize('📈 SCALED UP — ≥2× or +500k week-over-week',
    buckets.SCALED_UP, (a,b) => b.delta - a.delta);
  summarize('📉 SCALED DOWN — ≤50% or -500k week-over-week',
    buckets.SCALED_DOWN, (a,b) => a.delta - b.delta);
  summarize('➖ STEADY (top 20 by this-week spend)',
    buckets.STEADY, (a,b) => b.w1 - a.w1);

  // Totals
  const totW1 = [...w1ById.values()].reduce((s,v)=>s+v,0);
  const totW0 = [...w0ById.values()].reduce((s,v)=>s+v,0);
  console.log(`\n${'='.repeat(95)}`);
  console.log(`TOTAL SPEND  this week: ${fmtV(totW1)} VND  ·  prior week: ${fmtV(totW0)} VND  ·  Δ ${fmtV(totW1-totW0)}`);
  console.log(`${'='.repeat(95)}`);

  fs.writeFileSync('out/week_over_week.json', JSON.stringify(buckets, null, 2));
  console.log('\nWrote out/week_over_week.json');
};

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
