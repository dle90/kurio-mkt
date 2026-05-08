// Categorize the deep creative dataset along multiple axes and report CPR/efficiency by category.
// Reads creatives-deep-results.json. Writes creatives-categorized.json + console summary.

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('creatives-deep-results.json', 'utf8'));
const ads = data.ads.filter(a => a.objective !== 'OUTCOME_ENGAGEMENT'); // exclude brand-only

// --- categorization heuristics on body+title (Vietnamese text, lowercased) ---
function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ' '); }

function categorize(ad) {
  const body = norm(ad.body) + ' ' + norm(ad.title) + ' ' + norm(ad.description);
  const head = (ad.body || '').split('\n')[0] || '';
  const headNorm = norm(head);
  const bodyLen = (ad.body || '').length;

  const cats = {
    // ----- PAIN-POINT / ANGLE categories -----
    pain_behind_grade: /(lên lớp \d|suýt ở lại|đếm ngón tay|chậm hiểu|tiếp thu chậm|kém toán|sợ toán|ghét toán|mất gốc|không theo kịp|học yếu)/.test(body),
    pain_expensive_failure: /(20 ?triệu|20tr|chi.*triệu|tiền triệu|đắt mà|gia sư.*nhưng|trung tâm.*nhưng|mất tiền|tốn tiền)/.test(body),
    pain_screen_addiction: /(nghiện điện thoại|nghiện game|nghiện ipad|cắm mặt|dán mắt|tiktok|youtube|chơi game)/.test(body),
    pain_parent_guilt: /(thu nhập|lương|kiếm.*tháng|đi làm về|không có thời gian|bận rộn|mẹ không|bố không)/.test(body),
    pain_peer_compare: /(con nhà người ta|bạn bè|bạn cùng lớp|hàng xóm|cháu chị|con chị|anh chị họ|so với bạn)/.test(body),
    pain_homework_struggle: /(bài tập|làm bài|loay hoay|kèm bài|dạy bài|cô giáo phàn nàn|cô gọi|nhắn cô)/.test(body),
    pain_test_anxiety: /(thi cử|kiểm tra|sắp thi|ôn thi|áp lực thi)/.test(body),
    pain_low_score: /(điểm 5|điểm 6|điểm thấp|điểm kém|toàn điểm|3 điểm|4 điểm)/.test(body),

    // ----- ASPIRATION / OUTCOME categories -----
    aspire_top_student: /(top \d|hsg|học sinh giỏi|9-10 điểm|9 ?-?10|điểm 10|9,10|đứng top|xuất sắc)/.test(body),
    aspire_competition: /(ikmc|cuộc thi|olympic|toán quốc tế|huy chương|giải nhất|giải nhì|giải ba|đoạt giải)/.test(body),
    aspire_thinking_skills: /(tư duy|tư duy logic|tư duy toán học|tư duy phản biện|phát triển não|trí thông minh|iq)/.test(body),
    aspire_independent: /(tự học|chủ động|tự giác|tự làm bài|không cần kèm)/.test(body),

    // ----- AUTHORITY / SOCIAL PROOF -----
    proof_vtv: /\bvtv\b/.test(body),
    proof_singapore: /(singapore|sing-?apore math)/.test(body),
    proof_finland: /(phần lan|finland|finnish)/.test(body),
    proof_cambridge: /\bcambridge\b/.test(body),
    proof_ai: /(ai|trí tuệ nhân tạo|công nghệ|app thông minh|cá nhân hoá|cá nhân hóa)/.test(body),
    proof_teacher: /(thầy|cô giáo|giáo viên|cô.*kurio)/.test(body),
    proof_testimonial: /(mẹ.*con|bố.*con|chia sẻ|kể lại|tâm sự|câu chuyện|phụ huynh.*chia sẻ)/.test(body),
    proof_celebrity: /(diễn viên|ca sĩ|mc|hoa hậu|nghệ sĩ|nổi tiếng)/.test(body),
    proof_school_use: /(trường.*dùng|trường học|học sinh.*trường|được nhà trường)/.test(body),

    // ----- OFFER / SCARCITY / PRICE -----
    price_3k: /3k\/ngày|3 ?k\/ngày|3\.000\/ngày|chỉ.*3k|ưu đãi.*3k/.test(body),
    price_per_month: /(\d{2,3}k\/tháng|\d{2,3}\.000\/tháng|80k|90k)/.test(body),
    price_mentioned: /(\d+k\/(ngày|tháng)|\d{2,3}\.000\s*đ?\/(tháng|ngày))/.test(body),
    offer_scarcity: /(\d+ ?suất|chỉ còn|hết hạn|cuối cùng|sắp hết|deadline|hôm nay|đăng ký ngay|nhanh tay)/.test(body),
    offer_freetrial: /(học thử|miễn phí|free|trải nghiệm|dùng thử)/.test(body),
    offer_guarantee: /(cam kết|đảm bảo|hoàn tiền|guarantee|nếu không|được hoàn)/.test(body),

    // ----- GRADE LEVEL TARGETING -----
    grade_preschool: /(mầm non|mẫu giáo|5 tuổi|6 tuổi|chuẩn bị vào lớp 1|tiền tiểu học)/.test(body),
    grade_1: /\blớp 1\b/.test(body),
    grade_2: /\blớp 2\b/.test(body),
    grade_3: /\blớp 3\b/.test(body),
    grade_4: /\blớp 4\b/.test(body),
    grade_5: /\blớp 5\b/.test(body),
    grade_6_9: /\blớp [6-9]\b/.test(body),
    grade_range_1_9: /lớp 1\s*-\s*9|lớp 1 đến lớp 9/.test(body),
    grade_range_1_5: /lớp 1\s*-\s*5|tiểu học/.test(body),

    // ----- TONE / STRUCTURE -----
    tone_question_hook: /^[^.\n]{0,120}\?/.test(ad.body || ''),
    tone_all_caps_head: /[A-ZĐÂÊÔƠƯÁÀẢÃẠẤẦẨẪẬẮẰẲẴẶÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]{8,}/.test(head),
    tone_emoji: /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(ad.body || ''),
    tone_dad_voice: /\b(bố|cha|ba)\s+(con|tôi|mình)/.test(body),
    tone_mom_voice: /\b(mẹ|má)\s+(con|tôi|mình)/.test(body),

    // ----- LENGTH BUCKETS -----
    len_short: bodyLen < 300,
    len_med: bodyLen >= 300 && bodyLen < 1000,
    len_long: bodyLen >= 1000 && bodyLen < 2000,
    len_xlong: bodyLen >= 2000,

    // ----- LANDING PAGE family (from url_tags or campaign name) -----
    lp_xpage_kv: /xpage_kv/i.test((ad.url_tags || '') + ' ' + (ad.campaign || '')),
    lp_xpage: /_xpage(?!_kv)/i.test((ad.url_tags || '') + ' ' + (ad.campaign || '')),
  };
  return cats;
}

const enriched = ads.map(a => ({ ...a, cats: categorize(a) }));

// --- aggregate by category: spend, reg, blended CPR, ad count, % zero-reg ---
const allCats = Object.keys(enriched[0].cats);

function summarize(rows) {
  let spend = 0, reg = 0, n = 0, zeroReg = 0, lpv = 0, impr = 0;
  for (const r of rows) {
    spend += r.spend; reg += r.registrations; n += 1;
    if (r.registrations === 0) zeroReg += 1;
    lpv += r.lpv; impr += r.impressions;
  }
  return {
    n,
    spend: Math.round(spend),
    reg,
    cpr: reg > 0 ? Math.round(spend / reg) : null,
    cplpv: lpv > 0 ? Math.round(spend / lpv) : null,
    pct_zero_reg: n > 0 ? Math.round(100 * zeroReg / n) : 0,
    avg_cpr_present: rows.filter(r => r.cpr).length > 0
      ? Math.round(rows.filter(r => r.cpr).reduce((s, r) => s + r.cpr, 0) / rows.filter(r => r.cpr).length)
      : null,
  };
}

// global baseline
const baseline = summarize(enriched);
console.log('=== BASELINE (228 SALES ads, 90d, spend >= 1M VND) ===');
console.log(baseline);
console.log();

// per-category
console.log('=== CATEGORY PRESENCE — ad count, blended CPR, %zero-reg ===\n');
const rows = [];
for (const c of allCats) {
  const present = enriched.filter(a => a.cats[c]);
  const absent = enriched.filter(a => !a.cats[c]);
  const sP = summarize(present);
  const sA = summarize(absent);
  rows.push({
    category: c,
    present_n: sP.n,
    present_cpr: sP.cpr,
    absent_cpr: sA.cpr,
    delta: sP.cpr && sA.cpr ? Math.round(100 * (sP.cpr - sA.cpr) / sA.cpr) : null,
    present_pct_zero: sP.pct_zero_reg,
    absent_pct_zero: sA.pct_zero_reg,
    present_spend: sP.spend,
    present_reg: sP.reg,
  });
}

// sort by present_n desc, then delta
rows.sort((a, b) => (b.present_n || 0) - (a.present_n || 0));
console.log(
  ['category', 'n', 'cpr+', 'cpr-', 'Δ%', '0reg+', '0reg-', 'spend+', 'reg+'].map(s => s.padEnd(12)).join(' | ')
);
console.log('-'.repeat(110));
for (const r of rows) {
  console.log([
    r.category.padEnd(28),
    String(r.present_n).padStart(4),
    String(r.present_cpr ?? '-').padStart(7),
    String(r.absent_cpr ?? '-').padStart(7),
    String(r.delta ?? '-').padStart(5),
    String(r.present_pct_zero).padStart(5),
    String(r.absent_pct_zero).padStart(5),
    String(Math.round((r.present_spend || 0) / 1_000_000)).padStart(6) + 'M',
    String(r.present_reg).padStart(5),
  ].join(' | '));
}

// --- top performers by category to spot winning angles ---
console.log('\n=== ANGLES THAT NEVER (or barely) APPEAR — count of present ads ===\n');
for (const r of rows.filter(r => r.present_n <= 5).sort((a, b) => a.present_n - b.present_n)) {
  console.log(`  ${r.category.padEnd(28)} present in ${r.present_n} ads`);
}

// dump
fs.writeFileSync('creatives-categorized.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  baseline,
  category_summary: rows,
  ads: enriched.map(a => ({
    ad_id: a.ad_id, ad_name: a.ad_name, account: a.account,
    campaign: a.campaign, adset: a.adset,
    spend: a.spend, registrations: a.registrations, cpr: a.cpr,
    body_length: (a.body || '').length, format: a.format, cta: a.cta,
    cats: a.cats,
    body_preview: (a.body || '').slice(0, 240),
    head: (a.body || '').split('\n')[0],
  })),
}, null, 2));
console.log('\nWrote creatives-categorized.json');
