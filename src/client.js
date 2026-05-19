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
    const subcode = json.error?.error_subcode;
    const msg = json.error?.message || res.statusText;
    // 4/17/32/613 = rate limits; 1/2 = Meta's transient "unknown error" /
    // "service temporarily unavailable" (common on heavy insights queries).
    const isRateLimit = code === 1 || code === 2 || code === 4 || code === 17 ||
      code === 32 || code === 613 || subcode === 2446079;
    if (isRateLimit && retry < 4) {
      const wait = (2 ** retry) * 30_000;
      console.log(`  [rate-limited, sleeping ${wait / 1000}s before retry ${retry + 1}/4]`);
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
    const subcode = json.error?.error_subcode;
    // 4/17/32/613 = rate limits; 1/2 = Meta's transient "unknown error" /
    // "service temporarily unavailable" (common on heavy insights queries).
    const isRateLimit = code === 1 || code === 2 || code === 4 || code === 17 ||
      code === 32 || code === 613 || subcode === 2446079;
    if (isRateLimit && retry < 4) {
      const wait = (2 ** retry) * 30_000;
      console.log(`  [paging rate-limited, sleeping ${wait / 1000}s before retry ${retry + 1}/4]`);
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
