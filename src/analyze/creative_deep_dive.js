// Creative deep-dive — joins ROAS (21d cohort window + Apr+May aggregate) to
// per-creative body / title / format / age data, then surfaces patterns:
//   - which LP family is winning  (xpage / xpage-kv / xp-5 / reup / base)
//   - which copy patterns correlate with ROAS  (3k anchor, parent voice,
//     transformation arc, anti-học-thêm, exam, scarcity, emoji, length)
//   - which formats produce the most lift per dong  (video / dynamic-image / photo)
//   - which codes are improving vs fading (21d vs Apr+May)
//   - which blind-spot angles are still completely untested
//
// Writes: data/creative-deep-dive.json + data/creative-deep-dive.md
import fs from 'node:fs';
import { loadAttribution } from '../roas/attribution.js';

const fmt = n => n == null ? '—' : Math.round(n).toLocaleString('en-US');
const pct = n => n == null ? '—' : (n * 100).toFixed(0) + '%';

// ---- inputs ----
const CREATIVE = JSON.parse(fs.readFileSync('.cache/meta_creative.json', 'utf8'));
const WINDOW = JSON.parse(fs.readFileSync('data/code-roas-window.json', 'utf8'));

// CSV parser (small)
function parseCSV(text) {
  const out = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line) continue;
    const cells = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQ) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') inQ = false;
        else cur += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { cells.push(cur); cur = ''; }
        else cur += c;
      }
    }
    cells.push(cur);
    out.push(cells);
  }
  return out;
}
function loadCsvRoas() {
  const rows = parseCSV(fs.readFileSync('data/roas-codes-ranked.csv', 'utf8'));
  if (rows.length < 2) return new Map();
  const h = rows[0];
  const find = (...n) => { for (const x of n) { const i = h.findIndex(c => c.trim() === x); if (i >= 0) return i; } return -1; };
  const codeI = find('Code'), ytdI = find('YTD ROAS'), aprMayI = find('Apr+May ROAS'),
    ytdSpendI = find('YTD spend'), aprMaySpendI = find('Apr+May spend');
  const m = new Map();
  for (let r = 1; r < rows.length; r++) {
    const code = (rows[r][codeI] || '').trim().toLowerCase();
    if (!code) continue;
    const num = i => { const v = parseFloat(String(rows[r][i] || '').replace(/[",]/g, '')); return isFinite(v) ? v : null; };
    m.set(code, { ytd_roas: num(ytdI), apr_may_roas: num(aprMayI),
      ytd_spend: num(ytdSpendI), apr_may_spend: num(aprMaySpendI) });
  }
  return m;
}
const CSV_ROAS = loadCsvRoas();
const { codeSet, resolveAd } = loadAttribution();

// ---- code resolution per creative (same logic as adset_roster.js) ----
const VARIANT_SUFFIXES = ['xpagekv', 'xpage', 'reup', 'kv', 'tg', 'lt', 'xp'];
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function smartResolve(adName, adsetName, campaignName) {
  const corpus = norm(`${campaignName} ${adsetName} ${adName}`);
  let best = null;
  for (const code of codeSet) {
    const cn = norm(code);
    if (cn.length < 4) continue;
    if (corpus.includes(cn) && (!best || cn.length > best.normLen)) {
      best = { code, normLen: cn.length, cnorm: cn };
    }
  }
  if (best) {
    const has = VARIANT_SUFFIXES.find(s => corpus.includes(s));
    const ok = has && best.cnorm.includes(has);
    return { code: best.code, confidence: (has && !ok) ? 'token' : 'substring' };
  }
  const code = resolveAd({ ad_name_norm: norm(adName), adset_name: adsetName || '', campaign_name: campaignName || '' });
  return { code: code || null, confidence: code ? 'token' : null };
}

// ---- LP family parsing ----
function lpFamily(code) {
  if (!code) return 'unknown';
  if (/xp[-_]?5$/.test(code)) return 'xp-5 (K5)';
  if (/xpage[-_]?kv|kv$/.test(code)) return 'xpage-kv';
  if (/-?xpage|_xpage/.test(code)) return 'xpage';
  if (/-?xp\b|-xp-/.test(code)) return 'xp';
  if (/-?reup$/.test(code)) return 'reup';
  return 'base';
}

// ---- creative-body pattern features ----
function bodyFeatures(body) {
  if (!body) return null;
  const b = body.toLowerCase();
  return {
    length: body.length,
    has_3k_anchor: /3\s*\.?\s*0*k\s*\/?\s*ngày|3\.000\s*đ\s*\/?\s*ngày/i.test(body),
    has_price_per_month: /\d{2,3}\s*\.?\s*0*k\s*\/?\s*tháng|\d{2,3}\.000\s*đ?\s*\/?\s*tháng/i.test(body),
    has_parent_voice: /(nhà mình|hai vợ chồng|mẹ kể|con mình|bé nhà|con nhà|mẹ ơi|bố ơi|con chị|con anh|con em|con tôi)/i.test(b),
    has_teacher_voice: /(cô giáo|thầy giáo|giáo viên|cô dạy)/.test(b),
    has_transformation: /(top \d|9\s*[-–]\s*10\s*điểm|9[-–]10|hsg|học sinh giỏi|đứng đầu|đỗ chuyên|đỗ trường|tăng \d+\s*điểm|cải thiện)/.test(b),
    has_pain_hook: /(suýt|kém|tụt|hổng|sợ toán|ghét toán|không hiểu|chán học|không tập trung|mất tập trung|tệ|thất vọng|sai cách)/.test(b),
    has_anti_extra: /(học thêm|trung tâm|gia sư riêng|cấm dạy thêm)/.test(b),
    has_scarcity: /(suất|chỉ còn|nhanh tay|miễn phí 100|ưu đãi)/.test(b),
    has_exam: /(thi vào|thi lớp|thi chuyên|trần đại nghĩa|lương thế vinh|cầu giấy|marie curie|ams|đoàn thị điểm|kỳ thi|ôn thi)/.test(b),
    has_screen_addiction: /(tiktok|màn hình|game|youtube|cắm mặt|nghiện|video xấu|điện thoại)/.test(b),
    has_dad_voice: /(bố từng|bố mình|bố ơi|làm bố|bố mẹ|là bố)/.test(b),
    has_summer: /(hè|nghỉ hè|mùa hè|3 tháng hè|hè này)/.test(b),
    has_eoy: /(tổng kết|cuối năm|giấy khen|năm học)/.test(b),
    has_ai_tutor: /(gia sư ai|gia sư công nghệ|ai kèm|ai gợi mở)/.test(b),
    has_question_hook: body.split('\n')[0].includes('?'),
    has_emoji: /[\u{1F300}-\u{1FAFF}]|✅|🌟|🎯|👉/u.test(body),
    headline_caps: /^[A-ZÀ-Ỹ\s\d,!?\-–./]{15,}/.test(body.split('\n')[0]),
  };
}

// ---- 1. join creative → code → ROAS ----
const codeIndex = new Map(); // code -> { creatives: [], ages: [], formats: {}, accounts: {} }
let resolved = 0, unresolved = 0;
const allFeatures = [];
for (const r of CREATIVE) {
  if (!r.creative) continue;
  const { code, confidence } = smartResolve(r.ad_name, r.ad_name || '', '');
  if (!code) { unresolved++; continue; }
  resolved++;
  if (!codeIndex.has(code)) codeIndex.set(code, {
    code, creatives: [], ages: [], formats: {}, accounts: {}, active: 0, total: 0,
  });
  const e = codeIndex.get(code);
  const feats = bodyFeatures(r.creative.body);
  e.creatives.push({
    ad_id: r.ad_id, ad_name: r.ad_name, account: r.account,
    title: r.creative.title, body: r.creative.body || '',
    cta: r.creative.cta, object_type: r.creative.object_type,
    created_time: r.created_time, status: r.effective_status,
    features: feats,
  });
  if (feats) allFeatures.push({ code, ...feats });
  e.formats[r.creative.object_type || 'unknown'] = (e.formats[r.creative.object_type || 'unknown'] || 0) + 1;
  e.accounts[r.account] = (e.accounts[r.account] || 0) + 1;
  if (r.effective_status === 'ACTIVE') e.active++;
  e.total++;
  e.ages.push(Math.floor((Date.now() - Date.parse(r.created_time)) / 86400_000));
}
console.error(`Resolved ${resolved}/${resolved + unresolved} creatives to codes (${Math.round(resolved / (resolved + unresolved) * 100)}%)`);

// ---- 2. attach ROAS ----
const codeRows = [];
for (const [code, e] of codeIndex) {
  const w = WINDOW.codes[code];
  const c = CSV_ROAS.get(code);
  const dominant = Object.entries(e.formats).sort((a, b) => b[1] - a[1])[0];
  const dominantAcct = Object.entries(e.accounts).sort((a, b) => b[1] - a[1])[0];
  codeRows.push({
    code,
    lp_family: lpFamily(code),
    n_creatives: e.creatives.length,
    n_active: e.active,
    dominant_format: dominant ? dominant[0] : null,
    dominant_account: dominantAcct ? dominantAcct[0] : null,
    age_min_d: Math.min(...e.ages),
    age_max_d: Math.max(...e.ages),
    age_median_d: e.ages.sort((a, b) => a - b)[Math.floor(e.ages.length / 2)],
    window_spend: w?.spend ?? 0,
    window_reg: w?.reg ?? 0,
    window_rev: w?.rev ?? 0,
    window_roas: w?.roas ?? null,
    window_cpr: w && w.reg > 0 ? w.spend / w.reg : null,
    apr_may_roas: c?.apr_may_roas ?? null,
    apr_may_spend: c?.apr_may_spend ?? null,
    ytd_roas: c?.ytd_roas ?? null,
    ytd_spend: c?.ytd_spend ?? null,
    trajectory: (c?.apr_may_roas != null && w?.roas != null)
      ? +(w.roas - c.apr_may_roas).toFixed(2) : null,
    sample_body: e.creatives.find(c => c.body && c.body.length > 300)?.body.slice(0, 600) || null,
    sample_title: e.creatives.find(c => c.title)?.title || null,
  });
}

// ---- 3. LP family aggregates ----
const lpAgg = new Map();
for (const r of codeRows) {
  if (!lpAgg.has(r.lp_family)) lpAgg.set(r.lp_family, { codes: 0, spend: 0, reg: 0, rev: 0, codes_with_roas: 0, roas_sum: 0 });
  const a = lpAgg.get(r.lp_family);
  a.codes++;
  a.spend += r.window_spend;
  a.reg += r.window_reg;
  a.rev += r.window_rev;
  if (r.window_roas != null) { a.codes_with_roas++; a.roas_sum += r.window_roas; }
}

// ---- 4. body-feature x ROAS correlation ----
// For each feature, compute mean ROAS where present vs absent, weighted by code-level window spend
const features = ['has_3k_anchor', 'has_price_per_month', 'has_parent_voice', 'has_teacher_voice',
  'has_transformation', 'has_pain_hook', 'has_anti_extra', 'has_scarcity', 'has_exam',
  'has_screen_addiction', 'has_dad_voice', 'has_summer', 'has_eoy', 'has_ai_tutor',
  'has_question_hook', 'has_emoji', 'headline_caps'];

const featAgg = features.map(f => {
  const present = { codes: 0, spend: 0, rev: 0, reg: 0 };
  const absent = { codes: 0, spend: 0, rev: 0, reg: 0 };
  for (const r of codeRows) {
    if (!r.window_spend) continue;
    // does the dominant creative for this code have the feature?
    const e = codeIndex.get(r.code);
    const withFeat = e.creatives.some(c => c.features && c.features[f]);
    const bucket = withFeat ? present : absent;
    bucket.codes++;
    bucket.spend += r.window_spend;
    bucket.reg += r.window_reg;
    bucket.rev += r.window_rev;
  }
  return {
    feature: f,
    present_codes: present.codes,
    present_spend: present.spend,
    present_roas: present.spend ? present.rev / present.spend : null,
    present_cpr: present.reg ? present.spend / present.reg : null,
    absent_codes: absent.codes,
    absent_spend: absent.spend,
    absent_roas: absent.spend ? absent.rev / absent.spend : null,
    absent_cpr: absent.reg ? absent.spend / absent.reg : null,
    lift: (present.spend && absent.spend && (present.rev / present.spend) && (absent.rev / absent.spend))
      ? +((present.rev / present.spend) / (absent.rev / absent.spend)).toFixed(2) : null,
  };
});

// ---- 5. format x ROAS ----
const formatAgg = new Map();
for (const r of codeRows) {
  if (!r.window_spend) continue;
  const f = r.dominant_format || 'unknown';
  if (!formatAgg.has(f)) formatAgg.set(f, { codes: 0, spend: 0, reg: 0, rev: 0 });
  const a = formatAgg.get(f);
  a.codes++; a.spend += r.window_spend; a.reg += r.window_reg; a.rev += r.window_rev;
}

// ---- 6. output JSON ----
const out = {
  built_at: new Date().toISOString(),
  window: { since: WINDOW.since, until: WINDOW.until, days: WINDOW.days },
  totals: WINDOW.totals,
  resolution: { resolved, unresolved, rate: resolved / (resolved + unresolved) },
  lp_family: [...lpAgg.entries()].map(([k, v]) => ({
    family: k, codes: v.codes, spend: v.spend, reg: v.reg, rev: v.rev,
    blended_roas: v.spend ? v.rev / v.spend : null,
    blended_cpr: v.reg ? v.spend / v.reg : null,
    codes_with_roas: v.codes_with_roas,
    mean_roas_unweighted: v.codes_with_roas ? v.roas_sum / v.codes_with_roas : null,
  })).sort((a, b) => b.spend - a.spend),
  format: [...formatAgg.entries()].map(([k, v]) => ({
    format: k, codes: v.codes, spend: v.spend, reg: v.reg, rev: v.rev,
    blended_roas: v.spend ? v.rev / v.spend : null,
    blended_cpr: v.reg ? v.spend / v.reg : null,
  })).sort((a, b) => b.spend - a.spend),
  features: featAgg.sort((a, b) => (b.lift || 0) - (a.lift || 0)),
  top_codes: codeRows.filter(r => r.window_spend >= 1e6).sort((a, b) => (b.window_roas || 0) - (a.window_roas || 0)).slice(0, 25),
  bottom_codes: codeRows.filter(r => r.window_spend >= 2e6 && r.window_roas != null).sort((a, b) => (a.window_roas || 99) - (b.window_roas || 99)).slice(0, 15),
  improving_codes: codeRows.filter(r => r.trajectory != null && r.trajectory > 0.2 && r.window_spend >= 1e6).sort((a, b) => b.trajectory - a.trajectory).slice(0, 12),
  fading_codes: codeRows.filter(r => r.trajectory != null && r.trajectory < -0.2 && r.window_spend >= 1e6).sort((a, b) => a.trajectory - b.trajectory).slice(0, 12),
  total_active_creatives: codeRows.reduce((s, r) => s + r.n_active, 0),
  total_creatives: codeRows.reduce((s, r) => s + r.n_creatives, 0),
};
fs.writeFileSync('data/creative-deep-dive.json', JSON.stringify(out, null, 2));
console.error(`\nWrote data/creative-deep-dive.json`);

// ---- 7. console summary ----
const P = s => console.log(s);
P('='.repeat(96));
P('  CREATIVE DEEP-DIVE — window ' + WINDOW.since + ' → ' + WINDOW.until + ` (${WINDOW.days}d)`);
P('='.repeat(96));
P(`  Resolved ${resolved} / ${resolved + unresolved} historic creatives to codes (${Math.round(resolved * 100 / (resolved + unresolved))}%)`);
P(`  ${out.total_active_creatives} active / ${out.total_creatives} total creatives across ${codeRows.length} codes`);
P('');
P('LP FAMILY (sorted by window spend):');
P('  ' + 'family'.padEnd(14) + 'codes'.padStart(6) + ' ' + 'spend'.padStart(13) + ' ' + 'reg'.padStart(5) + ' ' + 'rev'.padStart(13) + ' ' + 'ROAS'.padStart(6) + ' ' + 'CPR'.padStart(9));
for (const r of out.lp_family) {
  P('  ' + r.family.padEnd(14) + String(r.codes).padStart(6) + ' ' + fmt(r.spend).padStart(13) + ' ' + String(r.reg).padStart(5) + ' ' + fmt(r.rev).padStart(13) + ' ' + (r.blended_roas != null ? r.blended_roas.toFixed(2) : '—').padStart(6) + ' ' + fmt(r.blended_cpr).padStart(9));
}
P('');
P('FORMAT (dominant per code, sorted by spend):');
P('  ' + 'format'.padEnd(14) + 'codes'.padStart(6) + ' ' + 'spend'.padStart(13) + ' ' + 'reg'.padStart(5) + ' ' + 'rev'.padStart(13) + ' ' + 'ROAS'.padStart(6) + ' ' + 'CPR'.padStart(9));
for (const r of out.format) {
  P('  ' + r.format.padEnd(14) + String(r.codes).padStart(6) + ' ' + fmt(r.spend).padStart(13) + ' ' + String(r.reg).padStart(5) + ' ' + fmt(r.rev).padStart(13) + ' ' + (r.blended_roas != null ? r.blended_roas.toFixed(2) : '—').padStart(6) + ' ' + fmt(r.blended_cpr).padStart(9));
}
P('');
P('FEATURE × ROAS (sorted by lift = present_ROAS / absent_ROAS):');
P('  ' + 'feature'.padEnd(22) + 'pres_codes'.padStart(11) + 'pres_ROAS'.padStart(11) + 'abs_codes'.padStart(11) + 'abs_ROAS'.padStart(10) + 'lift'.padStart(7));
for (const f of out.features) {
  P('  ' + f.feature.replace('has_', '').padEnd(22) +
    String(f.present_codes).padStart(11) + ' ' +
    (f.present_roas != null ? f.present_roas.toFixed(2) : '—').padStart(10) + ' ' +
    String(f.absent_codes).padStart(11) + ' ' +
    (f.absent_roas != null ? f.absent_roas.toFixed(2) : '—').padStart(9) + ' ' +
    (f.lift != null ? f.lift.toFixed(2) : '—').padStart(6));
}
P('');
P('TOP 15 CODES BY 21d ROAS (≥1M spend):');
P('  ' + 'code'.padEnd(20) + 'LP-family'.padEnd(12) + 'fmt'.padEnd(15) + 'spend'.padStart(12) + 'reg'.padStart(5) + 'CPR'.padStart(9) + 'ROAS'.padStart(7) + 'AprMay'.padStart(8) + 'traj'.padStart(7));
for (const r of out.top_codes.slice(0, 15)) {
  P('  ' + r.code.padEnd(20) + r.lp_family.padEnd(12) + (r.dominant_format || '—').padEnd(15) + fmt(r.window_spend).padStart(11) + ' ' + String(r.window_reg).padStart(4) + ' ' + fmt(r.window_cpr).padStart(8) + ' ' + (r.window_roas != null ? r.window_roas.toFixed(2) : '—').padStart(6) + ' ' + (r.apr_may_roas != null ? r.apr_may_roas.toFixed(2) : '—').padStart(7) + ' ' + (r.trajectory != null ? (r.trajectory >= 0 ? '+' : '') + r.trajectory.toFixed(2) : '—').padStart(6));
}
P('');
P('BOTTOM 10 BY 21d ROAS (≥2M spend):');
P('  ' + 'code'.padEnd(20) + 'LP-family'.padEnd(12) + 'fmt'.padEnd(15) + 'spend'.padStart(12) + 'reg'.padStart(5) + 'CPR'.padStart(9) + 'ROAS'.padStart(7) + 'AprMay'.padStart(8));
for (const r of out.bottom_codes.slice(0, 10)) {
  P('  ' + r.code.padEnd(20) + r.lp_family.padEnd(12) + (r.dominant_format || '—').padEnd(15) + fmt(r.window_spend).padStart(11) + ' ' + String(r.window_reg).padStart(4) + ' ' + fmt(r.window_cpr).padStart(8) + ' ' + (r.window_roas != null ? r.window_roas.toFixed(2) : '—').padStart(6) + ' ' + (r.apr_may_roas != null ? r.apr_may_roas.toFixed(2) : '—').padStart(7));
}
P('');
P('IMPROVING (Apr+May → 21d, ≥1M spend):');
for (const r of out.improving_codes) P('  +' + r.trajectory.toFixed(2) + '   ' + r.code.padEnd(20) + ' (' + r.lp_family + ', ' + (r.dominant_format || '—') + '): ' + (r.apr_may_roas || 0).toFixed(2) + ' → ' + (r.window_roas || 0).toFixed(2));
P('');
P('FADING:');
for (const r of out.fading_codes) P('  ' + r.trajectory.toFixed(2) + '   ' + r.code.padEnd(20) + ' (' + r.lp_family + ', ' + (r.dominant_format || '—') + '): ' + (r.apr_may_roas || 0).toFixed(2) + ' → ' + (r.window_roas || 0).toFixed(2));
