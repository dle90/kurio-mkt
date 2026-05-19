// Normalization helpers for the two fuzzy join keys: phone numbers and the
// short campaign "code". Both the Excel leads sheet and Meta ad names are
// inconsistent, so normalize aggressively but reversibly (raw values are kept
// alongside the normalized ones in the db).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Phone numbers (Vietnamese mobile).
// ---------------------------------------------------------------------------

/**
 * Normalize a VN phone to the canonical 0XXXXXXXXX form (10 digits).
 * Handles +84 / 84 country code, stray spaces/dots/dashes, and a missing
 * leading zero. Returns null if it can't be made into a plausible mobile.
 */
export function normalizePhone(raw) {
  if (raw == null) return null;
  let d = String(raw).replace(/[^\d]/g, '');
  if (!d) return null;
  if (d.startsWith('84')) d = '0' + d.slice(2);          // +84 / 0084 / 84
  else if (d.length === 9) d = '0' + d;                  // missing leading 0
  // VN mobile numbers are 10 digits starting with 0 and a 3/5/7/8/9 prefix.
  if (/^0[35789]\d{8}$/.test(d)) return d;
  // Keep other 10-11 digit numbers as-is (landlines, hotlines) rather than drop.
  if (d.length >= 9 && d.length <= 11) return d.startsWith('0') ? d : '0' + d;
  return null;
}

// ---------------------------------------------------------------------------
// Short campaign code.
// ---------------------------------------------------------------------------

// Optional alias map: { "raw or normalized form": "canonical code" }.
// Lives at data/code-aliases.json — created/maintained by hand once the
// coverage report shows which codes don't auto-match. Loaded lazily.
let _aliases = null;
function aliases() {
  if (_aliases) return _aliases;
  const p = join(__dirname, '..', '..', 'data', 'code-aliases.json');
  _aliases = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  return _aliases;
}

/**
 * Normalize a code string: lowercase, trim, collapse whitespace, and remove
 * spaces around separators ("CX - 94" -> "cx-94"). Numeric suffixes like the
 * "-3" in "code63-3" are meaningful and kept. Then apply the alias map.
 */
export function normalizeCode(raw) {
  if (raw == null) return null;
  let c = String(raw).trim().toLowerCase();
  if (!c) return null;
  c = c.replace(/\s*([-_])\s*/g, '$1').replace(/\s+/g, ' ').trim();
  const map = aliases();
  return map[c] || map[raw] || c;
}

/**
 * Derive the short code from a Meta ad name. Ad names in this account are
 * already the codes (e.g. "13-xpage-kv", "code86-reup"), so this is mostly
 * normalizeCode — but if a long "CVS_TUANTA_..._CODE14_xpage" style name slips
 * in, pull the codeNN token out of it.
 */
export function extractCode(adName) {
  if (!adName) return null;
  const long = String(adName).match(/code\s*(\d+[a-z0-9_-]*)/i);
  if (long && /[_/]/.test(adName) && adName.length > 25) {
    return normalizeCode('code' + long[1]);
  }
  return normalizeCode(adName);
}
