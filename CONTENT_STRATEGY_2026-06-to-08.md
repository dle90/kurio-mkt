# Content Strategy — June → August 2026

**Built:** 2026-05-24 · **Window:** Jun 1 → Aug 31 (12 weeks) · **Refreshes:** [CONTENT_STRATEGY.md](CONTENT_STRATEGY.md) (May 2026 baseline)
**Source data:** [data/creative-deep-dive.json](data/creative-deep-dive.json), [data/code-roas-window.json](data/code-roas-window.json), [data/roster-2026-05-23.json](data/roster-2026-05-23.json)

---

## TL;DR — five things that change

1. **The "3K/ngày anchor" is neutral for ROAS, not winning.** It's in 38 of 59 active codes (64%) but having it gives ROAS 0.64 — *identical* to not having it (0.64). The May FINDINGS-era claim that 15/15 winners had it was a CPR observation, not a ROAS one. **Keep it as a price floor; stop crediting it as a lever.**
2. **The single biggest copy lever is the transformation arc** ("top 5", "9–10 điểm", "đỗ chuyên"). **1.93× ROAS lift** when present (0.77 vs 0.40). Double down.
3. **Summer + EOY angles are real winners (1.64× and 1.58× lift respectively)** — these are exactly what June and the EOY-report-card window need. Lead Phase B with these, not with pain hooks.
4. **Scarcity is poison.** 0.48× ROAS lift (0.40 vs 0.84). Used in 59% of codes. **Remove from all new creative.**
5. **`-xp` and `-reup` LP families beat `-xpage-kv` on ROAS.** Memory's "xpage-kv −43% CPR" claim was CPR-only and was about an older comparison. Current 21d ROAS by LP family: `xp 1.10`, `reup 1.02`, `xpage-kv 0.87`, `xpage 0.82`, `base 0.42`. **Make new LPs as `-xp` or `-reup` variants, not `-xpage-kv`.**

---

## 1. What's working RIGHT NOW (21d window, 2026-05-04 → 2026-05-24)

### Top 12 codes by ROAS (window spend ≥ 1M VND)

| Code | LP family | Spend | Reg | Window ROAS | Apr+May | Trajectory |
|---|---|---:|---:|---:|---:|---:|
| `code15_xpage` | xpage (K5) | 3.1M | 10 | **1.71** | 0.56 | **+1.16** ↑ |
| `13-xpage-kv` | xpage-kv | 12.3M | 41 | **1.45** | 1.14 | +0.32 ↑ |
| `cx` | base | 5.7M | 25 | **1.45** | 0.97 | +0.48 ↑ |
| `code45-xp` | xp | 13.0M | 52 | **1.38** | 1.57 | −0.18 ↓ |
| `ct19-xpage` | xpage | 5.6M | 14 | 1.31 | 2.13 | −0.82 ↓↓ |
| `intro2-xpage` | xpage | 21.6M | 94 | 1.27 | 1.44 | −0.17 |
| `code128` | base | 10.5M | 41 | 1.17 | 1.02 | +0.16 |
| `code13-reup` | reup | 13.0M | 48 | **1.12** | 0.55 | **+0.57** ↑ |
| `ct6` | base | 2.4M | 7 | 1.07 | 0.54 | +0.54 ↑ |
| `code102-2` | base | 7.0M | 29 | 1.06 | 0.78 | +0.28 ↑ |
| `code45-reup` | reup | 10.0M | 45 | 1.03 | 1.19 | −0.16 |
| `code85-reup` | reup | 14.2M | 26 | 0.99 | 1.01 | flat |

**Observation:** 6 of the top 12 are improving (+0.16 to +1.16); 3 are fading (−0.17 to −0.82). **Refresh the fading ones; lean into the improving ones.**

### Top 8 codes by ROAS that we may be UNDER-SCALING

These currently have **window spend ≥ 5M AND ROAS ≥ 1.10** — they're paying back but the roster isn't always picking them up due to code-resolution gaps:

- **`13-xpage-kv`** (12.3M, 41 reg, 1.45) → already in roster ✓
- **`cx`** (5.7M, 25 reg, 1.45) → in roster ✓
- **`code45-xp`** (13M, 52 reg, 1.38) → in roster as `CODE45_Reup` indirectly, but `code45-xp` is a separate, larger code worth its own slot
- **`ct19-xpage`** (5.6M, 14 reg, 1.31) → in roster as CT19
- **`intro2-xpage`** (21.6M, 94 reg, 1.27) → in roster ✓
- **`code128`** (10.5M, 41 reg, 1.17) → just added to roster ✓
- **`code13-reup`** (13M, 48 reg, 1.12) → in roster ✓
- **`code85-reup`** (14.2M, 26 reg, 0.99) → in cohort drill-down

### LP family ranking (window blended ROAS)

| LP family | # codes | Window spend | Blended ROAS | Blended CPR | Memory said |
|---|---:|---:|---:|---:|---|
| **xp** | 3 | 18.6M | **1.10** ✓ | 230k | (not previously highlighted) |
| **reup** | 7 | 40.7M | **1.02** ✓ | 309k | (not previously highlighted) |
| xpage-kv | 3 | 35.3M | 0.87 | 226k | "−43% CPR vs alternatives" (was CPR-only) |
| xpage | 13 | 63.3M | 0.82 | 304k | mid-tier |
| base | 143 | 178.6M | **0.42** | 212k | (most codes are still here — 57% of spend goes to base family) |

> **Implication:** The biggest available win is moving codes from `base` to `-xp` or `-reup` LP variants. **Migration plan for top 10 high-spend base codes is the highest-ROI infrastructure work for Q3.**

### Format ranking (window ROAS, dominant format per code)

| Format | # codes | Window spend | Blended ROAS | Blended CPR |
|---|---:|---:|---:|---:|
| VIDEO | 42 | 242M | **0.70** | 246k |
| SHARE | 5 | 20M | 0.75 | 294k |
| STATUS (boosted post) | 10 | 49M | 0.47 | 220k |
| PHOTO | 2 | 26M | **0.33** | 426k |

> **Revision:** Memory's `format_cpr_finding.md` ("dynamic-image beats video") was CPR-only. **At ROAS, VIDEO is the strongest scalable format.** PHOTO is the worst. STATUS / boosted-post produces cheap regs that don't convert to revenue (CPR 220k but ROAS 0.47).

---

## 2. Copy patterns × ROAS — the new winning formula

For each feature, present-vs-absent ROAS computed on the 59 codes with ≥1M window spend, weighted by spend.

| Copy feature | Codes w/ feat | Codes w/o | ROAS w/ | ROAS w/o | **Lift** | Status |
|---|---:|---:|---:|---:|---:|---|
| **transformation arc** ("top 5", "9-10 điểm", "HSG") | 29 | 30 | 0.77 | 0.40 | **1.93×** | ⭐ keep + amplify |
| **summer** ("hè", "3 tháng hè") | 6 | 53 | 0.99 | 0.60 | **1.64×** | ⭐ lead June-July |
| **EOY report card** ("tổng kết", "giấy khen") | 8 | 51 | 0.93 | 0.59 | **1.58×** | ⭐ lead late May / early June |
| anti-học-thêm | 33 | 26 | 0.72 | 0.54 | 1.33× | keep |
| headline_caps | 31 | 28 | 0.69 | 0.56 | 1.22× | keep |
| ai_tutor mention | 37 | 22 | 0.68 | 0.57 | 1.18× | keep (mild) |
| emoji | 26 | 33 | 0.64 | 0.64 | 1.01× | neutral |
| **3K/ngày anchor** | **38** | **21** | **0.64** | **0.64** | **1.00×** | **neutral — was overcredited** |
| dad voice | 10 | 49 | 0.58 | 0.65 | 0.88× | neutral / slight neg |
| exam mention | 12 | 47 | 0.57 | 0.66 | 0.87× | neutral / slight neg |
| price-per-month | 32 | 27 | 0.56 | 0.71 | 0.80× | mild neg |
| parent voice | 37 | 22 | 0.56 | 0.74 | 0.76× | slight neg (over-saturated) |
| pain hook | 27 | 32 | 0.53 | 0.71 | 0.74× | **mild negative** (over-saturated) |
| question hook | 9 | 50 | 0.49 | 0.67 | 0.73× | drop |
| teacher voice | 24 | 35 | 0.48 | 0.71 | 0.68× | drop |
| screen-addiction | 47 | 12 | 0.55 | 0.84 | 0.66× | execution-broken or saturated |
| **scarcity** | **35** | **24** | **0.40** | **0.84** | **0.48×** | ⛔ **REMOVE** |

### Surprises worth calling out

- **Pain hook is mildly negative for ROAS** (0.74×). This is the most counterintuitive finding — the May FINDINGS doc called it core to the winning formula. Read: pain hooks bring cheap registrations but those leads don't convert to revenue as well as transformation-arc framings do.
- **Parent voice is slightly negative (0.76×).** Hugely saturated (37 of 59 codes use it). Possible that ad fatigue / sameness is depressing ROAS.
- **Scarcity is catastrophic (0.48× lift, 0.40 ROAS where present).** Used in 59% of codes — biggest single fix.
- **Screen-addiction copy is broken in execution (0.66×).** The angle from `creative_blind_spots.md` was supposed to be promising; in practice it's underperforming. May be how it's executed (clickbait vs solution-oriented).

---

## 3. Code-level fatigue — refresh discipline

Fading codes (Apr+May → 21d trajectory ≤ −0.30, with ≥ 1M window spend):

| Code | LP family | Apr+May ROAS | 21d ROAS | Trajectory |
|---|---|---:|---:|---:|
| `code4` | base | 1.55 | 0.00 | **−1.55** (dead) |
| `code186` | base | 0.95 | 0.00 | −0.95 (dead) |
| `ct19-xpage` | xpage | 2.13 | 1.31 | −0.82 (fading from peak) |
| `code63` | base | 0.72 | 0.00 | −0.72 (dead) |
| `3-rlth` | base | 0.94 | 0.22 | −0.71 |
| `cx-93` | base | 0.77 | 0.14 | **−0.63 (collapsed)** |
| `code63-3` | base | 0.78 | 0.30 | −0.47 |
| `nm` | base | 0.59 | 0.13 | −0.45 |
| `code14` (base) | base | 0.89 | 0.39 | −0.50 |
| `ct19` | base | 0.51 | 0.13 | −0.38 |

> 8 of 10 fading codes are `base` LP family. Confirms migration thesis: **base LPs are running out of audience.**

Improving codes (Apr+May → 21d trajectory ≥ +0.20):

| Code | LP family | Apr+May ROAS | 21d ROAS | Trajectory |
|---|---|---:|---:|---:|
| `code15_xpage` (K5) | xpage | 0.56 | **1.71** | **+1.16** |
| `code13-reup` | reup | 0.55 | 1.12 | +0.57 |
| `ct6` | base | 0.54 | 1.07 | +0.54 |
| `cx` | base | 0.97 | 1.45 | +0.48 |
| `13-xpage-kv` | xpage-kv | 1.14 | 1.45 | +0.32 |
| `code45-3` | base | 0.66 | 0.95 | +0.29 |
| `code102-2` | base | 0.78 | 1.06 | +0.28 |

> Improving codes span all LP families — newness alone is meaningful, not just LP migration. **Refresh cadence is the operating-level discipline.**

---

## 4. Untested or under-tested angles (blind spots that still hold)

From [creative_blind_spots.md](C:/Users/ducml/.claude/projects/d--work-Kurio-mkt/memory/creative_blind_spots.md) plus what the deep-dive confirms is missing:

| Angle | Tested? | Read |
|---|---|---|
| Lớp-5 → entry-exam (Trần Đại Nghĩa / Ams / Cầu Giấy) | NO | Phase A A2/A3 paused; window narrowing fast (HCM exam late May / early June) |
| Dad voice | Tested w/ neutral lift | 10 codes use it; ROAS 0.58 vs 0.65 absent. Possible execution issue, not angle |
| Topic-specific weakness ("con sợ phép chia") | NO | Zero ads target this. Untouched grain. |
| Anti-summer-slide (June onwards) | NO | "hè" present in only 6 codes (10%); lift 1.64× when present. Big runway. |
| EOY report card pain | UNDER-tested | 8 codes (14%); lift 1.58×. Should be lead-of-May. |
| Sibling success ("anh đỗ chuyên — giờ tới em") | NO | Mentioned in CONTENT_STRATEGY.md as Phase C lead. Untouched. |
| Lớp 1 transition + dad-voice combo | NO | Planned for Phase C; needs early test in August. |
| Western pedigree (Singapore Math / Cambridge) | Briefly tested | n=6 ads, −35% CPR per audit. Worth one clean retest at ROAS level. |

---

## 5. The 3-month plan

### Phase B — June (transition: end-of-year → summer)

**Theme:** *"Năm học kết thúc — Hè không học thêm, vẫn không quên"*

**Cells (cap at 8 active DR cells per portfolio rule):**

| # | Role | Angle | Format | LP family | Hypothesis / Target |
|---:|---|---|---|---|---|
| 1 | Control | `intro2-xpage` (graduated proven winner) | VIDEO | xpage | Hold; floor on volume; refresh by Jul 1 |
| 2 | Control | `13-xpage-kv` (graduated scale-up) | VIDEO | xpage-kv | Hold; floor; refresh by Jul 1 |
| 3 | Scale-up | `code45-xp` consolidation | VIDEO | xp | Test budget +50%; xp family wins on ROAS |
| 4 | Scale-up | `code13-reup` (improving, 0.55→1.12) | VIDEO | reup | Keep, monitor for ceiling |
| 5 | **NEW** angle test | **EOY report card pain × transformation arc** (B1.1) | dynamic-image | -xp variant | Target ROAS ≥ 0.9; 14d window; per `creative_blind_spots #2` and EOY 1.58× lift |
| 6 | **NEW** angle test | **Anti-summer-slide / "3 tháng quên"** (B1.2) | VIDEO | -reup variant | Target ROAS ≥ 0.9; 14d; summer 1.64× lift |
| 7 | **NEW** angle test | **Lớp-5 entry-exam** — Phase A A2 unblocked (HCM TĐN) | dynamic-image | -xp variant | Target ROAS ≥ 0.7 (scout); window closes early June |
| 8 | Burn-down | `code85-reup` (flat at 0.99) | VIDEO | reup | Phase out by Jul 15 |

**Production load:** 3 new cells (rows 5, 6, 7). Designer + copywriter pass on EOY (lead), summer-slide, lớp-5.

**Critical:** Write all new cells WITHOUT scarcity phrasing (`suất`, `nhanh tay`, `ưu đãi`). Lead with transformation arc + EOY/summer hook. Skip pain headlines.

### Phase B sub-batch — July (peak summer)

**Theme:** *"Hè con học khác — kết quả khác"*

**Promote / drop based on June verdict:**
- Whichever of cells 5/6/7 hits ROAS ≥ 1.0 in 14d → graduate to scale-up tier with 2× budget.
- Whichever doesn't → retire.

**New July cells (replace whichever graduated/retired):**

| # | Role | Angle | Format | LP family | Hypothesis |
|---:|---|---|---|---|---|
| – | Scale-up | June graduate | VIDEO | best-performing | Continue with budget bump |
| 9 | NEW test | **Topic-specific weakness** (phân số, hình học) | dynamic-image | -xp | Target ROAS ≥ 0.8; per `creative_blind_spots #4` |
| 10 | NEW test | **Dad-voice transformation arc** — proper execution (not just "bố nói" but a story arc) | VIDEO | -reup | Target ROAS ≥ 0.7; second attempt at dad voice |
| 11 | Recurring test | **`code45-xp` variant w/ summer hook** | VIDEO | -xp | Refresh of top-ROAS code |

**Lock by:** July 1 for the rotation. Watch for code-level fatigue in `intro2-xpage` and `13-xpage-kv` controls — refresh creative by mid-July if ROAS dips below 0.9.

### Phase C — August (back-to-school ramp)

**Theme:** *"Vào năm học mới — không cần học thêm"*

**Lock inventory by Aug 1.** Khai giảng is Sep 5. Spend ramp begins Aug 15.

| # | Role | Angle | Format | LP family | Hypothesis |
|---:|---|---|---|---|---|
| 1 | Control | Highest-ROAS code from June+July (TBD) | — | — | Floor on volume |
| 2 | Control | Second-highest (TBD) | — | — | Floor |
| 3 | Scale-up | EOY transformation winner promoted | — | — | Carry summer momentum |
| 4 | **NEW lead test** | **Lớp 1 transition × dad voice** (per `CONTENT_STRATEGY.md` Phase C) | VIDEO | -reup | Target ROAS ≥ 0.9 |
| 5 | **NEW** | **Lớp 5 entry-exam (Aug retest for IKMC + selective)** | dynamic-image | -xp | Target ROAS ≥ 0.8; second window |
| 6 | **NEW** | **Sibling success** ("anh học → giờ tới em") | VIDEO | -xp | Untested per CONTENT_STRATEGY |
| 7 | Burn-down | Summer winners | — | — | Phase out Aug 25 |
| 8 | Open slot | Reserved for emergent test from July verdict | — | — | — |

---

## 6. Operating discipline (carries through the 3 months)

1. **Refresh cadence: every 6–8 weeks per code.** Code-level fatigue is real — `ct19-xpage` peaked at 2.13 in April and is at 1.31 now. The other "fading" codes lost most of their ROAS in 60–90 days. **No code stays on the active roster past week 8 of its lifetime.**
2. **Migrate `base` LP codes to `-xp` or `-reup`.** Base family has 143 codes contributing 57% of spend at 0.42 ROAS. **Migrate the 10 highest-spend base codes one per month** — each migration is a 1.5–2× ROAS opportunity.
3. **Drop scarcity language from all new creative.** 0.48× lift. Biggest avoidable mistake.
4. **Stop relying on "3K/ngày" as the primary hook.** It's table-stakes pricing, not differentiation. Anchor with transformation outcome instead.
5. **Format default: VIDEO with dynamic-image as A/B partner.** PHOTO is dead at 0.33 ROAS. STATUS (boosted posts) is cheap-regs trap (CPR 220k, ROAS 0.47).
6. **Run the roster every Monday** (`npm run report:roster`); auto-verdicts via `npm run report:creative-tests`. Refresh `code-roas-window.json` weekly (`node src/dashboard/cohort_drilldown.js`) so the roster sees fresh ROAS.

---

## 7. Open questions / risks

- **Code resolution gap.** Only 21% of historic creatives resolve to a code by Meta ad name. The LP-stamped code (Getfly `ads_code`) doesn't always live in the Meta ad/campaign name. **Fix:** convention to name Meta campaigns with the exact LP-stamped code. Otherwise ROAS will keep mis-attributing.
- **Brand attribution gap.** VTV Engage drives organic but it shows up as "organic page" in cohort drill-down, invisible to ROAS-ranked codes. **Track weekly: organic-page registrations during weeks Engage is on vs off.**
- **K5 is one cell of 8.** Only `code15_xpage` (K5) is in the plan (and it's the top performer at 1.71 ROAS). If K5 is strategically important, allocate one more test cell to it.
- **Phase C lock date is Aug 1** — Phase A still needs to launch first. If the unblocking chain (VN tone-edit → designer → LP → comms review) slips, Phase A creative may not land before Phase C inventory is locked, delaying everything by 4 weeks.

---

## 8. Specific creative briefs ready to execute (June lead cells)

### Cell B1.1 — EOY Report Card + Transformation Arc

**Hypothesis:** EOY report cards arrive late May / early June (parents' fresh pain). Combine with transformation framing (con tăng 2-3 điểm), avoid scarcity.

**Headline candidates:**
1. `TỔNG KẾT TOÁN 7 ĐIỂM — HÈ NÀY MẸ QUYẾT ĐỊNH KHÁC` (existing in BRIEFS_PHASE_A.md A4)
2. `CON MANG GIẤY KHEN VỀ — TOÀN MÔN GIỎI, RIÊNG TOÁN 6 ĐIỂM` (existing)
3. `TỔNG KẾT NĂM HỌC: TỪ 7 ĐIỂM LÊN 9 ĐIỂM TOÁN — 3 THÁNG HÈ THÔI` (new — adds transformation)

**Body framework (~1,400 chars, VN tone-edit needed):**
- Hook: EOY pain (giấy khen toán 7 điểm)
- Transformation: tăng 2-3 điểm trong hè 3 tháng (specific number)
- Method: AI gia sư, 30 min/day, lộ trình cá nhân hóa
- **NO scarcity language**
- Price as floor at end ("chỉ hơn 80K/tháng") not as hook

**Format:** Dynamic-image (3 ratios). Visual: giấy khen with red-circled 7, kid + parent.

**LP:** `-xp` variant if exists, else stand up new `B1.1-xp` page.

**Budget:** 2M VND/day × 14d → ~28M VND test envelope. Target ROAS ≥ 0.9.

### Cell B1.2 — Anti-Summer-Slide

**Hypothesis:** "3 tháng quên hết" pain hook (already exists in template) combined with transformation arc, summer hook, AI tutor mention. Avoid teacher voice and scarcity.

**Headline candidates:**
1. `HÈ 3 THÁNG — KHÔNG HỌC THÊM, CON VẪN TĂNG 2 ĐIỂM TOÁN VÀO NĂM HỌC MỚI`
2. `ANH CHỊ HỌC THÊM HÈ — EM HỌC KURIO. KẾT QUẢ KHÁC NHAU.`
3. `MÙA HÈ KURIO: CON CHỦ ĐỘNG HỌC, MẸ THẢNH THƠI`

**Body framework:** Parent narrative, no học-thêm cost, transformation arc with specific tăng-điểm number.

**Format:** Video (sticks at 0.70 ROAS).

**LP:** `-reup` variant of an existing high-ROAS code.

**Budget:** 2M VND/day × 14d. Target ROAS ≥ 0.9.

### Cell B1.3 — Lớp 5 Entry-Exam (Phase A A2 unblocked)

**Hypothesis:** From existing BRIEFS_PHASE_A.md cell A2. HCM Trần Đại Nghĩa entrance exam window is closing — must launch by Jun 1 to capture any remaining momentum.

**Status:** Already drafted in [BRIEFS_PHASE_A.md](BRIEFS_PHASE_A.md). Needs:
- VN tone-edit (existing blocker)
- Designer build of 3 image ratios (~1.5M VND production)
- LP `-xp` variant created
- Comms review on school name mentions

**Budget:** 1.5M VND/day × 14d (scout, lower than A/B). Target ROAS ≥ 0.7.

---

*Plan owner: Marketing. Refresh this doc at the end of June with what shipped and what verdicted.*
