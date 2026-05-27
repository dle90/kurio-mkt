# Kurio Marketing — Meta Ads Automation

## Goal
Node.js project that talks directly to the Meta Marketing API (skipping the meta-ads MCP, which had OAuth issues). Used to:
1. Pull campaign performance and rank by lead-gen metrics
2. Analyze top vs bottom performers — surface patterns in audience, placement, creative
3. Draft new ad copy/creative briefs informed by those patterns
4. Create new test campaigns via API (default status: PAUSED for safety)

**Primary objective:** leads. Key metrics: CPL (cost per lead), lead volume, CTR, frequency, hook rate (for video).

## Status
Waiting on user to generate Meta access token + provide ad account ID. Once `.env` is populated, scaffold the project.

---

## Setup Guide — Get Meta API Credentials

Two options for the access token. Pick based on whether you want to deal with renewal.

### Option A — System User token (recommended; never expires)

Requires admin on a Meta Business Manager.

1. Go to **business.facebook.com** → pick your business → **Business settings** (gear icon)
2. Left sidebar → **Users** → **System users** → **Add** → name `kurio-api`, role **Admin** → Create
3. Click the new system user → **Add assets** → **Ad accounts** → select your ad account → toggle **Manage campaigns** ON
4. Click **Generate new token** → select your app (create one at developers.facebook.com if needed — "Business" type) → check scopes: `ads_read` and `ads_management` → Generate
5. Copy the token immediately (only shown once)

### Option B — User token (faster, expires in 60 days)

1. Go to **developers.facebook.com/tools/explorer**
2. Top right: select your app (or create one — "Business" type)
3. **Add permissions**: `ads_read`, `ads_management`, `business_management`
4. Click **Generate Access Token** → approve
5. Copy the short-lived token, then exchange for a long-lived one (ask Claude for the one-liner)

### Get Ad Account ID

- Ads Manager → top left dropdown shows your account → ID format is `act_1234567890`
- Or Business Settings → Accounts → Ad accounts → click yours

### Create `.env`

At `d:\work\Kurio mkt\.env`:

```
META_ACCESS_TOKEN=EAAxxxxxxxxxx...
META_AD_ACCOUNT_ID=act_1234567890
META_API_VERSION=v21.0
```

---

## Planned Project Structure

```
kurio-mkt/
├── .env                  # gitignored
├── .gitignore
├── package.json
├── src/
│   ├── client.js         # thin Graph API wrapper (fetch + token)
│   ├── reports/
│   │   └── performance.js   # last N days, rank by CPL/CTR/lead volume
│   ├── analyze/
│   │   └── insights.js      # creative/targeting comparison: top vs bottom
│   └── campaigns/
│       └── create.js        # create campaigns — defaults to PAUSED
└── README.md
```

### Workflow
1. `npm run report` → table of campaigns sorted by performance, last 30 days
2. `npm run analyze` → top vs bottom quartile patterns (audience, placement, creative angle, copy length, CTA) as JSON
3. Discuss with Claude → draft new ad copy/creative briefs based on patterns
4. `npm run create -- --config new-campaign.json` → creates as PAUSED, review in Ads Manager, flip on manually

### Safety defaults
- All campaign creation defaults to `status: PAUSED`
- Reports/analyze need only `ads_read`; create needs `ads_management`
- Token in `.env`, never logged or committed

---

## Operating rules for future sessions

Running decisions and guardrails carried forward from prior work. Read [FINDINGS.md](FINDINGS.md) for the data behind each one.

**Scope:**
- Token has `ads_read` only. `ads_management` was declined deliberately. Don't build or run `src/campaigns/create.js` until the user explicitly authorizes write access.
- Active accounts to focus on: **Kurio 2** (`act_1071893357737329`) and **Kurio 3** (`act_930175825635997`). Kurio 5 has 3 live campaigns but minor volume. Treat **Huy Quang Mai** (`act_10201301849281099`) as a personal account — out of scope.

**KPI rules:**
- Primary KPI is **`complete_registration` (CPR)**, NOT Meta-form `lead`. Most Kurio campaigns have objective `OUTCOME_SALES`, not `OUTCOME_LEADS`.
- Meta double-reports the same lead under several `action_type` aliases (`lead`, `onsite_conversion.lead_grouped`, `onsite_conversion.lead`, `onsite_web_lead`, `offsite_search_add_meta_leads` — all equal in our data). Canonical sum is `onsite_conversion.lead_grouped + offsite_conversion.fb_pixel_lead`. Never sum `lead` on top of `lead_grouped` — it's 2× double-counting.
- `MESS_*` (Messenger) and `ENGAGE_*` (engagement/awareness) campaigns must NOT be judged by CPR — they optimize for `MESSAGE_PAGE` clicks or reach, not registrations. Use cost-per-conversation or CPM/reach instead, or pause if those channels aren't valued.

**API gotchas:**
- Kurio 2 frequently hits Meta rate-limit error #4. `src/client.js` already has exponential-backoff retry for codes 4/17/32/613 + subcode 2446079. Don't re-implement.
- The ad account ID in `.env` is the actual account ID (16-digit from Ads Manager → Ad account settings) — NOT the App ID. The client auto-prepends `act_` if missing.
- Ad creatives are mostly boosted Page posts (`object_story_id`). Fetching the underlying post needs `pages_read_engagement`, which the token doesn't have. Fall back to `creative.name` for ad copy — it carries the post body with a date-hash suffix that `src/analyze/creatives.js` strips.

**Resolved vs open:**
- ✅ Winning creative formula identified (see FINDINGS.md "What Works")
- ❌ **Original "broad targeting beats interest-stacking by 11×" finding is RETRACTED.** When the same-creative comparison is re-run controlling for ad-life month (J, 2026-05-07), first-month CPR spread is only 1.79× (not 11×). The "11×" was an artifact of `last_90d` capturing the bottom adset's degraded m2/m3 vs the top adsets' efficient m1. Targeting is at most a marginal lever (47% TOP vs 63% BOTTOM at scale, p≈0.21).
- 📐 **Methodological rule (new):** never compare CPR across ad sets using `date_preset` when the ad sets have different ages. Always use `time_increment=30` since each adset's `created_time` for like-for-like life-stage comparisons.
- ✅ At-scale analysis surfaced a bigger lever: **0/60 ad sets use positive custom audiences** (e.g. Lookalike-of-`complete_registration`). Largest unexplored variable.
- ✅ Time-dimension finding (most important so far): **creative-level fatigue is the dominant CPR driver.** Top ads' median CPR ~doubles by month 3 of their lifetime. Ad-set age (the wrapper) has near-zero correlation with CPR (Pearson r=0.071); the fatigue lives at the ad creative level.
- ✅ Seasonal CPR is essentially flat Oct 2025 → May 2026 (~344k → 350k → 368k VND across PRE/IKMC/POST phases). The IKMC organic window does NOT lower CPR — it shifts the funnel mix (cheaper LPVs at worse conversion). Don't budget for an "IKMC efficiency window."
- ⚠️ During IKMC weeks (esp Jan 21 + Jan 28), LPV volume spiked to 8.4k/week at 2.5% conversion vs the ~6% baseline. Plausibly IKMC contest-curious traffic that doesn't convert to paid registrations — worth tracking IKMC-specific landing pages with a different success metric.
- ❓ Open: is brand awareness an actual KPI? Decides fate of `Engage - vtv` (lowercase)
- ❓ Open: confirm with stakeholders that `complete_registration` is the right success metric
- ✅ Apr 29 week investigation: spend dropped 23% (76.9M → 59.2M VND), reg held steady, CPR fell 24% (316k → 239k). Driven by pruning ~25 marginal campaigns + broad same-campaign improvements (11/15 active campaigns improved). Concentration in `_xpage` / `_xpage_kv` LP-suffix winners. **Lesson: pruning underperformers is the most direct controllable CPR lever.**
- 🚨 The `Engage - vtv` (capital + lowercase) pause recommendation from the original audit is **still unactioned 90 days later** — both campaigns spent 2.2M VND in the Apr 29 week with 0 reg. Resurface to user when relevant.
- ✅ `_xpage` / `_xpage_kv` is the **new landing page** (rolled out ~2026-04). Confirmed by user 2026-05-19. XPAGE codes systematically outperform older LP variants — May 2026 XPAGE ROAS 0.91 vs non-XPAGE 0.65 on currently-running codes. The migration is underway and is the single biggest known lever.
- ✅ **Thao LP (`toantuduy.kurio.vn/thao`) is organic IKMC channel, NOT Meta paid.** ~667M VND YTD revenue lands there, handled by sales rep Thao. Zero Meta creatives point to it; zero fbclid/utm on those sheet rows. Must be EXCLUDED from any Meta ROAS numerator. ([see project_thao_organic_lp.md memory])

**ROAS attribution methodology (added 2026-05-19, revised 2026-05-20):**
- 📐 **Use ORDER-BASED revenue (sum approved `sale_orders.real_amount` by `created_at` month, attribute via order.account_phone → Getfly account `custom_fields.ads_code` first-touch → code).** The earlier `account.total_revenue` cohort method was wrong: it credited a customer's lifetime revenue to the month their Getfly account was created, which inflated early-month ROAS and deflated late-month ROAS. Scripts: `src/roas/fetch_getfly_orders_ytd.js`, `src/roas/fetch_getfly_accounts.js`, `src/roas/recompute_codes_ranked.js`, `src/roas/cohort_and_active.js`.
- 📐 **Attribution source switched from the Google Sheet to Getfly `ads_code` (2026-05-20).** Getfly `/accounts` records now carry `custom_fields.ads_code` (the utm_content code, set by the LadiPage form at registration). It's first-party, explains non-ad revenue (organic / renewal / telesales) instead of dropping it as opaque "unattributed", and covers more paying phones than the sheet (6,146 vs 4,220). The sheet adds only ~0.3% incremental revenue on top — it is **retired**. `recompute_codes_ranked.js` defaults to `ATTRIB=getfly`; `ATTRIB=sheet|hybrid` kept for audit only. See [[project_getfly_ads_code_attribution]].
- ❌ **RETRACTED: "creative fatigue at portfolio ROAS level"** (claimed 2026-05-19 earlier in session, then disproven same session). With order-based revenue, the Jan cohort's ROAS *improves* 0.41 → 0.73 over 4 months as repeat purchases land. Most cohorts hold or rise; only CPR (registration cost) fatigues at the per-ad level. The two layers are separate phenomena — keep them separate when reasoning.
- ✅ Per-ad CPR fatigue (top ads' median CPR doubles by month 3) **still holds** — that's about *acquisition cost*, not revenue. Refresh-creative-every-6-8-weeks recommendation stands.
- ✅ Monthly blended ROAS YTD 2026 (order-based, Getfly `ads_code`-attributed, re-baselined 2026-05-20): **Jan 0.75, Feb 0.66, Mar 0.77, Apr 0.87, May 0.90** (May still maturing). YTD blended **0.81**. **Trend is up, not down.** Supersedes the old sheet-method figures (Jan 0.62 … May 0.83), which under-attributed throughout. Ad-code attribution rate of total Getfly revenue: Jan 34% → Apr 60% → May 59% (the rest is genuinely organic / renewal / telesales). Apr–May are the most reliable; Jan–Feb (34–35% rate, only 37–44% of accounts carried `ads_code` then) are **lower bounds** — true early-year ad ROAS is probably higher.
- 🛠 **The whole ROAS pipeline is on Getfly attribution (2026-05-20).** Shared module `src/roas/attribution.js` (`loadAttribution()` → codeSet + phoneToCode + resolveAd) is used by `recompute_codes_ranked.js`, `compute.js` (→ `out/roas_report.html`), `cohort_and_active.js`, and `actionable.js`. `currently_running.js` is a shim → `cohort_and_active.js`. The old sheet/`account.total_revenue`-cohort scripts (`fetch_sheet.js`, `parse_sheet.js`, `fetch_getfly.js`) are de-wired from `npm run roas:build`. Rebuild everything with `npm run roas:build`; daily standup with `npm run roas:daily`.
- ❓ Open: what is the `_xpage_kv` landing page variant structurally? It dominates winners — worth confirming with team and considering standardization.

---

## Dashboard server (src/server/, Railway-deployable)

Small Express app that serves `out/cohort.html`, `out/cohort_drilldown.html`, and the latest `data/roster-*.html` behind a single "Refresh" button.

**Run locally:**
```
DASHBOARD_PASSWORD=<pick-one> npm run server
# → http://localhost:3000
```
DB-less mode: cooldown state lives in-process and resets on restart. Set `DATABASE_URL` for persistence.

**Refresh contract — incremental by design.**
- Hard 10-min cooldown between successful runs (HTTP 429 otherwise; bypass with `POST /refresh?force=1`).
- Per-stage staleness skip — a stage only runs if its output file is older than its threshold:
  - Getfly orders YTD: 1 h
  - Getfly accounts: 6 h
  - cohort_drilldown / adset_roster / cohort_chart: 10 min
- Stage order is fixed (cohort_chart depends on adset_roster's JSON output). Don't parallelize.
- One in-flight build at a time (HTTP 409 on overlapping POST).
- Auth: HTTP Basic on `POST /refresh` only — read endpoints are public.

**Tuning the thresholds:** edit `STAGES` and `COOLDOWN_MS` in `src/server/refresh.js`. No env vars for these — keep them in code so the policy is auditable.

**Railway deployment:**
- `Dockerfile` (Node 20 slim) + `railway.json` are in repo root.
- Attach a Postgres plugin → `DATABASE_URL` is injected automatically.
- Attach a Volume mounted at `/data` for `.cache/`, `data/`, `out/` persistence across restarts.
- Set env vars: `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_API_VERSION`, `GETFLY_HOST`, `GETFLY_API_KEY`, `GETFLY_API_VERSION`, `DASHBOARD_PASSWORD`, `DATA_DIR=/data`, `TZ=Asia/Ho_Chi_Minh`.
- Healthcheck: `GET /healthz`.

**Code map:**
- `src/server/index.js` — Express routes, basic-auth middleware, status JSON.
- `src/server/refresh.js` — stage list, staleness checks, pipeline runner (spawns existing fetch scripts as child processes with `cwd = DATA_DIR`, so the scripts' relative paths still work).
- `src/server/db.js` — Postgres schema + queries, in-memory fallback when `DATABASE_URL` is unset. Reclaims stale `running` rows on startup.
- `src/server/views/index.html` — single-page dashboard (status panel + 3 iframe tabs for cohort/drilldown/roster). Polls `/status` every 2 s during a build, 15 s when idle.
