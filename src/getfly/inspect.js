// Phase 0 inspector — Getfly v6.
//
// Goal: prove what attribution actually lands on a Getfly record. The pipeline
// design hinges on whether utm_source/medium/campaign/content/term + fbclid
// flow through Ladipage -> Getfly. If they do, we can do ad-level ROAS. If
// not, we can do at best source-level (and we need to fix the Ladipage form
// before anything else).

import { getfly } from './client.js';

const ACCOUNT_FIELDS = [
  'id', 'account_name', 'account_code', 'email', 'phone_office',
  'account_type', 'account_source',
  'description', 'created_at', 'updated_at',
  'custom_fields',
].join(',');

const OPPORTUNITY_FIELDS = [
  'id', 'opportunity_name', 'probability', 'opportunity_status',
  'opportunity_status_name', 'created_at', 'time_registed',
  'account_id', 'account_name', 'phone_office', 'account_email',
  'campaign_id', 'campaign_name',
].join(',');

const SALE_ORDER_FIELDS = [
  'id', 'code', 'account_id', 'account_name', 'total_amount', 'subtotal',
  'discount', 'tax', 'status', 'status_name', 'created_at', 'updated_at',
  'creator', 'sale_user', 'products', 'note', 'custom_fields',
].join(',');

const ENDPOINTS = [
  { label: 'accounts (customers/leads land here)', path: '/accounts',      params: { limit: 5, fields: ACCOUNT_FIELDS } },
  { label: 'opportunities (sales pipeline)',       path: '/opportunities', params: { limit: 5, fields: OPPORTUNITY_FIELDS } },
  { label: 'sale_orders (revenue)',                path: '/sale_orders',   params: { limit: 5, fields: 'id,account_id,total_amount,status,created_at,custom_fields' } },
  { label: 'campaigns (Getfly campaigns)',         path: '/campaigns',     params: { limit: 5, fields: 'id,description,created_at' } },
  { label: 'products (packages?)',                 path: '/products',      params: { limit: 5, fields: 'id,price,description,custom_fields' } },
];

function flatten(obj, prefix = '', out = []) {
  if (obj == null) return out;
  if (Array.isArray(obj)) {
    if (obj.length === 0) { out.push([prefix, '[]']); return out; }
    flatten(obj[0], `${prefix}[0]`, out);
    if (obj.length > 1) out.push([`${prefix}.length`, obj.length]);
    return out;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  out.push([prefix, obj]);
  return out;
}

function findAttribution(records) {
  const hits = [];
  const seen = new Set();
  for (const [i, rec] of records.entries()) {
    for (const [path, val] of flatten(rec)) {
      const kl = path.toLowerCase();
      const vl = typeof val === 'string' ? val.toLowerCase() : '';
      const keyMatch = ['utm', 'fbclid', 'gclid', 'referer', 'referrer', 'source', 'campaign', 'adset', 'ad_id', 'medium', 'channel']
        .some(t => kl.includes(t));
      const valMatch = vl && (
        vl.includes('utm_') || vl.includes('fbclid') || vl.includes('facebook.com') ||
        vl.includes('ladipage') || vl.includes('fb.') || vl.includes('meta_ads')
      );
      if (keyMatch || valMatch) {
        const key = `[record ${i}] ${path} = ${JSON.stringify(val)?.slice(0, 140)}`;
        if (!seen.has(key)) { seen.add(key); hits.push(key); }
      }
    }
  }
  return hits;
}

async function probe(ep) {
  console.log(`\n=== ${ep.label}  (GET ${ep.path}) ===`);
  try {
    const res = await getfly.get(ep.path, ep.params);
    const records = res?.data || (Array.isArray(res) ? res : null);
    if (!records || records.length === 0) {
      console.log(`  ok but empty. top-level keys: [${Object.keys(res || {}).join(', ')}]`);
      return { ok: true, records: [] };
    }
    console.log(`  ✓ ${records.length} record(s) returned${res.has_more ? ' (more available)' : ''}`);
    return { ok: true, records };
  } catch (e) {
    console.log(`  ✗ ${e.status || ''} ${e.message}`);
    return { ok: false, error: e };
  }
}

function dumpShape(records, label) {
  console.log(`\n  --- field shape (across ${records.length} records, top-level keys present) ---`);
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r || {})) keys.add(k);
  for (const k of [...keys].sort()) {
    const sample = records.find(r => r?.[k] != null)?.[k];
    const s = typeof sample === 'object' ? JSON.stringify(sample).slice(0, 80) : JSON.stringify(sample);
    console.log(`    ${k.padEnd(28)} = ${s}`);
  }

  console.log(`\n  --- attribution-shaped fields (utm/fbclid/source/campaign/referrer/...) ---`);
  const hits = findAttribution(records);
  if (hits.length === 0) console.log(`    (none detected — likely lives in custom_fields or isn't propagated)`);
  else hits.forEach(h => console.log('    ' + h));

  // If custom_fields is populated, dump it in detail
  for (const [i, r] of records.entries()) {
    const cf = r?.custom_fields;
    if (cf && (Array.isArray(cf) ? cf.length : Object.keys(cf).length)) {
      console.log(`\n  --- custom_fields on record ${i} (id=${r.id}) ---`);
      console.log('    ' + JSON.stringify(cf, null, 2).split('\n').join('\n    '));
    }
  }

  console.log(`\n  --- full raw most-recent record (truncated 3000 chars) ---`);
  console.log('    ' + JSON.stringify(records[0], null, 2).slice(0, 3000).split('\n').join('\n    '));
}

async function main() {
  console.log(`Getfly host:    ${getfly.host}`);
  console.log(`API base:       ${getfly.base}`);
  console.log(`API version:    ${getfly.version}`);

  for (const ep of ENDPOINTS) {
    const r = await probe(ep);
    if (r.ok && r.records.length > 0) dumpShape(r.records, ep.label);
  }

  console.log(`\n\n========================================================`);
  console.log(`PHASE 0 QUESTIONS TO ANSWER FROM THE OUTPUT ABOVE:`);
  console.log(`========================================================`);
  console.log(`  1. Which field carries the phone number? (will be our join key to Ladipage leads)`);
  console.log(`  2. Are utm_* / fbclid landing anywhere — custom_fields? description? account_source?`);
  console.log(`  3. Where does revenue live — orders? opportunities (probability * deal_value)?`);
  console.log(`  4. What's the lead -> paying-customer status flow? (opportunity_status values)`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
