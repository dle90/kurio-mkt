// Download the Kurio leads sheet as CSV → .cache/sheet.csv
// Sheet ID + GID are configured in .env (LEADS_SHEET_ID, LEADS_SHEET_GID).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const id = process.env.LEADS_SHEET_ID;
const gid = process.env.LEADS_SHEET_GID || '0';
if (!id) throw new Error('Missing LEADS_SHEET_ID in .env (the long string from the sheet URL)');

const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
const dest = '.cache/sheet.csv';

const main = async () => {
  fs.mkdirSync('.cache', { recursive: true });
  console.log(`Fetching sheet gid=${gid} → ${dest}`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sheet fetch HTTP ${res.status} ${res.statusText} — check sheet is readable by anyone-with-link`);
  const text = await res.text();
  fs.writeFileSync(dest, text);
  console.log(`Wrote ${dest} (${(text.length / 1024).toFixed(0)} KB)`);
};

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
