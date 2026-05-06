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
- ✅ Targeting insight: broad beats interest-stacking on `OFFSITE_CONVERSIONS` (n=5, suggestive)
- ❓ Open: validate broad-targeting hypothesis at larger scale (top 30 + bottom 30 by CPR)
- ❓ Open: is brand awareness an actual KPI? Decides fate of `Engage - vtv` (lowercase)
- ❓ Open: confirm with stakeholders that `complete_registration` is the right success metric
