// Quick descriptive pass over the content-tracker CSV.
// Goal: surface counts by format, USP, status, and look for blind spots
// vs the memory's "creative_blind_spots" + "creative_formula" notes.

import { readFileSync } from 'node:fs';
import { parse } from 'node:path';

function parseCsv(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const raw = readFileSync('data/content-tracker.csv', 'utf8');
const rows = parseCsv(raw);

// header is row index 1 (row 0 is blank padding)
const header = rows[1];
console.log('HEADER:', header);
const body = rows.slice(2).filter(r => r.some(c => c && c.trim()));
console.log('data rows:', body.length);

const col = {};
header.forEach((h, idx) => { col[h.trim()] = idx; });

const get = (r, name) => (r[col[name]] || '').trim();

// Buckets
const byFormat = new Map();       // Định dạng
const byHinhThuc = new Map();     // Hình thức
const byStatus = new Map();       // Tình trạng
const uspText = [];
const captions = [];
const contentKeys = [];
let withUtm = 0, withAds = 0;

for (const r of body) {
  const f = get(r, 'Định dạng') || '(blank)';
  const h = get(r, 'Hình thức') || '(blank)';
  const s = get(r, 'Tình trạng') || '(blank)';
  byFormat.set(f, (byFormat.get(f) || 0) + 1);
  byHinhThuc.set(h, (byHinhThuc.get(h) || 0) + 1);
  byStatus.set(s, (byStatus.get(s) || 0) + 1);
  uspText.push(get(r, 'USP'));
  captions.push(get(r, 'Caption'));
  contentKeys.push(get(r, 'Nội dung content (key bài viết + cách triển khai)'));
  if (get(r, 'UTM')) withUtm++;
  if (get(r, 'ADS')) withAds++;
}

function show(label, m) {
  console.log('\n' + label);
  [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log('  ' + v.toString().padStart(4) + '  ' + k));
}
show('FORMAT (Định dạng):', byFormat);
show('HÌNH THỨC:', byHinhThuc);
show('STATUS (Tình trạng):', byStatus);
console.log('\nUTM filled:', withUtm, '/', body.length);
console.log('ADS filled:', withAds, '/', body.length);

// Keyword scan for blind-spots & known winners
const allText = (uspText.join(' ') + ' ' + captions.join(' ') + ' ' + contentKeys.join(' ')).toLowerCase();
const probes = {
  '3k/ngày': /3[\.,]?000|3k\/ngày|3k ngày|3\.?000đ\/ngày/,
  'screen-addiction (điện thoại / nghiện)': /nghiện|điện thoại|tiktok|game|màn hình|screen/,
  'dad voice (bố / ba)': /\b(bố|ba|cha|papa)\b/,
  'lớp 5 entry-exam': /lớp 5|vào 6|thi vào 6|chuyển cấp/,
  'topic-specific (phân số / hình học / nhân chia)': /phân số|hình học|nhân chia|hỗn số|hình thoi|chu vi/,
  'anti-học-thêm': /không học thêm|thay thế học thêm|bỏ học thêm|anti.{0,3}học thêm/,
  'lớp 1': /lớp 1\b/,
  'lớp 2': /lớp 2\b/,
  'lớp 3': /lớp 3\b/,
  'lớp 4': /lớp 4\b/,
  'lớp 5': /lớp 5\b/,
  'lớp 6': /lớp 6\b/,
  'AI (1 kèm 1)': /\bai\b|1 kèm 1|1-1/,
  'IKMC': /ikmc/,
  'scarcity (chỉ còn / cuối cùng)': /chỉ còn|cuối cùng|sắp hết|deadline|hôm nay|gấp/,
  'teacher voice (cô / thầy)': /\b(cô|thầy)\b/,
  'parent narrative (con tôi / con mình)': /con tôi|con mình|con em|mẹ kể|bố kể/,
};
console.log('\nKEYWORD SCAN (matches across USP + caption + content key):');
for (const [k, re] of Object.entries(probes)) {
  const hits = uspText.filter(t => re.test(t.toLowerCase())).length
             + captions.filter(t => re.test(t.toLowerCase())).length
             + contentKeys.filter(t => re.test(t.toLowerCase())).length;
  console.log('  ' + hits.toString().padStart(4) + '  ' + k);
}

// Per-row coverage flag: which rows mention each blind-spot probe
function flag(re) {
  return body.filter(r => re.test((get(r, 'USP') + ' ' + get(r, 'Caption') + ' ' + get(r, 'Nội dung content (key bài viết + cách triển khai)')).toLowerCase())).length;
}
console.log('\nUNIQUE ROW COVERAGE (rows mentioning probe):');
for (const [k, re] of Object.entries(probes)) {
  console.log('  ' + flag(re).toString().padStart(4) + '/' + body.length + '  ' + k);
}

// First/last codes
const codes = body.map(r => get(r, 'Code')).filter(Boolean);
console.log('\ncodes range:', codes[0], '→', codes[codes.length - 1], '(' + codes.length + ' total)');
