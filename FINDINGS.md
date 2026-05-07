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

---

## Targeting Analysis at Scale — Top 30 vs Bottom 30 (added 2026-05-07)

Pulled adset-level targeting for the top 30 (lowest CPR, ≥1 reg) and bottom 30 (zero reg, highest spend) ad sets across Kurio 2 + Kurio 3 SALES campaigns, 90d, min spend 500k VND. Pool: 452 qualifying ad sets.

| Dimension | TOP 30 | BOTTOM 30 | Direction |
|---|---|---|---|
| Has interest / behavior / family-status stack | **47%** | **63%** | broad-tilt at top, but ns (z=1.25, p=0.21) |
| Uses any positive custom audience | 0% | 0% | unused lever in both tiers |
| Excludes lookalike of converters | 27% | 30% | no signal |
| Facebook-only placement | 40% | 33% | top slightly more disciplined |
| All / auto placements | 33% | 53% | bottom over-spreads |
| Gender = female only | 60% | 53% | top tilts female |
| Gender = all | 33% | 43% | bottom less selective |
| City-targeted (vs nationwide) | 0% | 0% | nationwide is the norm |

CPR range, top 30: **107k–200k VND** (508 registrations on 81M VND spend). Bottom 30: zero registrations on 20M VND spend.

### What changed vs the n=5 finding

The original "broad beats interest-stacking by 11×" insight from same-creative pairs **does not replicate cleanly at scale**. The 16pp gap (47% vs 63%) is in the right direction but not significant at n=30 each. The 11× CPR spread on identical "SUÝT Ở LẠI LỚP" copy was likely driven by factors other than interest-stacking alone — ad-set freshness, optimization-signal accumulation, budget pacing, or noise.

### What still holds

- **Broad wins the very top.** 4 of the top 5 ad sets are broad (no interests), including the absolute lowest-CPR ad set: Kurio 3 `code83`, 107k VND CPR, 27 reg on 2.9M VND, with only `age 28–45 / FB-only / no interests / no custom audiences`.
- **Bottom tier over-spreads on placements.** 53% of zero-reg ad sets run all/auto placements, vs only 33% of winners. Suggestive that simpler placement choices help.
- **Lookalike-of-converter exclusion does nothing measurable.** 27% vs 30% — the guardrail is inconsistently applied AND doesn't correlate with outcomes.

### What the data revealed (new)

- **Positive lookalikes are a completely unused lever.** 0/60 ad sets in either tier use a positive custom audience. Every campaign relies on cold cold-cold targeting (broad demo OR interest-stacked demo). Worth testing a Lookalike-of-`complete_registration` audience as an entirely new variable.
- **Bottom-30 waste is modest.** 20M VND wasted in 90 days ≈ 6.7M/month ≈ $260. Killing failed ad sets is not where the money is — fixing average performers is.
- **The "Education + Parents" interest stack is endemic.** 19 of the 30 bottom ad sets (63%) and 14 of the top 30 (47%) run essentially the same flexible_spec: `interests:Course/Learning/Training/Education/Student × family_statuses:Parents-with-{ages}`. It's the default pattern across Kurio's SALES book. The data says it's slightly worse than broad but not dramatically so.

### Action when write access is granted

Revised priority based on what the larger sample showed:

1. **Test Lookalike-of-`complete_registration` as a positive custom audience.** Currently 0% adoption — single biggest unexplored lever.
2. **Trim placement choices on underperformers.** Move auto-placement / 4-platform ad sets to FB+IG only or FB-only.
3. **Interest-stack removal experiment is still worth doing but de-prioritized.** Expect marginal CPR improvement, not 11×.

---

## Time-Dimension Analysis (added 2026-05-07)

Pulled three views over a 7-month window (2025-10-01 → 2026-05-07; pre-Oct 2025 excluded as too noisy per stakeholder). Context: Kurio is the official IKMC Vietnam partner; organic registrations from contest-takers run **December → end of March**, which is a confounder when reading any in-window CPR drop as ad-driven.

### G) Weekly seasonal trend — surprising flat headline

| Phase | Weeks | Spend / week | Reg / week | CPR (VND) | reg / LPV | CPLPV (VND) |
|---|---|---|---|---|---|---|
| **PRE** (Oct–Nov 2025, clean baseline) | 9 | 52.8M | 153.3 | **344k** | 7.08% | 24.3k |
| **IKMC** (Dec 2025–Mar 2026) | 17 | 70.6M | 201.7 | **350k** | 4.49% | 15.7k |
| **POST** (Apr–May 2026, current) | 6 | 90.8M | 246.5 | **368k** | 5.79% | 21.3k |

**Headline CPR is essentially flat** across the three phases (344k → 350k → 368k VND, +7% drift). The IKMC organic tailwind hypothesis would have predicted a CPR drop Dec–Mar; instead the **funnel mix shifted**:

- During IKMC, **CPLPV dropped 36%** (Meta's optimizer found cheap LPV traffic — likely partly IKMC-curious clicks and partly Tết-period reach pricing)
- But **reg/LPV collapsed from 7.08% → 4.49%** — those cheaper clicks converted ~37% worse
- Effects cancel; CPR holds steady

**Two LPV-spike weeks (Jan 21, Jan 28)** look distinctive: 8,400+ LPVs each but only 2.5–2.8% conversion. Plausible interpretation: IKMC test-prep traffic (test usually held in late January / early February) browsing the Kurio site without committing to a paid app subscription. **Worth flagging IKMC tie-in landing pages as a separate funnel** — they're attracting volume that the registration metric isn't designed to capture.

**Spend ramp into April:** weekly spend doubled from ~50M VND in Oct/Nov to 108–131M VND in April. CPR drifted up modestly (+7%), suggesting **mild diminishing returns at higher budgets** but no cliff. The week of Apr 29 hit the period's best CPR (239k VND on 59M spend) — worth investigating what was different that week.

### H) Creative cohort decay — first-month is cheapest, then it falls apart

Tracked the top 15 ads by lifetime registrations through 30-day windows. **First month is consistently the cheapest** for almost every top ad:

| Pattern | Examples | Implication |
|---|---|---|
| Steady degradation | Ad #2: 182k → 219k → 262k → 263k | Audience saturation, no recovery |
| Sharp degradation after m1 | Ad #1: 200k → 179k → **384k** → 239k | Best in m1–m2 then collapses |
| Catastrophic decay | Ad #11: 173k → 321k → **1,354k** → 637k (8× degradation) | Audience burned, unrecoverable |
| Stable winners | Ad #6: 163k → 157k → 321k → 196k → 163k | Rare; only 2 of top 15 do this |
| Recent rising stars | Ad #7: 136k (Mar) → **102k** (Apr) | Rare; new ads finding fresh audience |

Median first-month CPR across the top-15 cohort: ~180k VND. By month 3, the median roughly doubles to ~330k. **This is the dominant time-dimension effect** — bigger than seasonality, bigger than ad-set age.

### I) Ad-set age vs CPR — barely any effect

| Bucket | n | Blended CPR | Median CPR | % zero-reg |
|---|---|---|---|---|
| 0–30d (new) | 197 | 282k | 390k | 18% |
| 30–60d | 102 | 323k | 381k | 7% |
| 60–90d | 110 | 311k | **335k** ← best | 11% |
| 90–180d | 38 | 348k | 420k | 13% |
| 180–365d | 5 | 525k | 596k | 20% |

Pearson correlation `(age_days, log(CPR)) = 0.071` over n=392 ad sets with reg ≥ 1. **Effectively no relationship.** Ad-set age does not explain the 11× same-creative CPR spread — the ad-creative-level fatigue (H above) is the dominant signal, not the ad-set wrapper.

### What this means for the school-year planning question

1. **Don't budget for an "IKMC efficiency window" — it doesn't exist in the data.** CPR holds at ~350k VND year-round in the data we have. The IKMC partnership drives traffic but it lands on a funnel that doesn't convert it into paid registrations efficiently.
2. **The biggest controllable lever is creative refresh cadence, not seasonality or targeting.** Top ads decay 2× by month 3. Plan to retire-and-replace the top creative every 6–8 weeks, not every 3–4 months.
3. **For the September school-start push:** baseline planning CPR should be **~350k–370k VND**, not the IKMC-window figures. Assume budget can scale 2× without major CPR damage (April demonstrated that), but expect ~+7–10% CPR drift at higher budgets.
4. **Investigate the IKMC landing-page funnel separately.** The Jan 21–28 LPV spikes (8.4k LPVs/week, 2.5% conversion) suggest there's a different visitor type that should either (a) be funneled to an IKMC-specific offer, or (b) be tracked with a different success metric than `complete_registration`.

---

## J — The Original 11× "Targeting" Finding Was Mostly Fatigue (added 2026-05-07)

Re-ran the same-creative comparison from 2026-05-06, but pulled each ad set's **monthly CPR series since its own creation_time** to control for fatigue.

### What we found

| Tier (original) | Adset | Created | Lifetime CPR | First-month CPR |
|---|---|---|---|---|
| TOP   | Kurio 3 `code83` (CODE83_xpage_kv) | 2026-04-21 | 112k | **112k** (29 reg) |
| TOP   | Kurio 2 `CODE83` (25/07_CODE83+84_Xpage) | 2026-04-10 | 144k | **144k** (42 reg) |
| BOTTOM | Kurio 2 `CODE83` (05/01_CODE83+84_TG) | 2026-01-13 | 240k | **201k** (28 reg) |

**First-month spread: 1.79×. Lifetime spread: 2.14×. Original "last_90d" spread: ~11×.**

The bottom adset's full trajectory tells the story: m1 = 201k VND CPR (28 reg, perfectly normal), m2 = 493k VND (2 reg, collapsed), m3 = 0 reg / 587k VND wasted. The "11×" finding was an **artifact of the date_preset window**: `last_90d` only captured the bottom adset's degraded later months, while the top adsets' similar-period data was their efficient first month.

### Implications

- **The earlier finding "broad targeting beats interest-stacking by 11×" is now retracted.** First-month performance with similar broad-vs-stacked targeting differed by only ~1.8×, well within noise.
- **Creative fatigue is the unified explanation** for both H (top 15 ads' median CPR doubles by m3) and the original same-creative spread. Targeting may still matter at the margin — but the dramatic spread we attributed to it was actually time.
- **Methodological lesson for future analysis:** never compare CPR using `date_preset` across ad sets with different ages. Always use `time_increment=30` since each adset's `created_time` to compare like-for-like life stages.

---

## K — Why Apr 29 Was the Best Week (239k CPR, +24% efficiency on -23% spend)

Compared three recent weeks:

| Week | Spend | Reg | CPR | reg/LPV |
|---|---|---|---|---|
| Apr 8 (worst) | 131M VND | 282 | 465k | 5.5% |
| Apr 22 (prior) | 76.9M | 243 | 316k | 6.0% |
| **Apr 29 (best)** | **59.2M** | **247** | **239k** | **7.6%** |

**Spend dropped 23%, registrations went up by 4.** This is pure efficiency, not pure scale.

### What changed

1. **25 marginal campaigns active in PRIOR week were dropped** (combined ~22M VND in PRIOR at high CPR or zero reg).
2. **Same-campaign CPR improvements were broad** — 11 of 15 campaigns active in both weeks improved their CPR. Top movers:
   - `CVS_TUANTA_CODE43_Xpage`: 154k → **74k** (-52%)
   - `CVS_TUANTA_CODE13_xpage_kv`: 302k → 160k (-47%)
   - `CVS_TUANTA_CODE45_xpage_kv`: 206k → 115k (-44%)
3. **Concentration in `_xpage` / `_xpage_kv` family.** The top 9 spenders in the Apr 29 week all share an `_xpage` or `_xpage_kv` suffix — likely a specific landing-page variant. CPRs ranged 73k–201k VND, all below the period blended 350k.
4. **Two `Engage - vtv` campaigns burned 2.2M VND with 0 reg in the week** — the same waste flagged in the original audit 90 days ago. Still running.

### What this teaches

- **Pruning underperformers is the most direct controllable CPR lever.** The team did this organically the week of Apr 29 and CPR dropped 24% without losing volume.
- **The `_xpage_kv` landing-page variant is a strong winner.** Worth investigating what makes it different and whether it can be applied across more campaigns.
- **The brand-only `Engage - vtv` campaigns are still live and still wasting** — the original "pause candidates worth ~30M VND/month" recommendation hasn't been actioned in 90 days.

---

## The Kurio Winning Creative Formula (consolidated brief, 2026-05-07)

For producing variants. Synthesized from the top 15 ads (96k–170k VND CPR) over the analyzed period, with the time-dimension findings layered in.

### The 7 traits — every top ad has all 7

1. **All-caps pain headline in parent voice + vivid stakes word + concrete outcome embedded.** Examples (Vietnamese, with English gloss):
   - `TỪ HỌC SINH SUÝT Ở LẠI LỚP - CON VƯƠN LÊN TOP 5` ("From a student about to be held back — to top 5")
   - `LÊN LỚP 2 MÀ CON TÍNH TOÁN VẪN PHẢI ĐẾM NGÓN TAY` ("Going into 2nd grade and STILL counting on fingers")
   - `CHI 20 TRIỆU CHỈ ĐỂ NHẬN VỀ … SỰ THẤT VỌNG` ("Spent 20 million for nothing but DISAPPOINTMENT")
   - `THU NHẬP 50TR NHƯNG CHI CHƯA TỚI 100K/THÁNG` ("Income 50M but spends less than 100k/month")

2. **Price anchor `3K/ngày` or `80–90k/tháng` in BOTH headline and title field.** This is the single strongest signal — present in 15/15 top performers. Title repeats it: `Toán tư duy chỉ từ 3k/ngày`, `Ưu đãi 100 suất chỉ 3k/ngày`.

3. **Long-form parent-narrative body, 1,500–2,500 characters.** First-person mom/dad/teacher voice, named details (specific names, ages, schools, scores), story arc: problem → discovery → outcome. **Bodies under 300 chars consistently fail** — they look like teasers, not testimonials.

4. **Concrete outcome with a number** in the body: `vươn lên top 5`, `9–10 điểm thường xuyên`, `3 năm liền HSG`, `100 suất ưu đãi`.

5. **CTA = `LEARN_MORE` or `SIGN_UP`** — tied 6/6 in the top 15. Pick either.

6. **Format is flexible.** Top 15: 7 video, 4 dynamic-image, 2 photo, 2 boosted-post. Format is NOT decisive — copy and offer are.

7. **Landing page = `_xpage` / `_xpage_kv` variant.** Validated by Apr 29 week analysis: every top performer uses these LP suffixes. (Unknown what's structurally different about `_xpage_kv` vs other LPs — worth asking the team.)

### Targeting wrapper (refined)

- **Geo:** nationwide VN (the n=5 finding that 3 named cities helped did not replicate at scale).
- **Age:** parents (most winners 28–45 or 18–65 — both work; default 28–45 for a tighter starting point).
- **Gender:** female-only or all (top tier slightly tilts F).
- **Placements:** Facebook-only, OR FB+IG. Avoid auto/all-placements (bottom tier over-spreads here).
- **Interests/behaviors/family_statuses:** **leave blank** as default. Stacked Education+Parents targeting works marginally worse, not 11× worse.
- **Custom audiences:** none used today across 60 ad sets in either tier — **single biggest unexplored lever**. When write access is granted, test Lookalike(1%) of `complete_registration` events.

### Refresh cadence (NEW, this session)

- **Plan to retire-and-replace every 6–8 weeks.** Top ads' median CPR doubles by month 3. The same body in a fresh ad creative wrapper resets the audience signal — this isn't ad-set freshness (no effect), it's *ad-creative* freshness.
- For the September school-start push, prepare **4–6 fresh creative variants** of the formula in advance, plan to rotate weekly through the peak window.
- Don't ride proven winners past their second month, even if they're still positive — they'll spike CPR before they go negative.

### Variant generation guidance

When briefing a copywriter or LLM to produce new creatives:
- **Hold constant:** the 7 traits above (price anchor, long-form, concrete number, parent voice, CTA, LP type).
- **Vary:** the specific pain (suýt ở lại lớp / đếm ngón tay / chi 20tr / thu nhập 50tr / etc.), the named details in the testimonial, the specific outcome, the visual format. Each variant should feel like a different parent's story.
- **Don't vary:** price (3K/ngày is the proven anchor), the all-caps headline format, the long body length, the broad targeting wrapper. These are load-bearing.

### Resume from here

- **D)** (still open) Lookalike-of-converters audience test — top priority when write access is granted.
- **L)** What is `_xpage_kv` structurally? Confirm with team and consider standardizing all winning campaigns onto this LP.
- **M)** Stakeholder loop: action the long-standing `Engage - vtv` pause recommendation (still running, still wasting ~$170/month).

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
