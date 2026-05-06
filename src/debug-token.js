import 'dotenv/config';

const TOKEN = process.env.META_ACCESS_TOKEN;
const VERSION = process.env.META_API_VERSION || 'v21.0';

async function get(path, params = {}) {
  const url = new URL(`https://graph.facebook.com/${VERSION}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', TOKEN);
  const res = await fetch(url);
  return res.json();
}

const accounts = await get('/me/adaccounts', { fields: 'id,name,account_status', limit: 50 });
console.log('Ad accounts visible to this token:');
console.log(JSON.stringify(accounts, null, 2));

const businesses = await get('/me/businesses', { fields: 'id,name', limit: 50 });
console.log('\nBusinesses visible to this token:');
console.log(JSON.stringify(businesses, null, 2));
