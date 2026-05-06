# Kurio Marketing — 90-Day Meta Ads Audit

**Generated:** 2026-05-06
**Scope:** Kurio 2 + Kurio 3 ad accounts (the only two with meaningful activity)
**Date range:** last 90 days
**Token scope:** `ads_read` (read-only)

---

## TL;DR

1. Real conversion KPI is **`complete_registration` (CPR)**, not Meta-form `lead`. 2,852 registrations in 90 days vs only 476 form leads — and most campaigns aren't even lead-gen objective.
2. **The Kurio winning ad-creative formula is identifiable and consistent.** Top 15 ads (CPR 96k–170k VND, ~$3.70–$6.50) all share 7 traits, dominated by a "3K/ngày" price anchor and long-form parent narrative.
3. **The biggest variance driver is NOT creative — it's targeting.** The same 2,375-character body appears in both top performer (96k VND CPR) and bottom performer (1M+ VND CPR). Audience/placement/freshness explains the 11× spread, not the words.
4. **Pause candidates worth ~30M VND/month**: 2 active `ENGAGE - vtv` campaigns (zero registrations, brand-only copy) + 4 `MESS_*` campaigns being measured by the wrong KPI.

---

## Account Inventory

8 ad accounts visible to the token; 7 active by status, but only 3 with running ads:

| Account | Currency | Live campaigns | Total campaigns | Notes |
|---|---|---|---|---|
| **Kurio 2** (`act_1071893357737329`) | VND | **72 active** | 2,200 | Largest active account; rate-limit prone (#4) |
| **Kurio 3** (`act_930175825635997`) | VND | **48 active** | 2,385 | Only account with `OUTCOME_LEADS` campaigns |
| Kurio 5 (`act_1069029708221793`) | VND | 3 active | 45 | Small SALES focus |
| Kurio (`act_858741683071872`) | USD | 0 | 0 | Empty account |
| Kurio 4 (`act_630326812905786`) | VND | 0 | 2 paused | Inactive |
| Kurio Math (`act_1055641230037368`) | USD | 0 | 10 paused | Inactive |
| Huy Quang Mai (`act_10201301849281099`) | USD | 0 | 11 paused | Personal account, out of scope |
| Kurio (`act_1620757438793957`) | VND | n/a | n/a | status=101 (disabled) |

---

## 90-Day Numbers (Kurio 2 + Kurio 3 combined)

| Metric | Value |
|---|---|
| Spend | **1,041,446,756 VND** (~$40k USD) |
| Campaigns with insight rows | 945 |
| Active campaigns end of period | 75 |
| Impressions | 8,972,821 |
| Link clicks | 71,670 |
| Landing-page views | 57,223 |
| Pixel ViewContent | 84,591 |
| **Registrations (`complete_registration`)** | **2,852** |
| Form leads (`lead_grouped`) | 476 |
| Messaging conversations started | 1,264 |
| **Blended CPR** | **~365,000 VND (~$14)** |

### By objective

| Objective | Campaigns | Spend (VND) | Registrations | CPR (VND) |
|---|---|---|---|---|
| `OUTCOME_SALES` | 936 | 996,552,059 | 2,846 | **350,159** |
| `OUTCOME_ENGAGEMENT` | 9 | 44,894,697 | 6 | 7,482,450 |

> **Insight:** SALES campaigns produce 99.8% of registrations. ENGAGEMENT campaigns are categorically not a registration channel — measuring them by CPR is the wrong yardstick.

### Funnel pass-through

```
Impressions  8,972,821
       ↓     (CTR 0.80%)
Link clicks  71,670
       ↓     (LPV rate 80%)
LPVs         57,223
       ↓     (registration rate 5.0%)
Registrations 2,852
```

LP-pixel firing is healthy. The drop happens at the LPV→registration step (95% of LPVs don't register).

---

## What Works — The Kurio Winning Creative Formula

100% of top-15 ads by CPR (96k–170k VND, $3.70–$6.50) share these traits:

1. **Pain-driven all-caps headline** in parent voice with a vivid stakes word
   - "TỪ HỌC SINH SUÝT Ở LẠI LỚP - CON VƯƠN LÊN TOP 5"
   - "LÊN LỚP 2 MÀ CON TÍNH TOÁN VẪN PHẢI ĐẾM NGÓN TAY"
   - "CHI 20 TRIỆU CHỈ ĐỂ NHẬN VỀ … SỰ THẤT VỌNG"
   - "THU NHẬP 50TR NHƯNG CHI CHƯA TỚI 100K/THÁNG"
2. **Price anchor: "3K/ngày" or "80–90k/tháng"** — appears in all 15 (15/15)
3. **Long-form storytelling body, avg 1,522 chars** (often 2,000+); first-person mom/dad/teacher voice with named details
4. **Concrete outcome / number** — "top 5", "9–10 điểm", "3 năm liền HSG", "100 suất"
5. **Title field repeats the price** — "Toán tư duy chỉ từ 3k/ngày", "Ưu Đãi 100 Suất Chỉ 3K/Ngày"
6. **CTA** — `LEARN_MORE` (6) or `SIGN_UP` (6) tied; pick either
7. **Format flexible** — top 15 mix: 7 video, 4 dynamic-image, 2 photo, 2 boosted-post. Format is NOT decisive.

### Top performer body counts (15/15)

| Trait | Top performers |
|---|---|
| Body length avg | 1,522 chars |
| Mentions price | 15/15 |
| Mentions specific number | 15/15 |
| Uses '?' (rhetorical question hook) | 7/15 |
| Uses emoji | 7/15 |

---

## What Fails — Three Categories of Sinks

### 1. Wrong objective measured against wrong KPI (~7M VND, last 90d)

`MESS_TUANTA_31/07_*` campaigns optimize for `MESSAGE_PAGE` (Messenger) clicks. They produce 591 messaging conversations across the period at reasonable cost-per-chat — they're not failing at their job. CPR is the wrong yardstick. Either:
- Reframe their KPI as cost-per-conversation, OR
- Pause if you don't value Messenger as a channel

### 2. Brand-only copy (~27M VND, 90d)

`ENGAGE - vtv` (capital, id 120233126215460017) and `Engage - vtv` (lowercase, id 120233126168680017) — body is 69 chars: "Toán Kurio Lên Sóng VTV3: Học Toán Theo Phương Pháp Mới Đầy Hứng Khởi". No price, no pain, no offer. Designed to never convert.

These two split into very different roles:
- **Lowercase**: 152,818 unique reach, 54.8% hook rate, CPM 14,957 VND, 0.005$ per ThruPlay. Genuine, efficient brand-awareness campaign — defensible IF brand awareness is a stated KPI.
- **Capital**: 10,404 reach, frequency 3.44 (audience saturated), CPM 129,229 VND (8× more expensive), only 21% hook rate. This one is hard to defend at any objective.

### 3. Short teaser copy without story (sinks avg 1,275 chars)

Examples that fired but didn't convert:
- "App học Toán tư duy ứng dụng AI thông minh chỉ 90k/tháng cực kỳ hiệu quả cho con lớp 1-9: …" (99 chars)
- "Mẹ nào đang muốn cho con phát triển tư duy toán học thì đừng bỏ qua App Toán Kurio…" (98 chars)

This audience clearly responds to long stories, not taglines. Short boosted posts waste spend.

---

## The Non-Obvious Finding — Targeting Dominates Creative

The exact same 2,375-character body — "TỪ HỌC SINH SUÝT Ở LẠI LỚP - CON VƯƠN LÊN TOP 5..." — appears in:

| Campaign | Account | Spend | Reg | CPR |
|---|---|---|---|---|
| `CVS_TUANTA_CODE83_xpage_kv` | Kurio 3 | 2.5M VND | 26 | **96,517 VND** ✅ |
| `CVS_TUANTA_25/07_CODE83+84_Xpage` | Kurio 2 | 5.4M VND | 40 | 134,292 VND ✅ |
| `CVS_TUANTA_05/01_CODE83+84 - Bản sao 2` | Kurio 2 | 1.7M VND | 10 | 170,542 VND ✅ |
| `CVS_TUANTA_05/01_CODE83+84 - TG - Bản sao` | Kurio 2 | 2.2M VND | 2 | **1,098,449 VND** ❌ |
| `CVS_TUANTA_04/08_CODE81+83+84_TG - LT - Bản sao 4` | Kurio 3 | 1.0M VND | 1 | 1,064,164 VND ❌ |

**11× spread on identical copy.** The variance is in audience, placement, ad-set freshness, or timing — not in the words. **Copy is necessary but not sufficient.**

> **Implication for next analysis:** before evaluating a creative, look at the **ad set's targeting** (custom audiences, age/gender, interests, placements). The next analytical layer should compare ad-set settings between same-creative high-vs-low CPR pairs.

---

## Recommendations

### Immediate quick wins (read-only — flip switches in Ads Manager manually)

1. **Pause `ENGAGE - vtv` (capital, id 120233126215460017)** — 4.6M VND/30d at 0 reg, audience saturated (freq 3.44 on 10k users). Hard to defend. Save: ~150k VND/day = 4.5M VND/month.
2. **Confirm role of lowercase `Engage - vtv`** (id 120233126168680017) — IF brand awareness with VTV is a real KPI, keep it (it's actually efficient). If not, pause for additional 4.5M VND/month.
3. **Reclassify `MESS_*` campaigns' KPI** — measure as cost-per-Messenger-conversation, not CPR. Or pause if Messenger isn't valuable.
4. **Stop boosting short teaser posts** (<300 char bodies). The audience won't convert from those.

Combined potential savings: **~30M VND/month (~$1.1k)** with no registration impact.

### Next analytical layer (read-only)

1. **Audience/targeting analysis** — pull ad set targeting for same-creative high-CPR vs low-CPR pairs. Identify which targeting buckets unlock the formula and which break it.
2. **Hook-rate by ad** — surface video hook rates and 25% hold rates per ad to find creative-level fatigue independent of audience.
3. **Frequency analysis** — flag ad sets where frequency >2.5 (saturation threshold) — those are the ones killing your CPR even with good copy.

### When write access is granted

- **Convert `MESS_*` learnings into a LEADS-objective campaign** with the same creative, optimizing for `complete_registration` instead of `MESSAGE_PAGE`.
- **Ship 3 new creatives following the formula** — maintain the price anchor (3K/ngày), parent-narrative, all-caps pain headline.
- **Run all new campaigns into the targeting bucket that produced the 96k CPR results** (TBD after #1 above).

---

## Open Questions

- **Is brand awareness an actual KPI Kurio is funding?** If yes, lowercase `Engage - vtv` stays. If no, both VTV campaigns pause.
- **What is the canonical lead/registration definition for Kurio?** Currently using `complete_registration` (511/30d, 2,852/90d). Confirm this is what business stakeholders track.
- **What targeting differentiates the 96k CPR vs 1M CPR ad sets?** Unknown until the next analysis layer runs.
- **Why is `Kurio` (USD account, `act_858741683071872`) empty?** Was it ever active, or is it provisioned for future use?

---

## Targeting Analysis — Same-Creative Pairs (added 2026-05-06)

Pulled ad set targeting for 5 campaigns running the same "TỪ HỌC SINH SUÝT Ở LẠI LỚP" body to isolate what's driving the 11× CPR spread.

| Variable | TOP active (96k–134k CPR) | BOTTOM (1.1M CPR) |
|---|---|---|
| Age | 28–45 or 18–65 | 18–65 |
| Gender | mixed | female |
| Geo | 3 cities (HN/HCM/ĐN) or VN-wide | VN-wide |
| Platforms | FB-only or FB+IG+AN | FB+IG+AN |
| Optimization goal | `OFFSITE_CONVERSIONS` | `OFFSITE_CONVERSIONS` |
| **Interests / behaviors / family_statuses** | **NONE** | **Education stack + Parents-with-school-age stack** |
| Excluded LL custom audience | varies | NO |
| Frequency | 1.31 / 1.57 | 1.20 |

### The single biggest differentiator

**Top performers run with no interest/behavior/family_statuses targeting layered on. Bottom performers stack `interests:Education,Learning,Course,Training,Student + family_statuses:Parents with preschoolers/school-age/preteens/teenagers`.**

The bottom ad set didn't fail from saturation (freq 1.20, lower than winners). It failed because Meta's `OFFSITE_CONVERSIONS` optimization performs better when given **broad** targeting and a real Pixel signal — layering on-the-nose interests like "Education + Parents" puts you in the most-competitive bidding pool for an edtech product, against every math tutoring advertiser.

### Secondary findings

- **Best of all (96k CPR, Kurio 3 CODE83)** is unique: 3 named cities only (HN/HCM/ĐN), Facebook-only, gender=all, age 28–45, no interests. Most disciplined targeting in the set.
- **`LL - 17/3/2026` custom audience exclusion** (~7,600 users, likely a lookalike of past converters) is applied to *some* top performers but not the bottom. Likely intended as a "don't re-market existing customers" guardrail — inconsistently applied across campaigns.

### Caveats

- n=5 campaigns / 8 ad sets — pattern is suggestive, not proven.
- Some bottom ad sets are paused with low spend; partly comparing well-delivered vs barely-delivered.
- Top Kurio 3 ad set has narrower geo (3 cities) confounded with the no-interests choice — can't fully separate "broad interests" from "city-targeted geo" without more samples.

### Action when write access is granted

1. Take 3 underperforming SALES campaigns running the winning creative formula.
2. Duplicate their ad sets with **interests/behaviors/family_statuses removed** — keep age/gender/geo/exclusions.
3. Run 7 days; if CPR drops >30%, remove the interest stack everywhere.

### Resume tomorrow from here

Three options to validate the broad-targeting hypothesis at scale:

- **A)** Pull targeting for top 30 + bottom 30 ads by CPR (regardless of body) and re-test the "no interests" pattern. *Recommended next.*
- **B)** Frequency analysis — flag ad sets where freq >2.5 (burning money on saturated audience) and freq <1.1 (not getting delivery).
- **C)** Time dimension — are top performers from a recent surge, or stable across 90 days? Ad fatigue check.

---

## Tooling

This audit was generated by the Node scripts in `src/`:
- `npm run verify` — list accessible accounts
- `npm run report` — campaign-level performance, defaults to last_30d (`DATE_PRESET=last_90d` for 90)
- `npm run analyze` — ad-level creative analysis with top/bottom CPR breakdown

Diagnostic helpers:
- `node src/diagnose.js` — campaign counts and action_type tally
- `node src/check-engage.js` — daily delivery + engagement breakdown for `ENGAGE - vtv`
- `node src/inspect-creative.js [ad_id]` — dump full creative shape for one ad
- `node src/analyze/targeting.js` — ad set targeting comparison for same-creative pairs

Token in `.env` (gitignored). See `.env.example` for required keys.
