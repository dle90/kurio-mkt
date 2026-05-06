# Kurio Marketing — Meta Ads Automation

Direct Meta Marketing API tooling for analyzing Kurio's lead-gen performance and (eventually) creating new campaigns. Skips the meta-ads MCP because of OAuth issues.

**Current status:** read-only (token has `ads_read` only). See [FINDINGS.md](FINDINGS.md) for the 90-day audit.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `META_ACCESS_TOKEN` — generate at [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer) with `ads_read` scope (and `ads_management` later for write access)
   - `META_AD_ACCOUNT_ID` — `act_XXXXXXXXX...` from Ads Manager → Ad account settings (NOT the App ID)
   - `META_API_VERSION` — defaults to `v21.0`
2. `npm install`
3. `npm run verify` — confirms which accounts the token can see

## Scripts

| Command | What it does |
|---|---|
| `npm run verify` | List accessible ad accounts |
| `npm run report` | Campaign-level performance for Kurio 2 + Kurio 3 (last 30d default; set `DATE_PRESET=last_90d` for 90) |
| `npm run analyze` | Ad-level creative analysis — top vs bottom by CPR with copy excerpts and pattern breakdown |

Diagnostics (run with `node`):

- `src/diagnose.js` — campaign counts per account and full action_type tally
- `src/check-engage.js` — delivery + engagement breakdown for the `ENGAGE - vtv` campaigns
- `src/inspect-creative.js [ad_id]` — dump full creative structure for one ad

## Project layout

```
src/
├── client.js                 # Graph API wrapper with rate-limit retry
├── verify.js                 # account listing
├── reports/
│   └── performance.js        # campaign-level CPR/CTR/LPV report
├── analyze/
│   └── creatives.js          # ad-level creative pattern analysis
└── *.js                      # diagnostic scripts
```

## Key findings

See [FINDINGS.md](FINDINGS.md) for the full audit. Headlines:

- **CPR is the right KPI**, not Meta-form `lead`. 2,852 registrations vs 476 form leads in 90 days.
- **The Kurio winning creative formula**: pain headline + 3K/ngày price anchor + long-form parent narrative. 100% of top-15 ads share these traits.
- **Targeting dominates creative.** Identical copy produces 11× CPR spread depending on ad set audience/placement.
- **~30M VND/month in pause candidates** with zero registration impact.

## Safety

- `.env` is gitignored — never commit the token.
- Token has `ads_read` only; no write paths exist yet.
- When `ads_management` is granted, all campaign creation should default to `status: PAUSED`.
