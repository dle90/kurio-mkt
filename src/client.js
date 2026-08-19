import 'dotenv/config';

const TOKEN = process.env.META_ACCESS_TOKEN;
const RAW_ACCOUNT = process.env.META_AD_ACCOUNT_ID;
const VERSION = process.env.META_API_VERSION || 'v21.0';

if (!TOKEN) {
  throw new Error('Missing META_ACCESS_TOKEN in .env');
}

const normalizeAccount = id => (id && !id.startsWith('act_') ? `act_${id}` : id);

const ACCOUNT = RAW_ACCOUNT ? normalizeAccount(RAW_ACCOUNT) : null;

// Known account ID -> friendly name. Falls back to the bare ID if unmapped.
const ACCOUNT_NAMES = {
  act_1071893357737329: 'Kurio 2',
  act_930175825635997: 'Kurio 3',
  act_1069029708221793: 'Kurio 5',
  act_630326812905786: 'Kurio 4',
  act_858741683071872: 'Kurio',
  act_1055641230037368: 'Kurio Math',
};

// Focus accounts from META_AD_ACCOUNT_IDS (comma-separated), falling back to META_AD_ACCOUNT_ID.
const TARGETS = (process.env.META_AD_ACCOUNT_IDS || RAW_ACCOUNT || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(normalizeAccount)
  .map(id => ({ id, name: ACCOUNT_NAMES[id] || id }));

const BASE = `https://graph.facebook.com/${VERSION}`;

// ---- Retry policy: deliberately fail-fast ----
//
// Meta's ads-insights throttle refills on roughly an hour scale, so the old
// 30/60/120/240s ladder (7.5 min) could never outlast a real throttle — it just
// burned ~10 min per stage and left the account deeper in the hole for the next
// attempt. One short retry absorbs a genuine transient blip; past that we fail
// fast, so a refresh reports back in ~1 min instead of ~10.
//
// Escape hatch for long batch jobs that would rather wait than die:
//   META_MAX_RETRIES=4 META_RETRY_BASE_MS=30000 node src/roas/fetch_meta_spend_monthly.js
// META_MAX_RETRIES=0 disables retrying entirely.
// Parse an int env var defensively. Railway hands you an EMPTY STRING for a
// variable created with no value, and +'' === 0 — which would have silently
// disabled retrying altogether. Garbage must fall back, not become NaN (a NaN
// delay makes setTimeout fire immediately, turning a retry into an instant
// re-hammer of the endpoint that just throttled us).
function envInt(name, fallback, min, max) {
  const raw = (process.env[name] ?? '').trim();
  if (raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

const MAX_RETRIES = envInt('META_MAX_RETRIES', 1, 0, 10);
const RETRY_BASE_MS = envInt('META_RETRY_BASE_MS', 20_000, 1_000, 300_000);
// Cap any single wait, so a large META_MAX_RETRIES can't compound into hours.
const MAX_RETRY_WAIT_MS = 300_000;

// 4/17/32/613 = rate limits; 1/2 = Meta's transient "unknown error" /
// "service temporarily unavailable" (common on heavy insights queries).
const isThrottle = err => {
  const code = err?.code;
  return code === 1 || code === 2 || code === 4 || code === 17 ||
    code === 32 || code === 613 || err?.error_subcode === 2446079;
};

// ms to wait before the next attempt, or null to give up now.
function retryDelay(err, retry) {
  if (!isThrottle(err) || retry >= MAX_RETRIES) return null;
  return Math.min(MAX_RETRY_WAIT_MS, (2 ** retry) * RETRY_BASE_MS);
}

async function request(method, path, { params = {}, body, retry = 0 } = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  }
  url.searchParams.set('access_token', TOKEN);

  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    const code = json.error?.code;
    const msg = json.error?.message || res.statusText;
    const wait = retryDelay(json.error, retry);
    if (wait != null) {
      console.log(`  [throttled (${code}), sleeping ${wait / 1000}s before retry ${retry + 1}/${MAX_RETRIES}]`);
      await new Promise(r => setTimeout(r, wait));
      return request(method, path, { params, body, retry: retry + 1 });
    }
    throw new Error(`Meta API ${method} ${path} failed${code ? ` (${code})` : ''}: ${msg}`);
  }
  return json;
}

async function fetchWithRetry(url, retry = 0) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || json.error) {
    const code = json.error?.code;
    const wait = retryDelay(json.error, retry);
    if (wait != null) {
      console.log(`  [paging throttled (${code}), sleeping ${wait / 1000}s before retry ${retry + 1}/${MAX_RETRIES}]`);
      await new Promise(r => setTimeout(r, wait));
      return fetchWithRetry(url, retry + 1);
    }
    throw new Error(`Meta API paging failed${code ? ` (${code})` : ''}: ${json.error?.message || res.statusText}`);
  }
  return json;
}

async function paginate(path, params = {}) {
  const out = [];
  let next = null;
  let first = true;
  while (first || next) {
    let page;
    if (next) {
      page = await fetchWithRetry(next);
    } else {
      page = await request('GET', path, { params: { ...params, limit: params.limit || 100 } });
    }
    out.push(...(page.data || []));
    next = page.paging?.next || null;
    first = false;
  }
  return out;
}

export const meta = {
  account: ACCOUNT,
  targets: TARGETS,
  version: VERSION,
  get: (path, params) => request('GET', path, { params }),
  post: (path, body, params) => request('POST', path, { body, params }),
  getAll: paginate,

  async listAccounts({ activeOnly = true } = {}) {
    const accounts = await paginate('/me/adaccounts', {
      fields: 'id,name,account_status,currency,timezone_name',
    });
    return activeOnly ? accounts.filter(a => a.account_status === 1) : accounts;
  },
};
