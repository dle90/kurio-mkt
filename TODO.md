# Kurio Marketing — Working To-Do

Roadmap captured 2026-05-22. First working session against it planned 2026-05-23.
Items 2 and 3 are the starting focus. See [CLAUDE.md](CLAUDE.md) and [FINDINGS.md](FINDINGS.md) for the data behind prior decisions.

## 1. Wire reg and rev to salesperson
Attribute registrations and revenue down to the individual salesperson, not just ad code.
- Salesperson data is expected to exist in Getfly — **needs an API probe** to confirm the field
  (likely an order-owner / assigned-staff field on `/sale_orders`, or on the linked `/accounts` record).
- Starting point: `src/getfly/` client + `src/getfly/attribute_orders.js`.

## 2. Algorithm to pick / scale / remove ad campaign roster
A repeatable method to choose the "ad set of the day", decide what to scale, and decide what to cut.
- `src/reports/daily.js` already aggregates per-campaign spend/reg/CPR — but only at campaign level.
  Ad-set-of-the-day needs ad-set-level pulls.
- Decide the selection rule up front: CPR rank? CPR + minimum reg volume? factor in creative age
  (creative fatigue is the dominant CPR driver — see FINDINGS).

## 3. Distill creative insights → new creative + testing framework
Turn existing findings into concrete new creative, and stand up a structured framework for testing it.
- Inputs: dynamic-image beats video at every spend tier; untested angles include screen-addiction
  reframe, dad voice, lớp-5 entry-exam, topic-specific weakness, anti-học-thêm (see FINDINGS).

## 4. Explore other channels
Diversify beyond Meta ads — e.g. SEO.

---
_Note: the ROAS-pipeline fix path (Getfly custom fields + Ladipage mapping) is still open but
de-prioritized behind this roadmap._
