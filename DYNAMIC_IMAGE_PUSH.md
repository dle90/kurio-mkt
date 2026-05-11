# Dynamic-Image Production Push — Plan & Open Inputs

**Started:** 2026-05-11 · **Status:** awaiting 3 inputs before drafting per-cell briefs
**Source signal:** [format_cpr_finding](C:/Users/ducml/.claude/projects/d--work-Kurio-mkt/memory/format_cpr_finding.md) + 29-ad inspection ([scripts/dump-dynamic-image-winners.js](scripts/dump-dynamic-image-winners.js))

## Why this push

- Dynamic-image is **13% of inventory but 33% of top-15 winners** — 2.5× over-represented at the top.
- Blended CPR 244k VND vs video 286k; at ≥3M spend, **210k vs 269k**.
- 29/29 dynamic-image ads produced registrations (zero zero-reg burn). Video has a meaningful zero-reg tail.
- Content tracker pipeline (228 briefs in the Google Sheet) is **68% video** — doubling down on the format that underperforms.

## What "dynamic-image" means here

Meta DCO ad with `asset_feed_spec` — image assets + headline pool + body pool. Meta auto-recombines. **Not** static social images (those are classified as `photo`, n=25, CPR 279k — *not* a winner). The format itself isn't magic; depth of asset pool + proven copy formula is.

## Winning copy patterns (from top-10 dynamic-image inspection)

1. **Numeric price anchor** — 3k/ngày, 83k/tháng, 90k/tháng, "chưa tới 100k/tháng"
2. **Transformation arc** — "SUÝT Ở LẠI LỚP → TOP 5", "9 ĐIỂM CHUYỂN CẤP"
3. **Parent voice** — "nhà mình", "bé nhà em", "hai vợ chồng Hà Nội"
4. **Anti-học-thêm wedge** — "Thay vì tốn hàng triệu thuê gia sư"

3 of the top 10 winners reuse the *exact* "THU NHẬP 50TR / CHƯA TỚI 100K-THÁNG" template — heavy template reuse is part of the win, not a bug.

## Decisions made this session

- **Scope:** 4 parallel DCO asset feeds, one per grade — **lớp 2, 3, 4, 5**.
- **LP:** `_xpage_kv` only (memory: −43% CPR, biggest single lever).
- **CTA:** `LEARN_MORE` only.
- **Levers to EXCLUDE from these feeds** (avoid diluting signal — test elsewhere):
  - Teacher-voice framing (+17% CPR worse)
  - Scarcity / urgency (+8% CPR worse)
  - Video (different format, separate test)
  - Untested angles: dad-voice, anti-screen-addiction (run as clean tests, not muddled into this wave)
- **Production cycle:** internal team, ≤1 week per cell.
- **Claims policy:** pre-approved, free to reuse (income, score-jump, exact-price).
- **Budget:** agnostic — propose right shape, size after.

## Per-cell asset pool target

| Slot | Count | Notes |
|---|---|---|
| Headlines | 6–8 | Price anchor + transformation + anti-học-thêm, grade-keyed |
| Bodies (long-form) | 4–6 | Adapt 3 proven body templates per grade |
| Images | 6–10 | Grade-coded — notebook/score sheet for that grade, parent-kid moment, app screenshot showing grade-N content |
| CTA | LEARN_MORE | — |
| LP | `_xpage_kv` | — |

Total production load per wave: ~28 headlines + 20 bodies + 30 images.

## Test sizing (rough)

DCO learning phase needs ~50 conversions to exit. At 200k VND target CPR → ~10M VND/cell × 4 cells = **~40M VND media test budget**, 7–14 day window.

**Kill rule (inherit from CONTENT_STRATEGY.md):** CPR > 420k after 7 days with ≥10 reg → pause.

## Lớp 3 risk

Zero historical data on grade 3 (0/228 ads, 0/228 briefs). Treat as exploratory; if it underperforms 2/4/5, that's signal, not failure. Build on lớp-2/4 templates with grade-3 swap.

## OPEN INPUTS — needed before drafting per-cell briefs

1. **`_xpage_kv` availability for grades 2/3/4/5** — currently strong but n=4 in audit. If only built for one grade, replicate it or fall back to `_xpage`. Who can confirm?
2. **Image library constraints** — must we use real Kurio student photos (parent-consent gated), or are stock + composites OK? Drives production timeline more than anything else.
3. **228-brief tracker cross-reference** — should I scan [data/content-tracker.csv](data/content-tracker.csv) for any in-pipeline grade-2/3/4/5 dynamic-image briefs we can recycle vs build from scratch?

## When the user returns

Answer the 3 open inputs above → I draft per-cell briefs (headlines + body templates + image shot-list + LP confirmation) ready for the designer + copywriter to build.

## Sheet snapshot for reference

[data/content-tracker.csv](data/content-tracker.csv) — Google Sheet "Kurio Content Tracker" exported 2026-05-11, 228 codes. Regenerate from source if briefs change: `curl -sL "https://docs.google.com/spreadsheets/d/1IsnziRsnVSuO7yW7fesSd7eRWAgOHAHWuBZ7ItfdRKw/export?format=csv&gid=1331156303" -o "data/content-tracker.csv"`
