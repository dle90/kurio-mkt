// Full Getfly /accounts pull WITH custom_fields, so we have phone -> ads_code
// for every customer (not just 2026-created ones). This replaces the Google
// sheet as the attribution source for the ROAS pipeline.
//
// Output: .cache/getfly_accounts.json  — [{ id, phone, created_at, source, ads_code }]
import 'dotenv/config';
import fs from 'node:fs';
import { getfly } from '../getfly/client.js';

const FIELDS = 'id,phone_office,created_at,account_source,total_revenue,custom_fields';
const STOP_BEFORE = process.env.ACCOUNTS_SINCE || null; // optional 'YYYY-MM-DD' cutoff

function normPhone(s) {
  if (!s) return '';
  const d = String(s).replace(/[^\d]/g, '');
  if (d.startsWith('84') && (d.length === 11 || d.length === 12)) return '0' + d.slice(2);
  if (d.length === 9) return '0' + d;
  if (d.length === 10 && d.startsWith('0')) return d;
  if (d.length === 10) return '0' + d.slice(1);
  return d;
}

async function getWithRetry(params, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { return await getfly.get('/accounts', params); }
    catch (e) {
      if (i === tries - 1) throw e;
      const wait = (i + 1) * 5000;
      console.log(`  [retry ${i + 1}/${tries} after ${wait / 1000}s: ${e.message.slice(0, 60)}]`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

const main = async () => {
  console.log(`Full /accounts pull (fields incl. custom_fields)${STOP_BEFORE ? `, stop before ${STOP_BEFORE}` : ''}\n`);
  const out = [];
  let offset = 0, page = 0;
  while (true) {
    const r = await getWithRetry({ limit: 200, offset, fields: FIELDS });
    const data = r?.data || [];
    if (!data.length) break;
    let stopped = false;
    for (const a of data) {
      if (STOP_BEFORE && (a.created_at || '') && a.created_at.slice(0, 10) < STOP_BEFORE) { stopped = true; break; }
      const cf = a.custom_fields;
      const adsCode = (cf && !Array.isArray(cf) ? (cf.ads_code || '') : '').trim();
      const srcId = Array.isArray(a.account_source) ? a.account_source[0] : null;
      out.push({
        id: a.id,
        phone: normPhone(a.phone_office),
        created_at: a.created_at || '',
        source: srcId,
        total_revenue: +a.total_revenue || 0,
        ads_code: adsCode || null,
        note: (cf && !Array.isArray(cf) ? (cf.note_phu_huynh || '') : '').slice(0, 60),
      });
    }
    page++;
    if (page % 10 === 0) console.log(`  page ${page}, pulled ${out.length}`);
    if (stopped || !r.has_more) break;
    offset += data.length;
    if (out.length > 80000) { console.log('  safety cap @80k'); break; }
  }

  fs.writeFileSync('.cache/getfly_accounts.json', JSON.stringify(out, null, 2));

  // ---- coverage report ----
  const withCode = out.filter(a => a.ads_code);
  const byMonth = {};
  for (const a of out) {
    const m = (a.created_at || '').slice(0, 7);
    if (!m) continue;
    if (!byMonth[m]) byMonth[m] = { n: 0, coded: 0 };
    byMonth[m].n++;
    if (a.ads_code) byMonth[m].coded++;
  }
  console.log(`\n=== Pulled ${out.length} accounts ===`);
  console.log(`  with ads_code: ${withCode.length} (${Math.round(withCode.length / out.length * 100)}%)`);
  console.log(`  distinct ads_code values: ${new Set(withCode.map(a => a.ads_code)).size}`);
  console.log('\n  ads_code coverage by account-creation month:');
  for (const m of Object.keys(byMonth).sort()) {
    const v = byMonth[m];
    console.log(`    ${m}: ${String(v.n).padStart(5)} accts, ${String(Math.round(v.coded / v.n * 100)).padStart(3)}% have ads_code`);
  }
  console.log('\nSaved .cache/getfly_accounts.json');
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
