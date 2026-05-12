# Clean-Slate Strategy — If We Rebuilt Kurio's Meta Program From Scratch

Drafted 2026-05-12. Forward-looking opinion piece based on the findings in [FINDINGS.md](FINDINGS.md). Not a plan-of-record — a reference for "what would we do if structural sprawl weren't already in place." Revisit when scoping the next reorganization or quarterly reset.

## TL;DR

Kurio's current Meta program is a working business leaving an estimated 30–50% CPR efficiency on the table. The fixes are structural, not clever:
- Consolidate accounts and campaigns so Meta's optimizer gets dense Pixel signal
- Treat creative-level fatigue as the dominant CPR driver (it is) and ship a refresh pipeline that matches
- Default to dynamic-image format and `_xpage_kv` LP
- Run broad targeting + Lookalike(1%) of `complete_registration` — the single biggest unexplored lever
- Prune mechanically, not editorially

## Account architecture

**One ad account, not three.** Kurio 2 + 3 + 5 split the Pixel signal Meta needs to optimize. Consolidate, let density accumulate, drop the rate-limit headache.

**Three campaigns max, not 100+:**
1. **Cold acquisition** — `OUTCOME_SALES`, broad + Lookalike(1%) of `complete_registration`, HN/HCM/ĐN, age 28–45, FB-only
2. **Retargeting** — site visitors + LPV who didn't register, 14-day window
3. **Brand/awareness** — only if stakeholders confirm it's a real KPI; otherwise kill `Engage - vtv` immediately

Each campaign has 2–3 ad sets max, differentiated only by audience (broad / LAL / RT), never by interest stack. The Apr 29 pruning win (23% spend cut → 24% CPR drop) is evidence that fewer-fatter beats sprawl.

## Creative system

Creative is the product. The original "11× targeting" insight was wrong — fatigue at the *creative* level is what kills CPR. So the pipeline should match:

- **6–8 net-new angles per month, not 30 video variants of one angle.** Force 2–3 high-conviction blind spots into every batch (screen-addiction reframe, dad voice, lớp-5 entry exam, topic-specific weakness, anti-học-thêm moment).
- **Default format: dynamic-image.** 4–6/month at 500k–2M each. Reserve video (2/month max) for cells where motion is load-bearing.
- **One landing page: `_xpage_kv`-style.** Standardize. Stop running traffic into 8 LP variants.
- **Hard retirement rule:** any ad whose 7-day rolling CPR exceeds 1.5× its first-month CPR gets killed automatically. Fatigue is mechanical — treat it mechanically.
- **The 7-trait formula is the wrapper; angle is the variable.** Hold formula constant, vary angle. Never the other way around.

## Measurement

- **Lock `complete_registration` as the single source of truth.** Stop reporting Meta-form `lead`, stop summing aliases. One canonical metric.
- **Never use `date_preset` for cross-adset comparisons.** Always `time_increment=30` since each adset's `created_time`. Ship as default in the analyze scripts so nobody re-makes the "11×" mistake.
- **Cap historical lookback at 2025-10-01.** Pre-Oct data is too noisy.
- **One weekly dashboard:** CPR trend, top-15 ad fatigue curves, kill-list (ads exceeding fatigue threshold), spend-allocation drift. Replaces ad-hoc analysis.

## Targeting

- **Default:** broad + named-city geo. No interests, no behaviors, no family_statuses.
- **Lookalike(1%) of `complete_registration`** as the second ad set in every campaign. Single biggest unexplored lever (0/60 adsets currently use it).
- **One excluded lookalike of existing customers**, applied consistently. Current 27% adoption is superstition, not policy.
- Stop with the `Education + Parents` interest stack. It's the default in 63% of bottom adsets for a reason.

## Ops cadence

- **Weekly:** kill list (fatigued ads + zero-reg campaigns), launch list (refresh batch of 6–8)
- **Monthly:** angle audit — which blind spots are still untested, which winners need replication
- **Quarterly:** stakeholder re-confirm that `complete_registration` is the success metric, and whether brand awareness has actual budget claim
- **Permanent:** read-only Meta token for analysis. Write access on one human's account, used for launches only. Audit log on every campaign creation.

## What we'd NOT rebuild

- The meta-ads MCP integration (direct Graph API is cleaner — skip-decision was right)
- Lead-form objective campaigns — they underperform `OUTCOME_SALES` for Kurio's product and the dual reporting is a constant source of metric confusion
- `MESS_*` Messenger campaigns, unless someone articulates why conversation volume matters separately from registration

## Day-1 move

Pause `Engage - vtv` (capital + lowercase) and audit every campaign with 0 reg in the last 30 days. The Apr 29 pruning result says this single move recovers 20%+ CPR with zero downside. Sitting unactioned 90+ days. Doesn't require write access — one human clicking pause in Ads Manager.

## Honest summary

None of these fixes are clever. They're discipline.
