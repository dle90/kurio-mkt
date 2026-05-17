// Scan 2026 YTD rows for revenue-shaped columns + col E (package) coverage
import 'dotenv/config';
import fs from 'node:fs';

const FILE = process.env.LEADS_SHEET_FILE || '.cache/sheet.csv';

function* parseCsv(text) {
  let i = 0, field = '', row = [], inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++;
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); yield row; row = []; field = ''; i++; continue; }
      field += c; i++;
    }
  }
  if (field.length || row.length) { row.push(field); yield row; }
}

function parseDate(s) {
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) return { y: +m[3], mo: +m[2], d: +m[1] };
  return null;
}

const text = fs.readFileSync(FILE, 'utf-8');
const iter = parseCsv(text);
iter.next(); // header

// For each column index, count: how many 2026 YTD rows have a non-empty value,
// how many of those contain a money pattern, sample values
const colStats = new Map();
let ytdCount = 0;

for (const row of iter) {
  if (!row[0]) continue;
  const d = parseDate(row[0]);
  if (!d || d.y !== 2026) continue;
  ytdCount++;

  for (let i = 0; i < Math.min(row.length, 30); i++) {
    const v = row[i] || '';
    if (!v.trim()) continue;
    if (!colStats.has(i)) colStats.set(i, { nonEmpty: 0, money: 0, samples: new Set() });
    const s = colStats.get(i);
    s.nonEmpty++;
    // Money pattern: contains digits + (đ, VND, .000, k, tr)
    if (/\d{3}\.\d{3}|\d+\s*(đ|VND|vnd|k|tr|triệu)/i.test(v)) s.money++;
    if (s.samples.size < 4) s.samples.add(v.slice(0, 80));
  }
}

console.log(`YTD rows scanned: ${ytdCount}\n`);
console.log('Column coverage (idx | nonEmpty | money-shaped | samples):');
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const colLetter = i => i < 26 ? letters[i] : letters[Math.floor(i/26)-1] + letters[i%26];
for (const [i, s] of [...colStats.entries()].sort((a, b) => a[0] - b[0])) {
  const pct = (s.nonEmpty / ytdCount * 100).toFixed(0);
  const moneyPct = s.money ? ` (${(s.money/s.nonEmpty*100).toFixed(0)}% money)` : '';
  const samples = [...s.samples].map(x => `"${x}"`).join(' | ');
  console.log(`  [${i}=${colLetter(i)}] ${pct.padStart(3)}% (${s.nonEmpty})${moneyPct.padEnd(12)} | ${samples}`);
}
