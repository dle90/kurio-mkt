// Check whether the campaign codes from the sheet (col P) appear in Meta ad/adset/campaign names.
// If yes → we can join sheet leads → Meta entities → ROAS by code.
import { meta } from '../client.js';
import fs from 'node:fs';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
];

// Top YTD codes — start with these to confirm naming convention exists, then we'll go broader
const TOP_CODES_FROM_SHEET = [
  'code63', 'code63-3', 'code13', 'code83-x3', 'code83', 'code45-3',
  'NM-3', 'code182', 'code186', 'cx-93', 'intro2-xpage', 'code128',
  'CX93-3', '8D', 'code102-2', 'NM', 'CX-3', 'code4', 'cx-94', 'code45-xp',
  'code14', 'CT19', '3-NOTT', 'code17-xpage', 'code140', 'NOTT',
  'code13_xpage', '83-xpage-kv', 'code43-xp', 'code45-reup', 'code13-reup',
  'code83-xp', 'code4-2', 'CX-94', '2-code13', '45-xpage-kv', '3-RLTH',
  'code45-xp-5', 'code147', 'code14-xpage',
];

const main = async () => {
  const allAds = [];
  const allAdsets = [];
  const allCampaigns = [];

  for (const acc of ACCOUNTS) {
    console.log(`\n=== ${acc.name} (${acc.id}) ===`);

    console.log(`  fetching campaigns...`);
    const campaigns = await meta.getAll(`/${acc.id}/campaigns`, {
      fields: 'id,name,status,objective,created_time',
      limit: 200,
    });
    console.log(`  ${campaigns.length} campaigns`);
    allCampaigns.push(...campaigns.map(c => ({ ...c, _account: acc.name })));

    console.log(`  fetching adsets...`);
    const adsets = await meta.getAll(`/${acc.id}/adsets`, {
      fields: 'id,name,status,campaign_id,created_time',
      limit: 200,
    });
    console.log(`  ${adsets.length} adsets`);
    allAdsets.push(...adsets.map(a => ({ ...a, _account: acc.name })));

    console.log(`  fetching ads...`);
    const ads = await meta.getAll(`/${acc.id}/ads`, {
      fields: 'id,name,status,adset_id,campaign_id,created_time',
      limit: 200,
    });
    console.log(`  ${ads.length} ads`);
    allAds.push(...ads.map(a => ({ ...a, _account: acc.name })));
  }

  console.log(`\nTOTAL: ${allCampaigns.length} campaigns, ${allAdsets.length} adsets, ${allAds.length} ads\n`);

  // Match each top code against ad/adset/campaign names (case-insensitive substring + boundary check)
  console.log('='.repeat(70));
  console.log('CODE MATCH ANALYSIS — does each sheet code appear in Meta entity names?');
  console.log('='.repeat(70));
  console.log('Code'.padEnd(20) + '| matches in (campaigns/adsets/ads)'.padEnd(38) + '| sample name');
  console.log('-'.repeat(120));

  for (const code of TOP_CODES_FROM_SHEET) {
    // Use case-insensitive boundary-ish match — code surrounded by non-alphanumeric
    const re = new RegExp(`(^|[^a-zA-Z0-9_])${escapeRe(code)}([^a-zA-Z0-9_]|$)`, 'i');
    const camMatches = allCampaigns.filter(c => re.test(c.name || ''));
    const setMatches = allAdsets.filter(a => re.test(a.name || ''));
    const adMatches  = allAds.filter(a => re.test(a.name || ''));
    const total = camMatches.length + setMatches.length + adMatches.length;
    const sample = camMatches[0]?.name || setMatches[0]?.name || adMatches[0]?.name || '';
    const indicator = total > 0 ? '✓' : ' ';
    console.log(`${indicator} ${code.padEnd(18)}| ${String(camMatches.length+'/'+setMatches.length+'/'+adMatches.length).padEnd(36)}| ${sample.slice(0, 80)}`);
  }

  // Also: sample of ad names so we can see what the naming convention actually is
  console.log('\n\n=== Sample ad names (first 30 ACTIVE) ===');
  allAds.filter(a => a.status === 'ACTIVE').slice(0, 30).forEach(a => {
    console.log(`  [${a._account}] ${a.name}`);
  });

  // Save full inventory for further work
  fs.mkdirSync('.cache', { recursive: true });
  fs.writeFileSync('.cache/meta_entities.json', JSON.stringify({
    campaigns: allCampaigns, adsets: allAdsets, ads: allAds,
  }, null, 2));
  console.log('\n(saved full inventory to .cache/meta_entities.json)');
};

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
