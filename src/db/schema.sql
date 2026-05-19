-- Kurio marketing ROAS database schema
-- Join chain:  spend_daily -> ads.code -> leads.code ; leads.phone -> revenue.phone
-- ROAS rolls up at the short-code level (code63, intro2-xpage, ...).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- One row per Meta campaign.
CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id   TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL,
  account_name  TEXT,
  name          TEXT,
  objective     TEXT,
  status        TEXT,
  created_time  TEXT,
  synced_at     TEXT
);

-- One row per Meta ad. `code` is the normalized short code derived from the
-- ad name (see src/lib/normalize.js); it is the key everything joins on.
CREATE TABLE IF NOT EXISTS ads (
  ad_id        TEXT PRIMARY KEY,
  campaign_id  TEXT REFERENCES campaigns(campaign_id),
  adset_id     TEXT,
  adset_name   TEXT,
  name         TEXT,
  code         TEXT,
  synced_at    TEXT
);

-- Daily Meta metrics per ad. Re-ingesting overwrites by (ad_id, date).
CREATE TABLE IF NOT EXISTS spend_daily (
  ad_id              TEXT NOT NULL REFERENCES ads(ad_id),
  date               TEXT NOT NULL,
  spend              REAL    DEFAULT 0,
  impressions        INTEGER DEFAULT 0,
  clicks             INTEGER DEFAULT 0,
  link_clicks        INTEGER DEFAULT 0,
  landing_page_views INTEGER DEFAULT 0,
  registrations      INTEGER DEFAULT 0,  -- complete_registration
  leads_meta         INTEGER DEFAULT 0,  -- Meta-form leads (lead_grouped + fb_pixel_lead)
  PRIMARY KEY (ad_id, date)
);

-- Leads from the phone->campaign Excel sheet. phone is normalized; phone_raw
-- keeps the original. UNIQUE guards against re-ingesting the same row.
CREATE TABLE IF NOT EXISTS leads (
  lead_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  phone      TEXT NOT NULL,
  phone_raw  TEXT,
  code       TEXT,
  lead_date  TEXT,
  name       TEXT,
  package    TEXT,
  grade      TEXT,
  source     TEXT,
  raw        TEXT,                       -- original row as JSON
  UNIQUE (phone, code, lead_date)
);

-- Revenue/orders from the CRM API. Joins to leads on normalized phone.
CREATE TABLE IF NOT EXISTS revenue (
  revenue_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT UNIQUE,
  phone       TEXT NOT NULL,
  phone_raw   TEXT,
  amount      REAL NOT NULL DEFAULT 0,
  order_date  TEXT,
  package     TEXT,
  status      TEXT,
  raw         TEXT,
  synced_at   TEXT
);

-- Bookkeeping for incremental ingests.
CREATE TABLE IF NOT EXISTS ingest_log (
  source     TEXT NOT NULL,
  ran_at     TEXT NOT NULL,
  detail     TEXT
);

CREATE INDEX IF NOT EXISTS idx_ads_code      ON ads(code);
CREATE INDEX IF NOT EXISTS idx_ads_campaign  ON ads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_spend_date    ON spend_daily(date);
CREATE INDEX IF NOT EXISTS idx_leads_phone   ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_code    ON leads(code);
CREATE INDEX IF NOT EXISTS idx_revenue_phone ON revenue(phone);

-- ---------------------------------------------------------------------------
-- Views: the ROAS join chain.
-- ---------------------------------------------------------------------------

-- Meta spend + delivery rolled up to the short-code level.
DROP VIEW IF EXISTS v_spend_by_code;
CREATE VIEW v_spend_by_code AS
SELECT
  a.code                       AS code,
  COUNT(DISTINCT a.ad_id)      AS ads,
  SUM(s.spend)                 AS spend,
  SUM(s.impressions)           AS impressions,
  SUM(s.link_clicks)           AS link_clicks,
  SUM(s.landing_page_views)    AS landing_page_views,
  SUM(s.registrations)         AS registrations,
  MIN(s.date)                  AS first_day,
  MAX(s.date)                  AS last_day
FROM spend_daily s
JOIN ads a ON a.ad_id = s.ad_id
WHERE a.code IS NOT NULL
GROUP BY a.code;

-- Leads + attributed revenue rolled up to the short-code level.
-- Attribution v1: an order is credited to every code the phone has a lead for.
-- If a phone has leads under multiple codes this double-counts revenue across
-- codes (not within a code) -- revisit with last-touch once lead_date/order_date
-- coverage is confirmed.
DROP VIEW IF EXISTS v_revenue_by_code;
CREATE VIEW v_revenue_by_code AS
SELECT
  l.code                              AS code,
  COUNT(DISTINCT l.lead_id)           AS leads,
  COUNT(DISTINCT r.revenue_id)        AS orders,
  COALESCE(SUM(r.amount), 0)          AS revenue
FROM leads l
LEFT JOIN revenue r ON r.phone = l.phone
WHERE l.code IS NOT NULL
GROUP BY l.code;

-- The headline view: spend vs revenue vs ROAS per code.
DROP VIEW IF EXISTS v_roas_by_code;
CREATE VIEW v_roas_by_code AS
SELECT
  COALESCE(s.code, rv.code)               AS code,
  COALESCE(s.spend, 0)                    AS spend,
  COALESCE(s.registrations, 0)            AS registrations,
  COALESCE(rv.leads, 0)                   AS leads,
  COALESCE(rv.orders, 0)                  AS orders,
  COALESCE(rv.revenue, 0)                 AS revenue,
  CASE WHEN COALESCE(s.spend, 0) > 0
       THEN COALESCE(rv.revenue, 0) * 1.0 / s.spend END AS roas,
  CASE WHEN COALESCE(s.registrations, 0) > 0
       THEN COALESCE(s.spend, 0) * 1.0 / s.registrations END AS cpr,
  CASE WHEN COALESCE(rv.leads, 0) > 0
       THEN COALESCE(rv.orders, 0) * 1.0 / rv.leads END AS lead_to_order
FROM v_spend_by_code s
FULL OUTER JOIN v_revenue_by_code rv ON rv.code = s.code;
