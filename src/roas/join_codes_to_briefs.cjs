// Join the live ROAS top-N spenders against the briefs recovered from the
// KURIO - Content master sheet (URLs extracted from XLSX hyperlink metadata).
//
// Inputs:
//   .cache/kurio_content_codes.json   (from fetch_content_sheet.js)
//   out/roas_by_code.csv              (from npm run roas:build)
// Output:
//   out/creative_briefs_join.json
//   out/creative_briefs_join.md       (human-readable table for the user)

const fs = require('node:fs');

const briefs = JSON.parse(fs.readFileSync('.cache/kurio_content_codes.json', 'utf8'));
const briefByCode = Object.fromEntries(briefs.map(b => [b.code, b]));

const roas = fs.readFileSync('out/roas_by_code.csv', 'utf8')
  .split(/\r?\n/).slice(1).filter(Boolean)
  .map(l => {
    const c = l.split(',');
    return {
      code: c[0], is_xpage: c[1] === 'TRUE',
      spend: Number(c[2]), reg: Number(c[5]), revenue: Number(c[7]),
      cpr: Number(c[8]) || null, roas: Number(c[11]) || 0,
    };
  });

function baseCode(c) {
  // Catches code13, code13-reup, code13_xpage, code13-xpage-kv, code4-2, …
  const m1 = /^code(\d+)/i.exec(c);
  if (m1) return 'code' + m1[1];
  // Catches 13-xpage-kv, 83-x3, 45-xpage-kv (bare number + x-suffix)
  const m2 = /^(\d+)[\-_]?x/i.exec(c);
  if (m2) return 'code' + m2[1];
  // Catches 2-code13, 3-code17 (prefix + code variant)
  const m3 = /code(\d+)/i.exec(c);
  if (m3) return 'code' + m3[1];
  return c;
}

const top = roas.sort((a, b) => b.spend - a.spend).slice(0, 50);
const rows = top.map(r => {
  const b = briefByCode[baseCode(r.code)];
  return {
    code: r.code,
    base: baseCode(r.code),
    xpage: r.is_xpage,
    spend_M: Math.round(r.spend / 1e6),
    reg: r.reg,
    roas: +r.roas.toFixed(2),
    caption: b?.caption?.slice(0, 80) || '',
    brief_url: b?.finalUrl || '',
    utm: b?.utm || '',
    ads: b?.ads || '',
  };
});

fs.writeFileSync('out/creative_briefs_join.json', JSON.stringify(rows, null, 2));

const lines = [
  '# Top-50 Spenders → Creative Brief URLs',
  '',
  `Generated ${new Date().toISOString().slice(0, 10)} from out/roas_by_code.csv + .cache/kurio_content_codes.json`,
  '',
  '| # | code | xpage | spend M | reg | ROAS | caption | brief |',
  '| -: | :- | :-: | -: | -: | -: | :- | :- |',
];
rows.forEach((r, i) => {
  lines.push(
    `| ${i + 1} | ${r.code} | ${r.xpage ? '✓' : ''} | ${r.spend_M} | ${r.reg} | ${r.roas.toFixed(2)} | ${r.caption.replace(/\|/g, '\\|')} | ${r.brief_url ? `[doc](${r.brief_url})` : '—'} |`
  );
});
fs.writeFileSync('out/creative_briefs_join.md', lines.join('\n') + '\n');

const have = rows.filter(r => r.brief_url).length;
console.log(`top-${rows.length}: ${have} have brief URL, ${rows.length - have} missing`);
console.log('missing:', rows.filter(r => !r.brief_url).map(r => r.code).join(', '));
console.log('wrote out/creative_briefs_join.{json,md}');
