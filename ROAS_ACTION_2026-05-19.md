# Kurio Meta Ads — Action Refresh
*Generated 2026-05-19 · refresh of [ROAS_ACTION_2026-05-17.md](ROAS_ACTION_2026-05-17.md) · last-30d window = 2026-04-19 → 2026-05-19*

Refresh inputs: full `npm run roas:build` + `npm run roas:fetch:creative` + `npm run roas:actionable`. Raw output saved to [out/actionable_2026-05-19.txt](out/actionable_2026-05-19.txt).

---

## TL;DR — what changed in 2 days

- **None of the 8 pauses from the 5/17 plan have been actioned.** All 8 still alive, still burning. `ct19` (11.1M/mo · 0.46), `ct18-xpage` (11.1M/mo · 0.45), `quảng cáo lượt tương tác mới` (10.9M/mo · 0.00), `45-xpage-kv`, `83-xpage-kv`, `17x-kv`, `cx`, `code86-reup` — every single one still active. **This is ~64M VND/mo continuing to burn**, up from the 50M estimate on 5/17 because `code118-xpage` (4M/mo · 0.00) joined the burn list.
- **`cx-94` scale-up never happened.** Plan was 4M → 15M; it's still at 3.9M/mo. Same 3.24 ROAS, biggest underfunded winner.
- **`intro2-xpage` scaled aggressively** (10M → 21M 30d spend), revenue tracked up (29.4M → 32.0M), ROAS held right at the 1.5 threshold (1.50). Working as designed — keep going.
- **`13-xpage-kv` slipped from SCALE → HOLD** (1.57 → 1.43). Same 9.9M total rev; the slight extra spend nudged it under 1.5. Not a crisis, just no longer SCALE-grade.
- **3 new high-spend losers surfaced** that weren't on the 5/17 radar: `code13-reup` (12.1M/mo · 0.57), `code83-x3` (12.8M/mo · 0.56), `nm-3` (16.4M/mo · 0.95). All near-breakeven at large volume — they're the biggest budget leaks not yet flagged.

---

## Current state — alive codes by bucket

| Bucket | Codes | 30d spend | Rev | Notes |
|---|---:|---:|---:|---|
| 🟢 SCALE (ROAS ≥ 1.5) | 2 | 24.8M | 87.1M | `cx-94` 3.24, `intro2-xpage` 1.50 |
| 🟡 HOLD (1.0–1.5) | 6 | 53.5M | 74.9M | adds `code14-xpage`, `code85-reup`; demotes `13-xpage-kv` |
| 🟡 WATCH (0.5–1.0) | 10 | **98.0M** | 209.4M | biggest under-attended bucket — see Q1 |
| 🔴 PAUSE NOW | 10 | 64.4M | 22.1M | 8 from 5/17 + `code118-xpage` + `cx` |
| 💤 paused but historically good | 18 | 16.8M | 112.0M | relaunch candidates unchanged |

Total last-30d spend: **394.8M VND** (essentially flat vs the 401M/mo figure on 5/17 — pruning didn't happen, so neither did concentration).

---

## Q1 — The new finding: the WATCH bucket is where the money is leaking

The 5/17 plan focused on SCALE-up and PAUSE. The bigger problem hiding in plain sight is **WATCH**: 10 codes spending 98M VND/mo (1/4 of total budget) at 0.53–0.95 ROAS. None individually catastrophic, but together they're a 98M/mo drag at sub-breakeven.

Three of these — none on the 5/17 radar — are the biggest individual contributors:

| Code | 30d spend | ROAS | Why it's leaking |
|---|---:|---:|---|
| `nm-3` | **16.4M** | 0.95 | Close to breakeven; could be tuned, or borderline-pause |
| `code83-x3` | **12.8M** | 0.56 | Sub-breakeven at scale — same pattern as the `83-xpage-kv` pause (probably same creative repointed) |
| `code13` | **12.7M** | 0.73 | Was profitable historically (lifetime 45.5M rev), now decaying |
| `code13-reup` | **12.1M** | 0.57 | Newly launched reup of `code13` story, not working at this scale |
| `cx93-3` | 11.8M | 0.53 | Just under PAUSE threshold; was on 5/17 pause list at 0.50, drifted up |

**Recommendation:** add at least `code83-x3`, `code13-reup`, and `cx93-3` to the immediate pause list. Combined ~36.7M/mo freed. Watch `code13` for one more week (story-matched the `13-xpage-kv` winner; may recover). `nm-3` at 0.95 + 16.4M spend is the judgment call — cap it at 8M/mo and observe rather than pause outright.

If the original 8-code pause + these 3 are actioned, freed budget jumps from **64M to ~100M VND/mo**.

---

## Q2 — What still holds from the 5/17 plan

Unchanged recommendations (carry over verbatim):
1. **Pause the original 8** — still valid, still unactioned, every day costs ~2M VND.
2. **Scale `cx-94`** from 3.9M → 15M/mo — still the highest-ROAS alive code by a wide margin (3.24×).
3. **LP fix for `/dang-ky`** — still the bare form. Today's LP table shows the gap is even sharper: `/thao` 39.0% conversion vs `/dang-ky` 11.8% (3.3×). `/thao` is now at 1,061 phones for 667M VND revenue — 65% of all LP-attributed revenue flows through this one LP.
4. **Relaunch top 5 paused winners** with refreshed creative — `2-code13`, `code15_xpage`, `code125-xpage`, `ct21`, `code14-2` all still in the paused-historically-good list.
5. **All 8 new creative briefs** (Q4 of 5/17 doc) — none launched yet based on creative-name scan; still the next move once budget is freed.

---

## Q3 — What's improved since 5/17

- **`ct19-xpage` recovered into HOLD** (1.32 ROAS, 4.5M/mo). Was on the borderline-bad list before. Keep alive.
- **`intro2-xpage` scaled successfully** as planned and held ROAS.
- **`code13_xpage` is alive and profitable** (1.17 at 12.4M/mo) — the regret-narrative video deployed under yet another code is still working.
- **`code14-xpage` newly profitable** (1.07 at 8.7M/mo).

---

## Updated implementation order (today)

1. **Pause the 8 codes from 5/17 + the 3 new losers** (`code83-x3`, `code13-reup`, `cx93-3`). Frees ~100M VND/mo. (15 min in Ads Manager.)
2. **Increase budget on `cx-94`** 3.9M → 15M/mo. Single biggest under-funded winner. (2 min.)
3. **Cap `nm-3` at 8M/mo** (currently 16.4M at 0.95 ROAS — half the spend, observe a week before deciding).
4. **Brief content team on the 8 new ad copies from 5/17** — none launched yet. Aim for 3 live within 7 days, destination `/thao`.
5. **Day 7 (2026-05-26): re-run** `npm run roas:build && npm run roas:fetch:creative && npm run roas:actionable` — confirm pauses landed, check new creatives' early ROAS.

---

## Things that need a human decision

- **Is `nm-3` a tune-or-pause?** 16.4M/mo at 0.95 is the kind of code where the buyer might have a thesis. Ask before pausing.
- **Why hasn't the 5/17 plan been actioned?** If there's a reason (creative team capacity, stakeholder review, etc.), the refresh plan needs to match that constraint rather than re-issue the same asks.
- **The `_xpage_kv` variants keep showing up bad.** `45-xpage-kv` 0.24, `83-xpage-kv` 0.00, but `13-xpage-kv` 1.43. The "kv" suffix isn't uniformly bad — likely it's the underlying source creative that matters. Worth one quick investigation: what does the `_kv` suffix actually represent operationally?
