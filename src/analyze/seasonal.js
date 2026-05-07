// Weekly CPR + spend + reg trend, account-level, since 2025-10-01.
// Annotates the IKMC organic window (Dec → end of March) and Tết 2026 (Feb 17).
import { writeFileSync } from 'node:fs';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997', name: 'Kurio 3' },
];

const SINCE = '2025-10-01';
const UNTIL = new Date().toISOString().slice(0, 10);

// IKMC organic window: Dec 1 → Mar 31.
function ikmcZone(date) {
  const m = Number(date.slice(5, 7));
  return m === 12 || m <= 3;
}
// Tết 2026: Feb 14–22.
const TET_START = '2026-02-14';
const TET_END = '2026-02-22';

function actionValue(actions, type) {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

async function pullWeekly(accountId) {
  return meta.getAll(`/${accountId}/insights`, {
    time_increment: 7,
    time_range: { since: SINCE, until: UNTIL },
    fields: 'date_start,date_stop,spend,impressions,reach,actions',
    limit: 200,
  });
}

console.log(`Pulling weekly trend ${SINCE} → ${UNTIL} for ${ACCOUNTS.length} accounts...\n`);

// Aggregate week-keyed across accounts.
const byWeek = new Map();
for (const acct of ACCOUNTS) {
  console.log(`  ${acct.name}: fetching weekly insights...`);
  const rows = await pullWeekly(acct.id);
  console.log(`    ${rows.length} weekly rows`);
  for (const r of rows) {
    const key = r.date_start;
    if (!byWeek.has(key)) {
      byWeek.set(key, {
        week_start: r.date_start,
        week_end: r.date_stop,
        spend: 0,
        impressions: 0,
        reach: 0,
        registrations: 0,
        link_clicks: 0,
        lpv: 0,
        leads_form: 0,
        leads_pixel: 0,
        per_account: {},
      });
    }
    const w = byWeek.get(key);
    const spend = Number(r.spend) || 0;
    const reg = actionValue(r.actions, 'complete_registration');
    const lpv = actionValue(r.actions, 'landing_page_view');
    const linkClicks = actionValue(r.actions, 'link_click');
    const leadsForm = actionValue(r.actions, 'onsite_conversion.lead_grouped');
    const leadsPixel = actionValue(r.actions, 'offsite_conversion.fb_pixel_lead');
    w.spend += spend;
    w.impressions += Number(r.impressions) || 0;
    w.reach += Number(r.reach) || 0;
    w.registrations += reg;
    w.link_clicks += linkClicks;
    w.lpv += lpv;
    w.leads_form += leadsForm;
    w.leads_pixel += leadsPixel;
    w.per_account[acct.name] = { spend, reg, lpv };
  }
}

const weeks = [...byWeek.values()].sort((a, b) => a.week_start.localeCompare(b.week_start));

// Print headline trend.
console.log(`\n${'='.repeat(110)}`);
console.log(`Weekly trend — Kurio 2 + Kurio 3 combined (account-level, all objectives)`);
console.log(`${'='.repeat(110)}\n`);
console.log('week         | zone   | spend (VND) | impr      | LPV    | reg | CPR (VND) | CPLPV | reg/LPV |  K2 reg /  K3 reg');
console.log('-'.repeat(110));
for (const w of weeks) {
  const cpr = w.registrations > 0 ? Math.round(w.spend / w.registrations) : null;
  const cplpv = w.lpv > 0 ? Math.round(w.spend / w.lpv) : null;
  const conv = w.lpv > 0 ? ((w.registrations / w.lpv) * 100).toFixed(1) + '%' : '-';
  const isTet = w.week_start >= TET_START && w.week_start <= TET_END;
  const zone = isTet ? 'TẾT '
    : ikmcZone(w.week_start) ? 'IKMC'
    : '    ';
  const k2 = w.per_account['Kurio 2']?.reg || 0;
  const k3 = w.per_account['Kurio 3']?.reg || 0;
  console.log(
    `${w.week_start} | ${zone}   | ${Math.round(w.spend).toLocaleString().padStart(11)} | ${w.impressions.toLocaleString().padStart(9)} | ${w.lpv.toString().padStart(6)} | ${w.registrations.toString().padStart(3)} | ${cpr ? cpr.toLocaleString().padStart(9) : '        -'} | ${cplpv ? cplpv.toLocaleString().padStart(5) : '    -'} | ${conv.padStart(7)} | ${k2.toString().padStart(7)} / ${k3.toString().padStart(7)}`
  );
}

// Phase comparison: pre-IKMC (Oct–Nov), IKMC (Dec–Mar), post-IKMC (Apr–May).
function bucket(w) {
  const m = Number(w.week_start.slice(5, 7));
  if (m === 10 || m === 11) return 'PRE  (Oct–Nov 2025)';
  if (m === 12 || m <= 3) return 'IKMC (Dec 2025–Mar 2026)';
  return 'POST (Apr–May 2026)';
}

const buckets = new Map();
for (const w of weeks) {
  const k = bucket(w);
  if (!buckets.has(k)) buckets.set(k, { weeks: 0, spend: 0, reg: 0, lpv: 0, link_clicks: 0, impr: 0 });
  const b = buckets.get(k);
  b.weeks += 1;
  b.spend += w.spend;
  b.reg += w.registrations;
  b.lpv += w.lpv;
  b.link_clicks += w.link_clicks;
  b.impr += w.impressions;
}

console.log(`\n${'='.repeat(110)}`);
console.log(`Phase comparison — IKMC organic window vs cleaner baselines`);
console.log(`${'='.repeat(110)}\n`);
console.table([...buckets.entries()].map(([phase, b]) => ({
  phase,
  weeks: b.weeks,
  spend_vnd: Math.round(b.spend).toLocaleString(),
  spend_per_week: Math.round(b.spend / b.weeks).toLocaleString(),
  registrations: b.reg,
  reg_per_week: (b.reg / b.weeks).toFixed(1),
  CPR_vnd: b.reg > 0 ? Math.round(b.spend / b.reg).toLocaleString() : '-',
  reg_per_lpv: b.lpv > 0 ? ((b.reg / b.lpv) * 100).toFixed(2) + '%' : '-',
  CPLPV_vnd: b.lpv > 0 ? Math.round(b.spend / b.lpv).toLocaleString() : '-',
})));

console.log(`\nNote: IKMC zone has organic registration tailwind (Dec–end Mar) — CPR drop in that window`);
console.log(`is partly attributable to organic IKMC traffic, not ad efficiency improvement.\n`);

writeFileSync('seasonal-results.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  range: { since: SINCE, until: UNTIL },
  weeks,
  phase_comparison: Object.fromEntries(buckets),
}, null, 2));
console.log('Raw results written to seasonal-results.json');
