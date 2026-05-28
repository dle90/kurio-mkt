// Re-walk .cache/kurio_content.xlsx and dump per-row hyperlinks from EVERY column,
// then filter to canva.com / canva.link URLs only. Output keyed by code so we can
// join to ROAS later.
//
// Usage: node src/roas/extract_image_links.cjs

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const xlsxPath = '.cache/kurio_content.xlsx';
if (!fs.existsSync(xlsxPath)) {
  console.error(`Missing ${xlsxPath}. Re-run fetch_content_sheet.js first.`);
  process.exit(1);
}
const wb = XLSX.readFile(xlsxPath, { cellHTML: false, cellFormula: true });

function colLetter(idx) {
  let s = '', n = idx;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

const rows = [];
for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  if (!ws['!ref']) continue;
  const range = XLSX.utils.decode_range(ws['!ref']);
  // Find header row — same heuristic as fetch_content_sheet.js
  let headerRow = -1, header = [];
  for (let r = range.s.r; r <= Math.min(range.s.r + 4, range.e.r); r++) {
    const cells = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const a = colLetter(c) + (r + 1);
      cells.push((ws[a]?.v ?? '').toString().trim());
    }
    if (cells.includes('Code') && cells.some(x => /caption/i.test(x))) {
      headerRow = r; header = cells; break;
    }
  }
  if (headerRow < 0) continue;
  const codeI = header.findIndex(h => h === 'Code');
  if (codeI < 0) continue;

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const codeA = colLetter(range.s.c + codeI) + (r + 1);
    const codeCell = ws[codeA];
    const code = (codeCell?.v ?? '').toString().trim();
    if (!code) continue;

    // Walk every column, capture (header, value, url) tuples where url exists
    const links = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const colHeader = header[c - range.s.c] || `col${c}`;
      const a = colLetter(c) + (r + 1);
      const cell = ws[a];
      if (!cell) continue;
      let url = cell.l?.Target || '';
      if (!url && cell.f && /^HYPERLINK\(/i.test(cell.f)) {
        const m = /^HYPERLINK\(\s*"([^"]+)"/i.exec(cell.f);
        if (m) url = m[1];
      }
      if (url) links[colHeader] = url;
    }
    if (Object.keys(links).length === 0) continue;
    rows.push({ sheet: sheetName, code, links });
  }
}

console.log(`Total rows with at least one hyperlink: ${rows.length}`);

// Tally URLs by host
const hostTally = new Map();
for (const r of rows) {
  for (const url of Object.values(r.links)) {
    try {
      const h = new URL(url).hostname;
      hostTally.set(h, (hostTally.get(h) || 0) + 1);
    } catch {}
  }
}
console.log('\nHosts found:');
for (const [h, n] of [...hostTally.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(4)}  ${h}`);
}

// Filter to canva.* hosts
const canvaRows = rows
  .map(r => ({
    sheet: r.sheet,
    code: r.code,
    canvaLinks: Object.fromEntries(
      Object.entries(r.links).filter(([_, url]) => /\bcanva\.(com|link)\b/i.test(url))
    ),
  }))
  .filter(r => Object.keys(r.canvaLinks).length > 0);

console.log(`\nRows with at least one Canva URL: ${canvaRows.length}`);

// Show column-name distribution for Canva links
const canvaCols = new Map();
for (const r of canvaRows) {
  for (const col of Object.keys(r.canvaLinks)) {
    canvaCols.set(col, (canvaCols.get(col) || 0) + 1);
  }
}
console.log('\nCanva links per column:');
for (const [col, n] of [...canvaCols.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(4)}  ${col}`);
}

fs.mkdirSync('.cache', { recursive: true });
const out = '.cache/kurio_content_canva_links.json';
fs.writeFileSync(out, JSON.stringify(canvaRows, null, 2));
console.log(`\nwrote ${out}`);

// First 10 sample rows
console.log('\nFirst 10 codes with Canva links:');
for (const r of canvaRows.slice(0, 10)) {
  for (const [col, url] of Object.entries(r.canvaLinks)) {
    console.log(`  ${r.code.padEnd(20)} [${col}]  ${url.slice(0, 100)}`);
  }
}
