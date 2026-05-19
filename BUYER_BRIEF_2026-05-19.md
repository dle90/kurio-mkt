# Kurio Meta Ads — Brief cho team Marketing
*Cập nhật: 2026-05-19 · Dữ liệu: spend YTD + revenue Getfly + sheet leads → tính ROAS theo `utm_content` (code)*

ROAS = doanh thu Getfly / chi phí Meta · tính theo first-touch attribution mỗi số điện thoại.

> **⚠️ Cập nhật 2026-05-19 (sau khi sửa attribution):** Các con số ROAS trong brief này (bản gốc) được tính bằng phương pháp `account.created_at` cohort — credit toàn bộ lifetime revenue của khách hàng vào tháng họ đăng ký Getfly. Phương pháp này **undercount mạnh** revenue tháng gần (do không tính repeat-purchase từ khách hàng cũ) và **overcount** tháng cũ.
>
> **Số đúng (order-based, tính theo `sale_orders.real_amount` theo `created_at` mỗi đơn):**
> - `cx-94` ROAS không phải 3.24 — May 2026 thực = **1.23** (vẫn lãi nhưng KHÔNG phải winner lớn nhất). Đừng scale ×4 như section 2 đề xuất.
> - `cx93-3` không phải 0.53 cần pause — May 2026 thực = **0.62**, YTD 0.57. Borderline, không phải pause candidate rõ ràng.
> - `cx-93` May 2026 thực = **1.14** (không phải pause).
> - `code83-x3` May 2026 thực = **0.70** (không phải 0.56).
> - **Workhorse thật**: `intro2-xpage` (May 1.38, 17.6M spend), `13-xpage-kv` (May 1.79, 5.5M), `ct19-xpage` (May 1.58, 4.6M), `code45-xp` (May 1.26, 10.9M).
>
> **Pause list rút gọn (May ROAS ≤ 0.30 với spend đáng kể):** `83-xpage-kv` (0.00, 6.2M), `code118-xpage` (0.00), `code86-reup` (0.00), `cx` (0.00), `ct19` (0.15, 9.3M), `nm` (0.19), `ct18-xpage` (0.23, 9.6M). Tổng ~36M VND/tháng có thể tiết kiệm (không phải 98M như brief gốc).
>
> **Số liệu canonical hiện tại:** xem [data/roas-codes-ranked.csv](data/roas-codes-ranked.csv) (per-code monthly + weekly), [data/roas-currently-running.csv](data/roas-currently-running.csv) (26 code đang ACTIVE), [data/roas-cohort-age.csv](data/roas-cohort-age.csv) (cohort × age).
>
> Section 4 (landing page) và Section 5 (3 công thức ad) **vẫn đúng** — không phụ thuộc vào revenue attribution.

---

## 1. PAUSE hôm nay — 11 code đang chạy nhưng ROAS quá thấp

| Code | ROAS | Spend 30 ngày | Lý do |
|---|---:|---:|---|
| `code13-reup` (3 ad) | 0.57 | 12.1M | Đang đốt mạnh tuần này — burn rate cao nhất |
| `ct19` | 0.46 | 11.1M | Burn ổn định nhiều tuần |
| `ct18-xpage` | 0.45 | 11.1M | Hook "TỘI TO NHẤT" — không convert |
| `quảng cáo lượt tương tác mới` (3 ad) | 0.00 | 10.9M | Engagement objective, không capture lead |
| `45-xpage-kv` | 0.24 | 9.3M | Cùng creative với `code45-xp` nhưng convert kém — vấn đề ở landing page hoặc audience |
| `83-xpage-kv` | 0.00 | 7.6M | 56 leads, 0 paid — hook "suýt ở lại lớp → top 5" không đáng tin |
| `17x-kv` | 0.00 | 4.4M | 0 lead, 0 paid suốt — đổ tiền không có gì |
| `code118-xpage` | 0.00 | 4.0M | 15 leads, 0 paid |
| `code83-x3` | 0.56 | 12.8M | Cùng câu chuyện `83-xpage-kv` — cần dừng |
| `cx93-3` | 0.53 | 11.8M | Liên tục dưới breakeven |
| `cx` | 0.00 | 2.2M | Không có content rõ ràng |
| `code86-reup` | 0.00 | 1.4M | Reup không có hiệu quả |

**→ Tổng tiền tiết kiệm: ~98M VND/tháng**

---

## 2. SCALE UP — code đang lãi, cần tăng budget

| Code | ROAS | Spend 30d hiện tại | Đề xuất | Lý do |
|---|---:|---:|---:|---|
| `cx-94` | **3.24** | 3.9M | **15M** (×4) | Code lãi nhất trong tất cả — đang bị underfund mạnh. Format STATUS dài, hook "giảng viên Toán + giai đoạn vàng" |
| `intro2-xpage` | 1.50 | 20.9M | giữ hoặc +5M | Đã scale tốt tuần này, ROAS giữ vững. Video "tăng 2-4 điểm sau 1 tháng" |
| `13-xpage-kv` | 1.43 | 6.9M | **12M** (×2) | Video "20 triệu để nhận thất vọng" — bản chuyển code, vẫn convert tốt |
| `code45-xp` | 1.43 | 13.9M | giữ + 3M | Hook "thu nhập 50tr, chi <100k/tháng" — đang hoạt động ổn |
| `code85-reup` | 1.27 | 7.1M | giữ | Hook "9 điểm thi chuyển cấp" |
| `code14-xpage` | 1.07 | 8.7M | giữ + watch | Mới đạt profit gần đây |
| `code13_xpage` | 1.17 | 12.4M | giữ | Cùng câu chuyện regret 20tr → 1tr |
| `ct19-xpage` | 1.32 | 4.5M | +3M | Tuần trước phục hồi từ losing → profitable |

---

## 3. RELAUNCH — code đã pause nhưng historically tốt

5 code top từng lãi nhưng giờ tắt — refresh creative + chạy lại với budget 2M/tháng mỗi code:

| Code | ROAS lifetime | Revenue lifetime | Format |
|---|---:|---:|---|
| `2-code13` | 1.69 | 17.7M | Video — câu chuyện 20tr → 1tr |
| `code15_xpage` | 1.98 | 11.1M | Share — "30 NGÀY ĐỘT PHÁ" |
| `code125-xpage` | 2.03 | 5.8M | — |
| `ct21` | 3.57 | 2.5M | — |
| `code14-2` | 3.05 | 2.6M | — |

(`code128` ROAS 1.51 với 43.3M revenue cũng vừa tắt — nếu pause là cố ý thì OK, nếu là vô tình thì bật lại)

---

## 4. Landing page — quan trọng

| LP | Conversion | Note |
|---|---:|---|
| `toantuduy.kurio.vn/thao` | **39.0%** | Best convert — full sales LP |
| `ikmc.kurio.vn/luyen-thi-toan-kangaroo` | 38.9% | Cao nhưng volume nhỏ |
| `gioitoan.kurio.vn/kurio` | 25.0% | OK, traffic chủ lực |
| `gioitoan.kurio.vn/dang-ky` | **11.8%** | ⚠️ Đây là form trắng — convert kém 3.3× so với `/thao` |

**Đề nghị:** mọi ad mới (cold traffic) → set destination URL = `/thao` (ưu tiên 1) hoặc `/kurio` (ưu tiên 2). **Không dùng `/dang-ky`** cho ad cold paid — đó là page form không có sales copy.

---

## 5. 3 công thức ad đang work (để brief creative khi cần ad mới)

### A. **Authority voice** (cao nhất — `cx-94` 3.24)
> "Tôi là một giảng viên ngành Toán, tốt nghiệp Thạc sĩ chuyên ngành Phương pháp giảng dạy Toán học. Hơn 10 năm giảng dạy..."

Format: STATUS post dài, mở đầu bằng credentials, giải thích "giai đoạn vàng" 4-6 tuổi, soft sell cuối.

### B. **Loss-regret** (deployed 3 lần, 3 lần đều win — `13-xpage-kv` 1.43, `2-code13` 1.69, `code13_xpage` 1.17)
> "CHI 20 TRIỆU CHỈ ĐỂ NHẬN VỀ … SỰ THẤT VỌNG SAU 3 THÁNG HỌC TOÁN TƯ DUY"

Format: VIDEO 60-90s, parent confess đốt tiền trung tâm, đối chiếu 20tr → 1tr/năm Kurio.

### C. **Social-class contrast** (`code128` 1.51 — 43.3M rev, `code45-xp` 1.43)
> "LÀ NGƯỜI GIÚP VIỆC NHƯNG CON LẠI GIỎI HƠN CON CHỦ NHÀ"
> "THU NHẬP 50TR NHƯNG CHI CHƯA TỚI 100K/THÁNG CHO CON HỌC TOÁN"

Đảo lộn assumed-correlation thu nhập ↔ điểm số con.

### Yếu tố chung trong mọi ad win
- Có **price anchor** cụ thể: `3k/ngày`, `80-90k/tháng` (không nói "giá rẻ" chung chung)
- Có **outcome cụ thể**: `+2-4 điểm`, `top 5`, `9 điểm thi chuyển cấp`
- **Body 500-800 ký tự**, có link LP trong body
- CTA: `LEARN_MORE` hoặc `SIGN_UP` đều work
- 60% là VIDEO, 20% STATUS dài, 20% SHARE/image

### Tránh
- Negative framing kiểu joke ("TỘI TO NHẤT là học dốt Toán") — `ct18-xpage` 0.45
- Claim quá khó tin ("suýt ở lại lớp → top 5") — `83-xpage-kv` 0.00
- AI promise generic không có story — `17x-kv` 0.00

---

## Tóm tắt action

1. **Pause 11 code** (tiết kiệm ~98M/tháng)
2. **Scale `cx-94` từ 3.9M → 15M** (winner lớn nhất, đang underfund)
3. **Tăng `13-xpage-kv` lên 12M**
4. **Relaunch 5 code historical winner** ở mức 2M/mỗi code = 10M
5. **Mọi ad mới → LP `/thao`** (không `/dang-ky`)
6. **Brief creative mới** theo 3 công thức A/B/C ở trên (8 brief sẵn trong tài liệu nội bộ nếu cần)

Câu hỏi cần trả lời từ team:
- `Quảng cáo Lượt tương tác mới` đang chạy ~11.5M/tháng cho engagement IKMC — có ai đang đo brand metric đó không? Nếu không thì pause.
- 5 code "historical winner" đã pause — có lý do gì cụ thể không? (tốt nhất biết trước khi relaunch)
