// Phase 0.5 — verify whether Ladipage→Getfly carries fbp/fbc/user_agent.
//
// Phase 0 missed these because its attribution-keyword filter only looked for
// utm/fbclid/source/etc. The Ladipage form has dedicated inputs named
// "fbp", "fbc", "user_agent" — if the runtime substitution works, those values
// should appear in the most recent Getfly accounts' custom_fields.

import { getfly } from './client.js';

const FIELDS = [
  'id', 'account_name', 'account_code', 'email', 'phone_office',
  'account_type', 'account_source',
  'description', 'created_at', 'updated_at',
  'custom_fields',
].join(',');

async function main() {
  console.log(`Querying ${getfly.base}/accounts for most-recent leads...\n`);
  const res = await getfly.get('/accounts', { limit: 10, fields: FIELDS });
  const records = res?.data || (Array.isArray(res) ? res : []);
  console.log(`Returned ${records.length} accounts. has_more=${res?.has_more}\n`);

  for (const [i, r] of records.entries()) {
    console.log(`\n========== Record ${i} — id=${r.id} created_at=${r.created_at} ==========`);
    console.log(`account_name : ${JSON.stringify(r.account_name)}`);
    console.log(`account_code : ${JSON.stringify(r.account_code)}`);
    console.log(`phone        : ${JSON.stringify(r.phone_office)}`);
    console.log(`email        : ${JSON.stringify(r.email)}`);
    console.log(`account_type : ${JSON.stringify(r.account_type)}`);
    console.log(`account_source: ${JSON.stringify(r.account_source)}`);
    console.log(`description  : ${JSON.stringify(r.description)?.slice(0, 200)}`);
    console.log(`custom_fields:`);
    const cf = r.custom_fields;
    if (!cf || (Array.isArray(cf) && !cf.length) || (typeof cf === 'object' && !Object.keys(cf).length)) {
      console.log(`  (empty)`);
    } else if (Array.isArray(cf)) {
      for (const f of cf) {
        // common shape: {name, value} or {field_name, field_value} — print both
        const k = f.name || f.field_name || f.key || JSON.stringify(Object.keys(f));
        const v = f.value ?? f.field_value ?? f.val;
        console.log(`  ${String(k).padEnd(40)} = ${JSON.stringify(v)?.slice(0, 200)}`);
      }
    } else {
      for (const [k, v] of Object.entries(cf)) {
        console.log(`  ${String(k).padEnd(40)} = ${JSON.stringify(v)?.slice(0, 200)}`);
      }
    }
  }

  // Probe sources endpoint to decode account_source IDs (31, 7 seen previously)
  console.log(`\n\n========== Decode account_source IDs ==========`);
  for (const path of ['/account_sources', '/sources', '/categories/account_source', '/account/sources']) {
    try {
      const r = await getfly.get(path, { limit: 50 });
      console.log(`\n  ✓ ${path} ->`, JSON.stringify(r).slice(0, 800));
      break;
    } catch (e) {
      console.log(`  ✗ ${path}: ${e.status} ${e.message.slice(0, 100)}`);
    }
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
