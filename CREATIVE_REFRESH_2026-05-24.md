# Creative refresh — 2026-05-24

**Purpose:** distill current-week signal into "what to build / test / kill next" — companion to the existing [CONTENT_STRATEGY.md](CONTENT_STRATEGY.md) (May 2026, principles + 3-month plan) and [BRIEFS_PHASE_A.md](BRIEFS_PHASE_A.md) (May 12 Phase A briefs, currently paused).

Source data: [src/reports/adset_roster.js](src/reports/adset_roster.js) run 2026-05-24 against 7d/28d Meta insights.

---

## 1. Where we actually are right now

| Metric | This week (last 7d) | CONTENT_STRATEGY baseline |
|---|---|---|
| Blended CPR | **263k VND** | 278k (May 8 baseline) |
| Live ad sets | 198 | — |
| Spend (7d) | 122M VND | ~90M/week baseline |
| 7d regs | 463 | — |

**Read:** CPR is 5% better than the May baseline. Spend is ~35% above weekly baseline. Quality is holding; volume is up. Not in crisis — refresh from a position of strength, not desperation.

## 2. Five concrete actions this week

| # | Action | Reason | Source |
|---|---|---|---|
| 1 | **PAUSE all three Engage / VTV adsets** | 3.1M VND burned in 7d for 0 reg. 90+ day pause flag from FINDINGS now precisely costed. | roster.js → CUT |
| 2 | **Refresh creative on 5 fatiguing adsets** | CPR has drifted to ≥1.5× prior; classic mid-life fatigue per FINDINGS. CODE17 / CODE45 TG / CODE13 TG / CT19 / CODENM+CX. | roster.js → FATIGUE |
| 3 | **Scale top 5 PICK adsets +30% budget** | All ≤195k CPR (win line) with ≥5 reg in 7d. Confidence is real, not noise. | roster.js → SCALE picks |
| 4 | **Kill 2 specific zero-reg CVS adsets** | 16/06_CODE13 Bản sao 4 and MASS_21/11_RLTH Bản sao 8 — 1.85M VND wasted, 0 reg. | roster.js → CUT |
| 5 | **Ship 1 net-new angle this week** (not 4) | We have spend headroom + bandwidth, but Phase A briefs (4 cells) are over-scoped vs current load. Ship just A2 (Lớp 5 → Trần Đại Nghĩa) — peak-season exam window closes early June. | BRIEFS_PHASE_A + season |

## 3. What's confirmed vs what's been falsified by this week's data

**Confirmed (keep doing):**
- **XPAGE / XPAGE_KV LP family dominates.** All top 5 PICK adsets are xpage-kv. Memory's −43% CPR claim still holds.
- **Creative fatigue is the dominant lever.** 5 ad sets independently doubled CPR mid-life — pure refresh signal, no targeting/budget change.
- **CODE83 / CODE13 / CODE45 family** are the workhorses. Multiple `Bản sao` (copies) of these all scale.

**Newly visible (act on):**
- **"Re-up" launches diverge sharply from originals.** Same code, two adsets — `CODE85_reup` is the #1 CUT (715k CPR) while `CODE85+86_reup` is the #1 PICK (88k CPR). Re-ups are not safe defaults; treat them as fresh creative.
- **Lookalike audiences still untested.** No PICK adset uses a positive custom audience. The single largest unexplored variable from prior audit remains unexplored.

**Not yet measurable:**
- Lớp-5 entry-exam angle (Phase A A2/A3): never launched. No data either way.
- Anti-học-thêm cell A5: same — never launched.
- Dad-voice and screen-addiction: same.

## 4. The minimum testing framework (now automated)

[src/reports/creative_test.js](src/reports/creative_test.js) + [data/creative-tests.json](data/creative-tests.json) closes the loop on the manual weekly review described in CONTENT_STRATEGY §2:

1. **Declare a test** — add an entry to `data/creative-tests.json` with `cell_id`, `adset_id`, `start_date`, optional thresholds. Defaults come from CONTENT_STRATEGY (250k target, 195k win, 420k kill, 14d window, 10 reg to verdict, 30 reg to winner).
2. **Run weekly** — `npm run report:creative-tests` pulls Meta insights since `start_date`, computes lifetime + last-7d CPR, classifies each test into one of:
   - **WINNER** — ≥30 reg AND CPR ≤ 195k → graduate to scale-up
   - **SCALE** — ≥10 reg AND CPR ≤ 195k → early lead, increase budget
   - **KILL** — ≥10 reg AND CPR ≥ 420k → pause
   - **FATIGUE** — last-7d CPR > 1.5× lifetime CPR → refresh asset (don't kill cell)
   - **INCONCLUSIVE** — past window, still below 10 reg → extend or kill on volume
   - **CONTINUE** — within window, not yet enough volume
3. **Output** is a one-row-per-cell table plus a JSON dump at `.cache/creative_test_verdicts.json`.

What this does not do (yet): no automated budget changes, no automated pause — the tool *recommends*, a human still acts. That's deliberate: token has `ads_read` only per [CLAUDE.md](CLAUDE.md) operating rules, and verdict trust needs a few weeks of human-vetted cycles before any autonomy.

## 5. Calibration note on the verdict thresholds

The CONTENT_STRATEGY defaults (250k target, 195k win, 420k kill) were calibrated against May 8 baseline of 278k blended CPR. With today's blended at 263k, the win line at 195k is ~74% of blended — still a meaningful "clearly better than average" bar. No adjustment needed yet. **Re-baseline at the end of June** if blended CPR drifts >10% in either direction.

## 6. Open inputs needed (unchanged from BRIEFS_PHASE_A.md)

Still blocking Phase A launch — restated for visibility:

- Native-VN tone edit on the 4 body drafts in BRIEFS_PHASE_A.md
- Designer build: 4 image creatives (~6.5M VND)
- LP confirmation: do `_xpage_kv` LPs exist for each angle?
- Comms / legal review on A5 anti-học-thêm framing
- Confirmation of public-school name mentions (Trần Đại Nghĩa / Lương Thế Vinh / Cầu Giấy / Ams)
