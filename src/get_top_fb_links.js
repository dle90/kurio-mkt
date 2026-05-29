// One-shot: top 10 ad sets of the week → underlying boosted-post Facebook URL.
// Reads the latest data/roster-*.json, ranks by the same blended score as
// src/reports/adset_roster.js (TARGET_CPR=350000):
//     (TARGET_CPR / cpr_7d) * (1 + (code_roas ?? 0))
// filters to tag != CUT/FATIGUE/WATCH/DEAD and reg_7d >= 3, then for each
// adset fetches one ACTIVE ad to surface creative.object_story_id and prints
// https://www.facebook.com/<pageId>/posts/<postId>.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { meta } from './client.js';

const TARGET_CPR = 350_000;

function latestRoster() {
  const files = fs.readdirSync('data')
    .filter(f => /^roster-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  return path.join('data', files[files.length - 1]);
}

const rosterPath = process.argv[2] || latestRoster();
const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
console.log(`Roster: ${rosterPath}  (yday=${roster.yday}, 7d since ${roster.d7_since})\n`);

const score = a => (TARGET_CPR / a.cpr_7d) * (1 + (a.code_roas ?? 0));

const pool = new Map();
for (const a of [...(roster.picks || []), ...(roster.scale || [])]) {
  if (!pool.has(a.adset_id)) pool.set(a.adset_id, a);
}
const ranked = [...pool.values()]
  .filter(a => a.cpr_7d != null && a.reg_7d >= 3)
  .sort((x, y) => score(y) - score(x))
  .slice(0, 10);

console.log(`Top ${ranked.length} ad sets of the week (by blended score):\n`);

const results = [];
for (let i = 0; i < ranked.length; i++) {
  const a = ranked[i];
  let fbUrl = null, postId = null, pageId = null, adName = null, creativeName = null;
  try {
    const ads = await meta.get(`/${a.adset_id}/ads`, {
      fields: 'id,name,status,effective_status,creative{object_story_id,effective_object_story_id,name}',
      limit: 10,
    });
    const ad = (ads.data || []).find(x => x.status === 'ACTIVE') || (ads.data || [])[0];
    if (ad) {
      adName = ad.name;
      const story = ad.creative?.object_story_id || ad.creative?.effective_object_story_id;
      creativeName = ad.creative?.name || null;
      if (story && story.includes('_')) {
        [pageId, postId] = story.split('_');
        fbUrl = `https://www.facebook.com/${pageId}/posts/${postId}`;
      }
    }
  } catch (e) {
    console.log(`  [warn] ${a.adset_id}: ${e.message}`);
  }
  results.push({ rank: i + 1, ...a, ad_name: adName, fb_url: fbUrl, story_id: pageId && postId ? `${pageId}_${postId}` : null, creative_name: creativeName });
}

for (const r of results) {
  console.log(`${String(r.rank).padStart(2)}. [${r.account}] ${r.campaign_name}  ›  ${r.adset_name}`);
  console.log(`    code=${r.code || '—'}  spend_7d=${Math.round(r.spend_7d).toLocaleString()}  reg=${r.reg_7d}  CPR=${Math.round(r.cpr_7d).toLocaleString()}  ROAS=${r.code_roas != null ? r.code_roas.toFixed(2) : '—'}`);
  console.log(`    ad: ${r.ad_name || '(no active ad found)'}`);
  console.log(`    fb: ${r.fb_url || '(no object_story_id)'}`);
  console.log('');
}

const outJson = `data/top-fb-links-${roster.yday}.json`;
fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
console.log(`Saved: ${outJson}`);
