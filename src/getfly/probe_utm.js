// Discover where UTM / attribution data lives in Getfly by probing field names
// one at a time (Getfly 400s with "Không thể lấy trường (X)" for invalid fields).
import { getfly } from './client.js';

const CANDIDATES = [
  'utm_source','utm_medium','utm_campaign','utm_content','utm_term','utm_id',
  'utm','source','source_name','src','src_name','src_id',
  'fbclid','gclid','referrer','referer','ref','channel',
  'landing_page','landing_url','lp','lp_url','url','link','website',
  'campaign','campaign_id','campaign_name','ad_id','adset','content',
  'note','notes','description','tags','tag','account_source','account_source_name',
];

async function validFields(path) {
  console.log(`\n=== ${path}: probing ${CANDIDATES.length} field names ===`);
  const ok = [];
  for (const f of CANDIDATES) {
    try {
      const r = await getfly.get(path, { limit: 1, fields: 'id,' + f });
      const rec = r?.data?.[0];
      const v = rec ? rec[f] : undefined;
      const s = v == null ? '(null)' : (typeof v === 'object' ? JSON.stringify(v).slice(0,120) : String(v).slice(0,120));
      console.log(`  ✓ ${f.padEnd(22)} = ${s}`);
      ok.push(f);
    } catch (e) {
      if (!/Không thể lấy trường/.test(e.message)) console.log(`  ? ${f.padEnd(22)} ${e.message.slice(0,80)}`);
    }
  }
  return ok;
}

const main = async () => {
  const soFields = await validFields('/sale_orders');
  const acFields = await validFields('/accounts');

  // Pull newest sale_orders with every valid field, dump custom_fields fully
  if (soFields.length) {
    console.log('\n\n=== newest /sale_orders with all valid fields + custom_fields ===');
    const r = await getfly.get('/sale_orders', { limit: 5, fields: ['id','order_code','account_phone','created_at','custom_fields',...soFields].join(',') });
    for (const o of (r?.data || [])) console.log(JSON.stringify(o));
  }

  // Pull newest accounts with every valid field
  if (acFields.length) {
    console.log('\n\n=== newest /accounts with all valid fields + custom_fields ===');
    const r = await getfly.get('/accounts', { limit: 8, fields: ['id','account_name','phone_office','created_at','custom_fields',...acFields].join(',') });
    for (const a of (r?.data || [])) console.log(JSON.stringify(a));
  }

  // Check opportunities too
  console.log('\n\n=== /opportunities probe ===');
  try {
    const oppFields = await validFields('/opportunities');
    if (oppFields.length) {
      const r = await getfly.get('/opportunities', { limit: 5, fields: ['id','created_at','custom_fields',...oppFields].join(',') });
      for (const o of (r?.data || [])) console.log(JSON.stringify(o));
    }
  } catch (e) { console.log('  ✗', e.message); }
};
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
