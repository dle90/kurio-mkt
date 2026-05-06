import { meta } from './client.js';

const accounts = await meta.listAccounts({ activeOnly: true });

console.log('=== Campaign counts per account (not just last_30d) ===\n');
for (const a of accounts) {
  try {
    const campaigns = await meta.getAll(`/${a.id}/campaigns`, {
      fields: 'id,name,status,effective_status,objective,created_time',
      limit: 100,
    });
    const byStatus = {};
    for (const c of campaigns) byStatus[c.effective_status] = (byStatus[c.effective_status] || 0) + 1;
    const objectives = [...new Set(campaigns.map(c => c.objective))].filter(Boolean);
    console.log(`${a.id} ${a.name} (${a.currency})`);
    console.log(`  total campaigns: ${campaigns.length}`);
    console.log(`  by effective_status: ${JSON.stringify(byStatus)}`);
    console.log(`  objectives in use: ${objectives.join(', ') || '(none)'}\n`);
  } catch (e) {
    console.log(`${a.id} ${a.name}: ERROR — ${e.message}\n`);
  }
}

console.log('\n=== All action_types appearing in Kurio 3, last_30d, with totals ===\n');
const insights = await meta.getAll('/act_930175825635997/insights', {
  level: 'campaign',
  date_preset: 'last_30d',
  fields: 'actions',
  limit: 200,
});

const tally = {};
for (const row of insights) {
  for (const act of row.actions || []) {
    tally[act.action_type] = (tally[act.action_type] || 0) + Number(act.value || 0);
  }
}
const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
console.table(sorted.map(([type, total]) => ({ action_type: type, total })));
