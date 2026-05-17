// Look for revenue/value fields on the /accounts (customer) endpoint.
import { getfly } from './client.js';

async function probeFields(path, candidates) {
  console.log(`\n=== ${path} field probe (${candidates.length}) ===`);
  const ok = [];
  for (const f of candidates) {
    try {
      const r = await getfly.get(path, { limit: 1, fields: f });
      const rec = r?.data?.[0];
      if (rec && rec[f] != null) {
        const v = rec[f];
        const s = typeof v === 'object' ? JSON.stringify(v).slice(0, 100) : String(v).slice(0, 100);
        console.log(`  ✓ ${f.padEnd(30)} = ${s}`);
        ok.push(f);
      }
    } catch {}
  }
  return ok;
}

const main = async () => {
  // Money / revenue / value fields on /accounts
  const REV_CANDIDATES = [
    // Money
    'total_paid', 'total_revenue', 'total_amount', 'total_value', 'total_money', 'total',
    'paid', 'paid_amount', 'amount', 'amount_paid',
    'balance', 'credit', 'debit', 'available_credit',
    'money', 'value', 'price',
    'lifetime_value', 'ltv', 'customer_value', 'account_value',
    'order_total', 'order_value', 'order_amount', 'total_orders',
    'sales_total', 'sales_amount', 'revenue', 'income',
    'spent', 'spending', 'total_spent', 'total_spending',
    'invoice_amount', 'invoice_total',
    // Vietnamese
    'tong_thanh_toan', 'tong_doanh_thu', 'doanh_thu', 'doanh_so',
    'tong_tien', 'tien', 'so_tien', 'cong_no',
    'tong_don_hang', 'gia_tri_kh', 'gia_tri_khach',
    // Counts
    'order_count', 'sale_count', 'total_order_count', 'so_don_hang',
    'has_paid', 'is_customer', 'is_paid_customer',
    // Last activity
    'last_order_at', 'last_purchase_at', 'last_payment_at',
    'first_order_at', 'first_purchase_at',
  ];
  await probeFields('/accounts', REV_CANDIDATES);

  // Also: scan a paying account (we know account_id 29230 is paid — id 5013 sale_order)
  console.log('\n=== Pull account 29230 (a known paying customer) with all fields ===');
  try {
    const r = await getfly.get('/accounts/29230');
    console.log(JSON.stringify(r, null, 2).slice(0, 2000));
  } catch (e) { console.log(' ✗ ', e.message); }

  // Try /accounts/{id} with explicit money fields
  console.log('\n=== /accounts/29230 with explicit revenue projection ===');
  const tries = ['total_paid,total_revenue,total_amount,lifetime_value,balance,doanh_thu,tong_thanh_toan',
                 'sale_orders,orders,opportunities'];
  for (const fields of tries) {
    try {
      const r = await getfly.get('/accounts/29230', { fields });
      console.log(`  fields="${fields}":`);
      console.log(`    ${JSON.stringify(r).slice(0, 500)}`);
    } catch (e) { console.log(`  ✗ fields="${fields}": ${e.message.slice(0, 120)}`); }
  }

  // Try /accounts/{id}/sale_orders sub-path
  console.log('\n=== /accounts/{id}/sale_orders sub-path ===');
  for (const id of [29230, 29264, 28984]) {
    for (const sub of ['/sale_orders', '/orders', '/opportunities', '/quotes']) {
      try {
        const r = await getfly.get(`/accounts/${id}${sub}`);
        const items = r?.data || (Array.isArray(r) ? r : []);
        console.log(`  ✓ /accounts/${id}${sub} -> ${items.length} items`);
        if (items[0]) console.log(`    sample: ${JSON.stringify(items[0]).slice(0,200)}`);
      } catch (e) {
        const m = e.message.slice(0, 80);
        if (!m.includes('404')) console.log(`  ? /accounts/${id}${sub}: ${m}`);
      }
    }
  }
};

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
