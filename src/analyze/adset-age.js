// Ad-set age vs CPR. Pull all ad sets in Kurio 2 + Kurio 3 with created_time,
// join to last_90d insights, bucket by age, compare CPR. Tests whether Meta's
// optimizer plateaus or improves as ad sets accumulate signal — and whether
// ad-set freshness explains some of the same-creative CPR spread.
import { writeFileSync } from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997', name: 'Kurio 3' },
];

const DATE_PRESET = process.env.DATE_PRESET || 'last_90d';
const MIN_SPEND = Number(process.env.MIN_SPEND || 500_000);
const TODAY = new Date();

function actionValue(actions, type) {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

function ageDays(createdTime) {
  const created = new Date(createdTime);
  return Math.floor((TODAY - created) / (1000 * 60 * 60 * 24));
}

function ageBucket(days) {
  if (days < 30) return 'A: 0–30d (new)';
  if (days < 60) return 'B: 30–60d';
  if (days < 90) return 'C: 60–90d';
  if (days < 180) return 'D: 90–180d';
  if (days < 365) return 'E: 180–365d';
  return 'F: 365d+ (old)';
}

const all = [];
for (const acct of ACCOUNTS) {
  console.log(`Pulling ${acct.name} campaigns + adsets + insights...`);
  const camps = await meta.getAll(`/${acct.id}/campaigns`, {
    fields: 'id,objective',
    limit: 200,
  });
  const objByCamp = Object.fromEntries(camps.map(c => [c.id, c.objective]));

  const adsets = await meta.getAll(`/${acct.id}/adsets`, {
    fields: 'id,name,campaign_id,created_time',
    limit: 200,
  });
  const adsetMap = Object.fromEntries(adsets.map(a => [a.id, a]));
  console.log(`  ${camps.length} campaigns, ${adsets.length} adsets`);

  const insights = await meta.getAll(`/${acct.id}/insights`, {
    level: 'adset',
    date_preset: DATE_PRESET,
    fields: 'adset_id,campaign_id,spend,actions',
    limit: 200,
  });
  console.log(`  ${insights.length} adset insight rows`);

  for (const r of insights) {
    const obj = objByCamp[r.campaign_id];
    if (obj !== 'OUTCOME_SALES') continue;
    const meta_ = adsetMap[r.adset_id];
    if (!meta_) continue;
    const spend = Number(r.spend) || 0;
    if (spend < MIN_SPEND) continue;
    const reg = actionValue(r.actions, 'complete_registration');
    const age = ageDays(meta_.created_time);
    all.push({
      account: acct.name,
      adset_id: r.adset_id,
      adset_name: meta_.name,
      created_time: meta_.created_time,
      age_days: age,
      bucket: ageBucket(age),
      spend,
      reg,
      cpr: reg > 0 ? spend / reg : null,
    });
  }
}

console.log(`\nTotal qualifying SALES adsets (spend >= ${MIN_SPEND.toLocaleString()}): ${all.length}\n`);

// Aggregate by bucket.
const buckets = new Map();
for (const r of all) {
  if (!buckets.has(r.bucket)) buckets.set(r.bucket, { adsets: 0, spend: 0, reg: 0, with_reg: 0, zero_reg: 0, cprs: [] });
  const b = buckets.get(r.bucket);
  b.adsets += 1;
  b.spend += r.spend;
  b.reg += r.reg;
  if (r.reg > 0) {
    b.with_reg += 1;
    b.cprs.push(r.cpr);
  } else {
    b.zero_reg += 1;
  }
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

console.log(`${'='.repeat(120)}`);
console.log(`Ad-set age vs CPR — SALES, ${DATE_PRESET}, min spend ${MIN_SPEND.toLocaleString()} VND`);
console.log(`${'='.repeat(120)}\n`);
const sortedBuckets = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
console.table(sortedBuckets.map(([bucket, b]) => ({
  age_bucket: bucket,
  adsets: b.adsets,
  total_spend: Math.round(b.spend).toLocaleString(),
  total_reg: b.reg,
  blended_cpr: b.reg > 0 ? Math.round(b.spend / b.reg).toLocaleString() : '-',
  median_cpr: b.cprs.length ? Math.round(median(b.cprs)).toLocaleString() : '-',
  pct_zero_reg: ((b.zero_reg / b.adsets) * 100).toFixed(0) + '%',
  pct_with_reg: ((b.with_reg / b.adsets) * 100).toFixed(0) + '%',
})));

// Scatter view — sample.
const withReg = all.filter(r => r.reg > 0).sort((a, b) => a.age_days - b.age_days);
console.log(`\nScatter sample (every Nth ad set, sorted by age):`);
const stride = Math.max(1, Math.floor(withReg.length / 30));
console.log('age_days | spend (VND) | reg |   CPR (VND) | adset');
console.log('-'.repeat(110));
for (let i = 0; i < withReg.length; i += stride) {
  const r = withReg[i];
  console.log(`${r.age_days.toString().padStart(8)} | ${Math.round(r.spend).toLocaleString().padStart(11)} | ${r.reg.toString().padStart(3)} | ${Math.round(r.cpr).toLocaleString().padStart(11)} | [${r.account}] ${r.adset_name?.slice(0, 50)}`);
}

// Pearson correlation between age and log(CPR) for adsets with reg > 0.
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

const ages = withReg.map(r => r.age_days);
const logCprs = withReg.map(r => Math.log(r.cpr));
const corr = pearson(ages, logCprs);
console.log(`\nPearson correlation (age_days, log(CPR)) over ${withReg.length} adsets with reg>0: r = ${corr?.toFixed(3)}`);
console.log(`  Positive r → older adsets cost more per registration.`);
console.log(`  Negative r → older adsets cost less (optimizer maturation).`);
console.log(`  Near zero  → age has no detectable effect on CPR.`);

writeFileSync('adset-age-results.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  date_preset: DATE_PRESET,
  min_spend: MIN_SPEND,
  total_adsets: all.length,
  buckets: Object.fromEntries(sortedBuckets.map(([k, v]) => [k, { ...v, cprs: undefined, median_cpr: median(v.cprs), n_with_reg: v.cprs.length }])),
  pearson_age_log_cpr: corr,
  rows: all,
}, null, 2));
console.log(`\nRaw results written to adset-age-results.json`);
