# Kurio Meta Ads — Action Plan & New Creative Briefs
*Generated 2026-05-17 · 2026 YTD ROAS data + 30-day spend overlay + LP-level conversion analysis*

Regenerate the underlying data with `npm run roas:build`, then `npm run roas:actionable` for the bucketed scale/pause table.

---

## TL;DR

- Currently spending **401M VND/month** across **134 alive codes** — too spread out
- Only **3 codes are at SCALE-grade ROAS (≥1.5×)**: `cx-94` (3.3×), `13-xpage-kv` (1.57×), `intro2-xpage` (1.55×)
- **~50M VND/month is actively burning** on 8 zero/sub-0.5× codes — pause them today (revised down from initial 67M after we kept `13-xpage-kv`)
- **17 historical winners are paused** (some with 2-5× ROAS) — refresh + relaunch the top 5
- **Biggest hidden lever**: `toantuduy.kurio.vn/thao` LP converts at **38.4%** vs **11.2%** for `/dang-ky` — a 3.4× gap. Most cold-paid creatives are pointing at the wrong LP.
- New creative direction: **authority voice** + **loss-regret hook** + **social-class contrast** — the three patterns hitting ROAS ≥1.5

---

## Q1 — The good campaigns (alive, ROAS at scale)

**Scale aggressively (ROAS ≥ 1.5, alive, has 30d spend)**
| Code | ROAS | 30d spend | Total revenue | Active ads |
|---|---:|---:|---:|---:|
| `cx-94` | **3.30** | 4.05M | 55.1M | 1 |
| `13-xpage-kv` | 1.57 | 6.30M | 9.9M | 1 |
| `intro2-xpage` | 1.55 | 18.77M | 29.4M | 4 |

**Hold (alive, profitable 1.0–1.5)**
| Code | ROAS | 30d spend |
|---|---:|---:|
| `code45-xp` | 1.45 | 13.27M |
| `code85-reup` | 1.34 | 6.70M |
| `code14-xpage` | 1.25 | 7.92M |
| `code13_xpage` | 1.18 | 11.81M |

**Historically winning but paused — top 5 relaunch candidates**
- `2-code13` — ROAS 1.69, 17.7M lifetime rev (same regret-narrative video as 13-xpage-kv)
- `code15_xpage` — 1.98, 11.1M
- `code125-xpage` — 2.03, 5.8M
- `ct21` — 3.57, 2.5M
- `code14-2` — 3.05, 2.6M

---

## Q2 — Pause today + reallocation

**PAUSE these 8 codes — frees ~50M VND/month**

| Code | 30d spend | Paid | Reason |
|---|---:|---:|---|
| `cx93-3` | 11.4M | 8/101 (8%) | ROAS 0.50 |
| `quảng cáo lượt tương tác mới` | 11.1M | **0/0** | Engagement objective, no lead capture |
| `ct18-xpage` | 10.9M | 3/25 | ROAS 0.48 |
| `ct19` | 10.8M | 8/77 | ROAS 0.43 |
| `45-xpage-kv` | 8.1M | 1/37 | ROAS 0.16 |
| `17x-kv` | 3.8M | **0/0** | ROAS 0.00, zero attribution |
| `ct19-xpage` | 3.6M | 1/13 | ROAS 0.47 |
| `code86-reup` | 0.8M | **0/2** | ROAS 0.00 |

(Originally also paused `83-xpage-kv` and `13-xpage-kv` under a sweeping "all kv is bad" rule — that was wrong. `13-xpage-kv` is still a SCALE-grade winner. `83-xpage-kv` is on the bubble at 0.67 — watch but don't pause yet.)

**REALLOCATE the freed ~50M/month to (proposed)**
| Code | Current 30d | Proposed | Δ |
|---|---:|---:|---:|
| `cx-94` (SCALE — 3.3× ROAS, biggest underfunded winner) | 4.05M | **15M** | +11M |
| `13-xpage-kv` | 6.3M | **12M** | +6M |
| `intro2-xpage` (modest scale, already big) | 18.8M | **24M** | +5M |
| `code45-xp` (profitable hold) | 13.3M | **17M** | +4M |
| Relaunch top 5 historical winners w/ refreshed creative | 0 | 5×2M = **10M** | +10M |
| Test 5 of the 8 new creative briefs (see Q4) | 0 | 5×3M = **15M** | +15M |
| **Total reallocation** | — | — | **~51M** |

Total monthly spend stays flat at ~401M, but concentrated on proven winners + a structured new-creative test pipeline.

---

## Q2.5 — The bigger LP-level finding (added after `kv` investigation)

LP conversion rates across the dataset are wildly uneven:

| LP | Phones | Paid | Conv% | Rev/phone |
|---|---:|---:|---:|---:|
| `ikmc.kurio.vn/luyen-thi-toan-kangaroo` | 110 | 49 | **44.5%** | **789k** |
| **`toantuduy.kurio.vn/thao`** | **1,032** | **396** | **38.4%** | **640k** |
| `toantuduy.kurio.vn/chinhphucdiem10` | 103 | 25 | 24.3% | 391k |
| `gioitoan.kurio.vn/` (root) | 319 | 60 | 18.8% | 304k |
| `gioitoan.kurio.vn/kurio` | 2,977 | 470 | 15.8% | 245k |
| **`gioitoan.kurio.vn/dang-ky`** | **197** | **22** | **11.2%** | **160k** ⚠️ |

`/dang-ky` is the bare form page — minimal content, just a form for cold traffic. `/thao` (toantuduy variant) is a fully built sales LP. The conversion gap is 3.4×.

**Actions on the LP front:**
- For all new creative tests (Briefs 1-8 in Q4), set destination URL to `/thao` first, `/kurio` second. **Never `/dang-ky` for cold paid traffic.**
- Investigate which ads currently send to `/thao` (and why it's only 1,032 phones — far below /kurio's 2,977 despite better conversion). Likely owned by a specific media buyer (the "Tuấn" in the URL); a distribution gap, not a fundamental supply ceiling.
- Older memory note (April 2026) about `_xpage` / `_xpage_kv` LPs being winners no longer applies — those LP paths don't exist; ads got repointed at `/dang-ky` and the funnel broke.

---

## Q3 — Patterns from the winners

Pulled the actual ad bodies for the top 15 ROAS codes. Three hook patterns dominate:

### Pattern A — Authority voice (highest ROAS: cx-94 = 3.30×)
> "Tôi là một giảng viên ngành Toán, tốt nghiệp Thạc sĩ chuyên ngành Phương pháp giảng dạy Toán học. Hơn 10 năm giảng dạy..."

Educational/expert voice. Long-form. Starts with credentials. Talks about the science of "giai đoạn vàng" (4-6yo brain development). Soft sell at the end.

### Pattern B — Loss-regret narrative (deployed 3× as different codes — `13-xpage-kv`, `2-code13`, `code13_xpage` — all 1.18–1.69 ROAS)
> "CHI 20 TRIỆU CHỈ ĐỂ NHẬN VỀ … SỰ THẤT VỌNG SAU 3 THÁNG HỌC TOÁN TƯ DUY"

Parent confesses to spending 20M VND on a bad tutoring center, then found Kurio for 1M/year. Specific number contrast (20M → 1M). Same creative video deployed across 3 ad codes — all winners.

### Pattern C — Social-class contrast hook
> "LÀ NGƯỜI GIÚP VIỆC NHƯNG CON LẠI GIỎI HƠN CON CHỦ NHÀ" (code128, 1.46 ROAS — 41.8M rev)
> "THU NHẬP 50TR NHƯNG CHI CHƯA TỚI 100K/THÁNG CHO CON HỌC TOÁN" (code45-xp, 1.45 ROAS)

Inverts assumed correlation between income/spend and outcome.

### Supporting elements every winner shares
- **Price anchor in body**: `3k/ngày` or `80-90k/tháng` (NOT generic "affordable")
- **Specific outcome numbers**: `+2-4 điểm`, `top 5`, `9 điểm thi chuyển cấp`
- **Format**: 9 of 15 winners are VIDEO (60%), 3 are long-form STATUS posts, 3 are SHARE/image-with-text
- **Body length**: 500-800 characters. Short bodies don't appear in winners.
- **CTA**: `LEARN_MORE` or `SIGN_UP` — both work
- **Link in body**: most winners include the LP URL inside the body text, not just as the click target

### Anti-patterns from losers
- **Gimmicky negative framing** ("TỘI TO NHẤT là 'học dốt Toán'") — `ct18-xpage` 0.48×
- **Extreme/unbelievable claim** ("suýt ở lại lớp → top 5") — `83-xpage-kv` 0.00×
- **Generic AI promise without story** — `17x-kv` 0.00×

---

## Q4 — 8 new ad copy briefs to test

Each combines a winning pattern with one **untested angle** (per the creative blind spots from prior analysis: screen-addiction, dad voice, lớp-5 entry-exam, topic-specific weakness).

### Brief 1 — Authority + screen-addiction reframe
**Code:** `cx-screentime-1`
**Hook:** "Tôi là chuyên gia tâm lý trẻ em – và đây là cách tôi biến thời gian xem điện thoại của con thành 30 phút học Toán"

> Tôi là chuyên gia tâm lý trẻ em. Hơn 8 năm tư vấn cho hàng nghìn phụ huynh, tôi nhận ra một sự thật buồn: 78% các con tiểu học đang dành 2-3 tiếng mỗi ngày xem video, chơi game không có giá trị giáo dục.
>
> Nhưng thay vì cấm – một việc gần như bất khả thi – tôi đã giúp các con đổi 30 phút màn hình mỗi ngày thành thời gian tự nguyện học Toán tư duy. Bí mật không phải là kỷ luật, mà là chọn đúng ứng dụng được thiết kế theo cơ chế gamification chuẩn quốc tế.
>
> Toán Kurio – ứng dụng được hơn 50,000 gia đình Việt Nam đang dùng – là một trong số ít app đạt chuẩn này. Con học mà như chơi: thi đấu với bạn (Combat), nuôi thú cưng Kurimon, mở khóa thử thách mỗi ngày. Quan trọng nhất: nội dung bám sát chương trình SGK của Bộ GD&ĐT, không phải game giải trí trá hình.
>
> Chỉ 3k/ngày để biến 30 phút "vô bổ" thành đầu tư cho não bộ của con. Đăng ký dùng thử miễn phí: https://toantuduy.kurio.vn/thao

**Format:** Long-form STATUS post or 90s video w/ child psychologist speaking to camera
**CTA:** LEARN_MORE
**Destination:** `/thao`

---

### Brief 2 — Loss-regret + lớp-5 entry exam pressure
**Code:** `regret-lop5-1`
**Hook:** "TÔI ĐÃ MẤT 15 TRIỆU LUYỆN THI VÀO LỚP 6 TRƯỜNG CHẤT LƯỢNG CAO – VÀ CON VẪN TRƯỢT"

> Năm ngoái nhà mình quyết tâm cho con thi vào lớp 6 trường chất lượng cao. 6 tháng trước kỳ thi, tôi đã chi 15 triệu cho khóa luyện thi tại trung tâm "uy tín". Lớp 20 cháu, một cô giáo chính + một trợ giảng, cam kết "đầu vào trường top".
>
> Con đi học chăm chỉ. Mỗi tối về vẫn làm thêm bài tập. Vậy mà ngày thi xong, mở phong bao đề ra – con bảo: "Mẹ ơi, dạng này con chưa gặp bao giờ." Kết quả: trượt 2 điểm.
>
> Sai lầm của mình: tôi đã chọn nơi dạy "kỹ thuật giải nhanh" thay vì nơi dạy "tư duy". Khi đề thi đổi format, con không có gốc tư duy để tự suy luận.
>
> Năm nay với em thứ hai, mình đổi hướng. Cho con học Toán Kurio – app tư duy có AI cá nhân hóa lộ trình theo điểm yếu của từng bé. Chỉ 80k/tháng. Con không cần "luyện đề" mà luyện cách nghĩ. Sau 3 tháng, mình kiểm tra bằng đề thi vào lớp 6 năm ngoái – con tự giải được 80%.
>
> Đăng ký dùng thử miễn phí 7 ngày tại đây: https://toantuduy.kurio.vn/thao

**Format:** VIDEO (parent-to-camera testimonial, 60-90s)
**CTA:** SIGN_UP
**Destination:** `/thao`

---

### Brief 3 — Social-class contrast + dad voice (untested gender angle)
**Code:** `dad-contrast-1`
**Hook:** "LÀ BỐ – TÔI KHÔNG HỌC TOÁN TỪ HỒI LỚP 9. NHƯNG CON GÁI TÔI LÀ HỌC SINH GIỎI TOÁN 3 NĂM LIỀN"

> Đàn ông tụi tôi thường để vợ lo việc học của con. Mình cũng vậy – tốt nghiệp đại học kỹ thuật xong, đi làm 15 năm, không động đến bài tập Toán nào.
>
> Cho đến cuối năm lớp 2, vợ mình bị áp lực công việc, nhờ mình kèm con học Toán. Mở quyển vở ra – tôi đứng hình. Phương pháp dạy giờ khác xưa hoàn toàn. Bài toán "tìm x" của lớp 2 đã có "tư duy logic", "phân tích đề"... những thứ tôi không biết giảng.
>
> Mình search 30 phút trên mạng, tìm thấy app Toán Kurio. Đăng ký gói 80k/tháng cho con tự học. Hai tháng đầu mình ngồi cạnh quan sát: bài giảng video sinh động, có AI giải thích từng bước, có nhân vật game cho con hứng thú.
>
> Bây giờ con gái mình lớp 4, là học sinh giỏi Toán 3 năm liền. Và mình – một ông bố không biết kèm con học – chỉ cần đảm bảo con mở app đúng 30 phút/ngày. Vậy thôi.
>
> Bố mẹ nào đang vật lộn dạy Toán cho con, thử Kurio: https://toantuduy.kurio.vn/thao

**Format:** VIDEO (dad-to-camera, casual home setting)
**CTA:** LEARN_MORE
**Destination:** `/thao`

---

### Brief 4 — Authority + topic-specific weakness (untested vertical)
**Code:** `cx-phantich-1`
**Hook:** "Giảng viên Toán THCS chia sẻ: 90% học sinh lớp 6 mất gốc vì KHÔNG HIỂU 1 KHÁI NIỆM DUY NHẤT này"

> Tôi đã dạy Toán THCS 12 năm tại Hà Nội. Mỗi đầu năm học, tôi đều khảo sát học sinh mới: phân tích đề bài. Kết quả không thay đổi qua các năm: 90% học sinh lớp 6 đọc đề Toán xong không biết "đề này cho gì, hỏi gì".
>
> Đây không phải lỗi của các con. Phương pháp dạy Tiểu học hiện tại tập trung vào "tính nhanh" thay vì "đọc hiểu đề". Khi lên cấp 2, đề bài trở nên phức tạp – con không có kỹ năng tách dữ kiện, không biết hỏi mình "muốn tìm gì". Hậu quả: điểm Toán tụt dốc từ giữa lớp 6.
>
> Tôi giới thiệu cho phụ huynh ứng dụng học Toán Kurio – một trong số ít chương trình tại Việt Nam dạy "phương pháp gợi mở tư duy" cho học sinh từ lớp 1. Bài tập của Kurio luôn bắt con trả lời câu hỏi "Đề cho gì? Hỏi gì? Cách giải?" trước khi tính. Kỹ năng phân tích đề được rèn từ sớm.
>
> Phụ huynh có con từ lớp 3-5 nên cho con bắt đầu ngay. Chỉ 3k/ngày: https://toantuduy.kurio.vn/thao

**Format:** Long-form STATUS post (matches cx-94 winning format)
**CTA:** LEARN_MORE
**Destination:** `/thao`

---

### Brief 5 — Anti-tutoring-center moment (untested specificity)
**Code:** `anti-trungtam-1`
**Hook:** "TỐI NAY CON KHÓC: 'MẸ ƠI CON KHÔNG MUỐN ĐI HỌC THÊM NỮA'"

> Tối qua đón con từ lớp học thêm Toán về, con im lặng cả đường. Vừa về đến nhà, con òa khóc: "Mẹ ơi con không muốn đi học thêm nữa. Cô giảng nhanh quá, con không hiểu mà không dám hỏi."
>
> Tôi nghẹn lại. Mỗi tuần con đi 3 buổi học thêm Toán, mỗi buổi 1.5 tiếng, mỗi tháng đóng 1.8 triệu. Vậy mà điểm Toán không cải thiện. Bây giờ con còn sợ học. Tôi đã làm gì sai?
>
> Đêm đó tôi suy nghĩ cả đêm. Nhận ra: lớp đông 20 bạn, cô giáo phải giảng theo tốc độ chung. Con tôi nhút nhát, không dám hỏi lại khi không hiểu. Cứ vậy 6 tháng – con tích tụ những "lỗ hổng" kiến thức không ai biết.
>
> Sáng hôm sau, tôi quyết định cho con nghỉ trung tâm. Đăng ký gói Kurio 1 năm – 1 triệu rưỡi cho cả 12 tháng. Con tự học 30 phút/tối ở nhà. AI của app tự dò ra điểm con yếu, ra bài tập riêng cho con. Con không phải so sánh với ai, không phải sợ bị mắng.
>
> Sau 4 tháng, con tự nguyện đăng ký thi học sinh giỏi Toán cấp trường. Tôi tiết kiệm được 5.4 triệu chi phí học thêm. Quan trọng hơn: con yêu Toán trở lại.
>
> https://toantuduy.kurio.vn/thao – đăng ký dùng thử 7 ngày miễn phí

**Format:** VIDEO (mom-to-camera, emotional, intimate)
**CTA:** SIGN_UP
**Destination:** `/thao`

---

### Brief 6 — Loss-regret with concrete failure mode
**Code:** `regret-mathmonster-1`
**Hook:** "TÔI ĐÃ BỎ 18 TRIỆU CHO MỘT APP TOÁN MỸ – CON HỌC 2 TUẦN RỒI BỎ"

> Lúc đầu tôi rất tự hào: đầu tư cho con một app Toán Mỹ đắt tiền, 18 triệu cho 3 năm. Nghĩ là app nước ngoài thì chất lượng, giao diện chuyên nghiệp.
>
> Tải về cho con học – con học được 2 tuần đầu hứng thú. Đến tuần thứ 3 con kêu: "Mẹ ơi nội dung không liên quan đến bài trên lớp. Lúc thầy hỏi con không trả lời được."
>
> Tôi mới giật mình: app Mỹ dạy theo chương trình Mỹ – Common Core. Bài giảng dùng đơn vị inch, pound, fahrenheit. Cách trình bày bài hoàn toàn khác SGK Việt Nam. Con học xong mà không áp dụng được vào bài tập trên lớp.
>
> 18 triệu đó coi như mất trắng.
>
> Sau đó mình tìm hiểu kỹ và chọn Toán Kurio – chương trình Việt Nam, bám sát SGK Bộ GD&ĐT, nhưng phương pháp gợi mở tư duy chuẩn quốc tế. Học phí 1.5 triệu/năm – bằng 1/10 chi phí cũ. Con học 3 tháng, điểm Toán trên lớp tăng từ 7 lên 9.
>
> Đừng để học phí cao đánh lừa: chọn app đúng chương trình mới quan trọng. https://toantuduy.kurio.vn/thao

**Format:** VIDEO or long STATUS
**CTA:** LEARN_MORE
**Destination:** `/thao`

---

### Brief 7 — Authority + giai đoạn vàng (refresh of cx-94 winning angle)
**Code:** `cx-goldenage-1`
**Hook:** "Bác sĩ Nhi khoa: 'Não trẻ 4-7 tuổi phát triển 90% kích thước trưởng thành – và Toán tư duy là cách kích hoạt mạnh nhất'"

> Tôi là bác sĩ Nhi khoa, 15 năm khám và tư vấn cho hàng nghìn bố mẹ về phát triển não bộ trẻ em. Có một con số mà tôi luôn nhắc phụ huynh: đến 7 tuổi, não trẻ đã đạt 90% kích thước người trưởng thành. Trong 7 năm đầu đời này, đặc biệt từ 4-7 tuổi, kết nối thần kinh được hình thành với tốc độ nhanh gấp 3 lần các giai đoạn sau.
>
> Đây là lý do các nước phát triển như Mỹ, Phần Lan, Singapore tích cực đưa Toán tư duy (chứ không phải Toán tính toán) vào chương trình Mầm non và đầu Tiểu học. Toán tư duy không yêu cầu con biết phép tính nhanh – nó rèn cách quan sát, phân tích, suy luận. Những kết nối thần kinh được kích hoạt trong giai đoạn này sẽ ảnh hưởng đến năng lực học tập của con suốt 15 năm tiếp theo.
>
> Tại Việt Nam, một trong số ít chương trình áp dụng đúng phương pháp này là Toán Kurio – ứng dụng có AI cá nhân hóa lộ trình theo độ tuổi và năng lực từng bé. Tôi giới thiệu Kurio cho phụ huynh có con từ 4-9 tuổi.
>
> Chỉ 3k/ngày để đầu tư vào "giai đoạn vàng" duy nhất trong đời con: https://toantuduy.kurio.vn/thao

**Format:** Long-form STATUS post (matches cx-94 winning format)
**CTA:** LEARN_MORE
**Destination:** `/thao`

---

### Brief 8 — Anti-gia sư social proof
**Code:** `anti-giasu-1`
**Hook:** "MUỐN CON GIỎI TOÁN: SA THẢI GIA SƯ – ĐĂNG KÝ APP 80K/THÁNG. ĐÂY LÀ LÝ DO"

> Trước đây tôi từng thuê 2 gia sư Toán – một cho con lớp 4, một cho con lớp 7. Tổng 3.5 triệu/tháng. Nghĩ là đầu tư xứng đáng vì gia sư trẻ, mới ra trường, năng lượng cao.
>
> Sau 6 tháng, tôi nhận ra 3 vấn đề:
>
> 1. Gia sư đến 1.5 tiếng/buổi, 2-3 buổi/tuần – tổng chỉ 18 tiếng/tháng. Còn lại 96% thời gian con tự học, không có người sửa sai.
>
> 2. Gia sư khác nhau, phương pháp khác nhau. Lúc thay người, con phải làm quen lại từ đầu.
>
> 3. Gia sư dạy theo bài tập trên lớp, chứ không có hệ thống "ra bài mới" theo điểm yếu của con. Con luôn học những thứ con đã biết, không bị thử thách.
>
> Tôi thử dừng gia sư, đăng ký Kurio cho cả 2 bé. Học phí 80k/tháng/bé. Tiết kiệm hơn 3 triệu/tháng.
>
> Quan trọng hơn: AI của Kurio kèm 1:1 mỗi ngày, dò chính xác con yếu chỗ nào, ra bài tập mới phù hợp. Con học 30 phút/ngày, đều đặn 7 ngày/tuần – tổng 14 tiếng/tháng – bằng 78% thời lượng gia sư đến, nhưng chất lượng cao hơn nhờ AI cá nhân hóa.
>
> 3 tháng sau, cả 2 con đều tăng điểm Toán 2-3 điểm. Tôi không thuê gia sư nữa.
>
> Test miễn phí 7 ngày: https://toantuduy.kurio.vn/thao

**Format:** VIDEO (mom-to-camera, kitchen/home setting)
**CTA:** SIGN_UP
**Destination:** `/thao`

---

## Implementation order (today → next 7 days)

1. **Today (5 min in Ads Manager)**: pause the 8 codes in Q2. Frees ~50M VND/month immediately.
2. **Today (15 min)**: increase budget on `cx-94` 4M → 15M, `13-xpage-kv` 6.3M → 12M.
3. **Tomorrow**: brief content team on the 8 new ad copies. Aim for 3-5 launched within 7 days at 3M VND/mo budget each. **All set destination = `/thao` (not `/dang-ky`).**
4. **Day 3**: relaunch top 5 paused historical winners (`2-code13`, `code15_xpage`, `code125-xpage`, `ct21`, `code14-2`) with refreshed video creative, 2M/mo each. **Confirm their destination LP is `/kurio` or `/thao`, never `/dang-ky`.**
5. **Day 7**: pull fresh ROAS via `npm run roas:build`, check which new briefs are tracking ROAS ≥ 1.5 in the first week. Kill duds, double budget on winners.
6. **Owner LP-redirect for /dang-ky**: any ad currently using `/dang-ky` as destination should be reviewed. The LP is the bare form (no sales copy) — 3.4× worse conversion than `/thao`. Either rebuild `/dang-ky` with full sales content, or redirect all paid traffic away from it.
