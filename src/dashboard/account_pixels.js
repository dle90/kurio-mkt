// Do Kurio 2 / 3 / 5 share the same Meta Pixel?
// Lists each account's pixels, and — more importantly — which pixel its ACTIVE
// ad sets actually optimize on (promoted_object.pixel_id). Separate pixels =
// separate conversion-optimizer learning, the one real "which account" effect.
import 'dotenv/config';
import { meta } from '../client.js';

const ACCOUNTS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997',  name: 'Kurio 3' },
  { id: 'act_1069029708221793', name: 'Kurio 5' },
];

const tally = arr => {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const report = [];
for (const acc of ACCOUNTS) {
  console.error(`Fetching ${acc.name} pixels + ad sets...`);
  let pixels = [];
  try {
    pixels = await meta.getAll(`/${acc.id}/adspixels`, { fields: 'id,name,last_fired_time' });
  } catch (e) { console.error(`  pixels ERROR: ${e.message}`); }

  let adsets = [];
  try {
    adsets = await meta.getAll(`/${acc.id}/adsets`, {
      fields: 'id,name,effective_status,optimization_goal,promoted_object',
      limit: 200,
    });
  } catch (e) { console.error(`  adsets ERROR: ${e.message}`); }

  const active = adsets.filter(a => a.effective_status === 'ACTIVE');
  const usage = active.map(a => {
    const po = a.promoted_object || {};
    return { pixel_id: po.pixel_id || null, event: po.custom_event_type || null, page_id: po.page_id || null };
  });
  report.push({ acc, pixels, active, usage });
  console.error(`  ${pixels.length} pixels, ${active.length} active ad sets`);
}

const P = s => console.log(s);
P('='.repeat(72));
P('  KURIO 2 / 3 / 5 — Meta Pixel check');
P('='.repeat(72));

for (const r of report) {
  P('');
  P(`  ${r.acc.name}  (${r.acc.id})`);
  P('  ' + '-'.repeat(68));
  P(`  Pixels on the account (${r.pixels.length}):`);
  for (const p of r.pixels) {
    P(`     ${p.id}  "${p.name || ''}"  last fired ${p.last_fired_time || '—'}`);
  }
  P(`  Pixel actually used by ACTIVE ad sets:`);
  const pxUse = tally(r.usage.map(u => u.pixel_id || '(none — non-conversion ad set)'));
  for (const [px, n] of pxUse) P(`     ${px}  ×${n} ad sets`);
  const evUse = tally(r.usage.filter(u => u.event).map(u => u.event));
  if (evUse.length) P(`  Conversion event optimized: ${evUse.map(([e, n]) => `${e}×${n}`).join('  ')}`);
}

// verdict
P('');
P('='.repeat(72));
P('  VERDICT');
P('='.repeat(72));
const pixelSets = report.map(r => ({
  name: r.acc.name,
  used: [...new Set(r.usage.map(u => u.pixel_id).filter(Boolean))].sort(),
  owned: [...new Set(r.pixels.map(p => p.id))].sort(),
}));
for (const p of pixelSets) {
  P(`  ${p.name}: optimizes on pixel(s) [${p.used.join(', ') || 'none'}]`);
}
const allUsed = pixelSets.flatMap(p => p.used);
const distinct = [...new Set(allUsed)];
if (distinct.length === 0) {
  P('\n  No conversion pixels found on active ad sets.');
} else if (distinct.length === 1) {
  P(`\n  → SHARED. All three accounts optimize on the SAME pixel (${distinct[0]}).`);
  P('    Conversion signal & optimizer learning are pooled — "which account" barely matters for learning.');
} else {
  P(`\n  → SEPARATE. ${distinct.length} distinct pixels in use across the accounts.`);
  P('    Each account/pixel learns on its own conversion history — that IS a real');
  P('    account-level effect: a pixel with more registrations optimizes better.');
}
