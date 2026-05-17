import 'dotenv/config';

const HOST = process.env.GETFLY_HOST;
const KEY = process.env.GETFLY_API_KEY;

if (!HOST) throw new Error('Missing GETFLY_HOST in .env');
if (!KEY) throw new Error('Missing GETFLY_API_KEY in .env');

const VERSION = process.env.GETFLY_API_VERSION || 'v6';
const BASE = `https://${HOST}/api/${VERSION}`;

async function request(method, path, { params = {}, body } = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method,
    headers: {
      'X-API-KEY': KEY,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    const msg = json?.message || json?.error || res.statusText;
    const err = new Error(`Getfly ${method} ${path} -> ${res.status} ${msg}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export const getfly = {
  host: HOST,
  version: VERSION,
  base: BASE,
  get: (path, params) => request('GET', path, { params }),
  post: (path, body, params) => request('POST', path, { body, params }),
};
