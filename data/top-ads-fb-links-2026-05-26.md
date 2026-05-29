# Top ads — Facebook post links (saved 2026-05-29)

Source: [data/roster-2026-05-26.json](roster-2026-05-26.json), window 7d (2026-05-20 → 2026-05-26).
Ranked by the same blended score as [src/reports/adset_roster.js](../src/reports/adset_roster.js):
`(TARGET_CPR / cpr_7d) × (1 + (code_roas ?? 0))`, TARGET_CPR=350,000 VND.
Resolved by [src/get_top_fb_links.js](../src/get_top_fb_links.js).

> Caveat: many of these campaigns are now in `effective_status=CAMPAIGN_PAUSED`. The Page-post URLs still resolve; the ad sets may not be live when you re-check.

## Top 10 of the week

| # | Code | Acct | 7d spend (VND) | Reg | CPR | ROAS | FB post |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | code14-xpage | K2 | 1,651,397 | 19 | 86,916 | 0.84 | https://www.facebook.com/434599216414005/posts/122172738188676082 |
| 2 | code13-reup | K2 | 1,628,249 | 11 | 148,023 | 1.62 | https://www.facebook.com/106783008809288/posts/948653327961779 |
| 3 | code13-reup | K2 | 1,641,089 | 10 | 164,109 | 1.62 | https://www.facebook.com/106783008809288/posts/948653327961779 |
| 4 | code13_xpage_kv | K3 | 1,638,251 | 17 | 96,368 | 0.39 | https://www.facebook.com/434599216414005/posts/122172655628676082 |
| 5 | intro2-xpage | K3 | 1,663,080 | 18 | 92,393 | — | https://www.facebook.com/106783008809288/posts/965098152983963 |
| 6 | cx | K2 | 8,729,754 | 38 | 229,730 | 1.46 | https://www.facebook.com/101071823076534/posts/728310683670601 |
| 7 | code45-reup | K2 | 1,620,255 | 8 | 202,532 | 1.02 | https://www.facebook.com/106783008809288/posts/948502781310167 |
| 8 | intro2-xpage | K3 | 1,653,465 | 16 | 103,342 | — | https://www.facebook.com/106783008809288/posts/965098176317294 |
| 9 | intro2-xpage | K3 | 1,629,984 | 15 | 108,666 | — | https://www.facebook.com/106783008809288/posts/965098152983963 |
| 10 | code14-xpage | K2 | 1,676,949 | 8 | 209,619 | 0.84 | https://www.facebook.com/434599216414005/posts/122172738188676082 |

### Unique posts in the top 10 (6 total)

| Code(s) | Page | Post | URL |
|---|---|---|---|
| code14-xpage | 434599216414005 | 122172738188676082 | https://www.facebook.com/434599216414005/posts/122172738188676082 |
| code13-reup | 106783008809288 | 948653327961779 | https://www.facebook.com/106783008809288/posts/948653327961779 |
| code13_xpage_kv | 434599216414005 | 122172655628676082 | https://www.facebook.com/434599216414005/posts/122172655628676082 |
| intro2-xpage (variant A) | 106783008809288 | 965098152983963 | https://www.facebook.com/106783008809288/posts/965098152983963 |
| intro2-xpage (variant B) | 106783008809288 | 965098176317294 | https://www.facebook.com/106783008809288/posts/965098176317294 |
| cx | 101071823076534 | 728310683670601 | https://www.facebook.com/101071823076534/posts/728310683670601 |
| code45-reup | 106783008809288 | 948502781310167 | https://www.facebook.com/106783008809288/posts/948502781310167 |

## Extras requested separately

### ct19-xpage

| Acct | Campaign / Adset | 7d spend | Reg | CPR | ROAS | FB post |
|---|---|---:|---:|---:|---:|---|
| K2 | CVS_TUANTA_25/06_CT18+19-xpage - Bản sao › CT19 | 651,918 | 5 | 130,384 | 0.14 | https://www.facebook.com/434599216414005/posts/122172666752676082 |

(Only one ad set carries `code=ct19` *and* has `xpage` in the campaign name. There is a separate `ct19` ad set on K3 — `CVS_TUANTA_07/07_CODE19 - TG` — not included because it doesn't carry the xpage variant.)

### nm

| Acct | Campaign / Adset | 7d spend | Reg | CPR | ROAS | FB post | Note |
|---|---|---:|---:|---:|---:|---|---|
| K3 | CVS_TUANTA_01/07_CODE_NM+CX - Bản sao 2 › CODENM+CX | 1,399,701 | 9 | 155,522 | 0.32 | https://www.facebook.com/101071823076534/posts/728310683670601 | ⚠ active ad is the `cx` post, not an NM creative — same URL as top-10 #6 |
| K3 | CVS_TUANTA_01/07_CODE_NM+CX - Bản sao 3 › CODENM+CX | 832,716 | 0 | — | 0.32 | https://www.facebook.com/111978095278084/posts/726643577154040 | actual NM creative; 0 reg on 833k spend (in CUT bucket) |

## Raw payload

JSON for the top 10 (with adset IDs, ad IDs, story IDs): [data/top-fb-links-2026-05-26.json](top-fb-links-2026-05-26.json)
