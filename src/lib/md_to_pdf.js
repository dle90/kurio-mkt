// Convert a markdown file to a print-friendly PDF using marked + Edge headless.
// Usage: node src/lib/md_to_pdf.js <input.md> [output.pdf]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';

const input = process.argv[2];
if (!input) { console.error('Usage: node src/lib/md_to_pdf.js <input.md> [output.pdf]'); process.exit(1); }
const output = process.argv[3] || input.replace(/\.md$/i, '.pdf');

const md = fs.readFileSync(input, 'utf-8');
const bodyHtml = marked.parse(md, { gfm: true, breaks: false });
const title = path.basename(input, path.extname(input));

const css = `
  @page { size: A4; margin: 16mm 14mm; }
  html { font-size: 10.5pt; }
  body {
    font-family: "Segoe UI", "Calibri", "Helvetica Neue", Arial, sans-serif;
    color: #1a1a1a;
    line-height: 1.45;
    max-width: 100%;
  }
  h1, h2, h3, h4 { color: #0a2540; line-height: 1.25; page-break-after: avoid; }
  h1 { font-size: 18pt; border-bottom: 2px solid #0a2540; padding-bottom: 4pt; margin-top: 0; }
  h2 { font-size: 14pt; margin-top: 14pt; border-bottom: 1px solid #d0d7de; padding-bottom: 2pt; }
  h3 { font-size: 12pt; margin-top: 10pt; }
  h4 { font-size: 10.5pt; margin-top: 8pt; font-weight: 600; }
  p { margin: 6pt 0; }
  em { color: #555; font-style: italic; }
  strong { color: #0a2540; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 9.5pt; page-break-inside: avoid; }
  th, td { border: 1px solid #d0d7de; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f6f8fa; font-weight: 600; }
  td { word-wrap: break-word; }
  code { background: #f6f8fa; padding: 1pt 4pt; border-radius: 3pt; font-family: "Consolas", "Courier New", monospace; font-size: 9.5pt; }
  pre { background: #f6f8fa; padding: 8pt; border-radius: 4pt; overflow-x: auto; font-size: 9pt; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #d0d7de; margin: 6pt 0; padding: 2pt 12pt; color: #444; font-style: italic; background: #fafbfc; }
  ul, ol { margin: 4pt 0 4pt 18pt; padding: 0; }
  li { margin: 2pt 0; }
  hr { border: none; border-top: 1px solid #d0d7de; margin: 14pt 0; }
  a { color: #0969da; text-decoration: none; }
  a[href]::after { content: ""; }
  .footer { text-align: center; font-size: 8pt; color: #8b949e; margin-top: 20pt; border-top: 1px solid #d0d7de; padding-top: 6pt; }
`;

const html = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
${bodyHtml}
<div class="footer">${title} · Generated ${new Date().toISOString().slice(0,10)}</div>
</body>
</html>`;

// Write temp HTML next to output PDF
const tmpHtml = path.resolve(output).replace(/\.pdf$/i, '.__tmp.html');
fs.writeFileSync(tmpHtml, html, 'utf-8');

// Locate Edge
const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = EDGE_CANDIDATES.find(p => fs.existsSync(p));
if (!edge) { console.error('Could not find msedge.exe'); process.exit(1); }

const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/');
const absOut = path.resolve(output);

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
} finally {
  try { fs.unlinkSync(tmpHtml); } catch {}
}

const stat = fs.statSync(absOut);
console.log(`Wrote ${output} (${(stat.size/1024).toFixed(1)} KB)`);
