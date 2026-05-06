import { meta } from './client.js';

const accounts = await meta.listAccounts({ activeOnly: false });

console.log(`Connected. ${accounts.length} ad accounts visible:\n`);
for (const a of accounts) {
  const status = a.account_status === 1 ? 'active' : `status=${a.account_status}`;
  console.log(`  ${a.id.padEnd(22)} ${(a.name || '').padEnd(20)} ${a.currency || ''}  ${status}`);
}
