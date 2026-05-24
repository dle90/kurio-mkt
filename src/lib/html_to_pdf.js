// Convert an HTML file to a print-friendly PDF using Edge headless.
// Pairs with md_to_pdf.js — same Edge invocation, but skips markdown rendering
// so HTML files (e.g. data/roster-plan-*.html) can be exported directly.
//
// Usage: node src/lib/html_to_pdf.js <input.html> [output.pdf]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const input = process.argv[2];
if (!input) { console.error('Usage: node src/lib/html_to_pdf.js <input.html> [output.pdf]'); process.exit(1); }
const output = process.argv[3] || input.replace(/\.html?$/i, '.pdf');

if (!fs.existsSync(input)) { console.error(`Input not found: ${input}`); process.exit(1); }

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = EDGE_CANDIDATES.find(p => fs.existsSync(p));
if (!edge) { console.error('Could not find msedge.exe'); process.exit(1); }

const absIn = path.resolve(input);
const absOut = path.resolve(output);
const fileUrl = 'file:///' + absIn.replace(/\\/g, '/');

console.log(`Rendering ${path.basename(input)} → ${path.basename(output)}...`);
try {
  execFileSync(edge, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${absOut}`,
    fileUrl,
  ], { stdio: 'inherit' });
} catch (e) {
  console.error('Edge failed:', e.message);
  process.exit(1);
}

const stat = fs.statSync(absOut);
console.log(`Wrote ${output} (${(stat.size / 1024).toFixed(1)} KB)`);
