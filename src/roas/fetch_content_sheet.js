// Decode the base64-XLSX payload saved by the Google Drive MCP `download_file_content`
// call into .cache/kurio_content.xlsx, then walk the sheet with SheetJS to extract
// per-cell hyperlinks (which the MCP's text-mode read_file_content strips).
//
// Outputs:
//   .cache/kurio_content.xlsx              - raw workbook
//   .cache/kurio_content_codes.json        - [{ code, caption, finalUrl, utm, ads, status, sheetName }]
//
// Usage:
//   node src/roas/fetch_content_sheet.js <path-to-mcp-result-json>
//
// The input JSON has shape: { content: <base64 xlsx>, mimeType, title, id }
// MCP saves it under .claude/projects/.../tool-results/mcp-...-download_file_content-*.txt

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node src/roas/fetch_content_sheet.js <mcp-result-json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const buf = Buffer.from(raw.content, 'base64');
fs.mkdirSync('.cache', { recursive: true });
const xlsxPath = '.cache/kurio_content.xlsx';
fs.writeFileSync(xlsxPath, buf);
console.log(`wrote ${xlsxPath} (${(buf.length / 1024).toFixed(0)} KB)`);

const wb = XLSX.readFile(xlsxPath, { cellHTML: false, cellFormula: true });
console.log('sheets:', wb.SheetNames);

function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}

const allRows = [];
for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  if (!ws['!ref']) continue;
  const range = XLSX.utils.decode_range(ws['!ref']);
  // Find header row — look for "Code" + "Caption" in any of first 5 rows
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
  if (headerRow < 0) {
    console.log(`  [${sheetName}] no Code/Caption header — skipped`);
    continue;
  }
  const idx = (name, fuzzy) => {
    const i = header.findIndex(h => fuzzy ? fuzzy.test(h) : h === name);
    return i;
  };
  const codeI = idx('Code');
  const captionI = idx(null, /caption/i);
  const linkI = idx(null, /link\s*tr[aả]\s*b[aà]i/i);
  const utmI = idx(null, /^utm/i);
  const adsI = idx('ADS');
  const statusI = idx(null, /t[iì]nh\s*tr[aạ]ng/i);
  console.log(`  [${sheetName}] header row=${headerRow + 1}, cols: code=${codeI}, caption=${captionI}, link=${linkI}, utm=${utmI}, ads=${adsI}, status=${statusI}`);
  if (codeI < 0 || linkI < 0) continue;

  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const get = (ci) => {
      if (ci < 0) return { v: '', url: '' };
      const a = colLetter(range.s.c + ci) + (r + 1);
      const cell = ws[a];
      if (!cell) return { v: '', url: '' };
      const v = (cell.v ?? cell.w ?? '').toString().trim();
      // SheetJS stores hyperlinks on the cell as .l.Target
      const url = cell.l?.Target || '';
      // Also handle =HYPERLINK("url","label") formulas
      let formulaUrl = '';
      if (cell.f && /^HYPERLINK\(/i.test(cell.f)) {
        const m = /^HYPERLINK\(\s*"([^"]+)"/i.exec(cell.f);
        if (m) formulaUrl = m[1];
      }
      return { v, url: url || formulaUrl };
    };
    const code = get(codeI);
    if (!code.v || !/^code\d+|^[a-z0-9]/i.test(code.v)) continue;
    const caption = get(captionI);
    const link = get(linkI);
    const utm = get(utmI);
    const ads = get(adsI);
    const status = get(statusI);
    allRows.push({
      sheet: sheetName,
      code: code.v,
      caption: caption.v,
      finalUrl: link.url || '',
      finalText: link.v,
      utm: utm.v,
      ads: ads.v,
      status: status.v,
    });
  }
}

const out = '.cache/kurio_content_codes.json';
fs.writeFileSync(out, JSON.stringify(allRows, null, 2));
console.log(`\nwrote ${out} — ${allRows.length} rows`);
const withUrl = allRows.filter(r => r.finalUrl);
console.log(`  with extracted hyperlink: ${withUrl.length}`);
console.log(`  unique sheets contributing: ${new Set(allRows.map(r => r.sheet)).size}`);

// Quick sample
console.log('\nFirst 5 rows with a URL:');
for (const r of withUrl.slice(0, 5)) {
  console.log(`  ${r.code}  →  ${r.finalUrl.slice(0, 90)}`);
}
