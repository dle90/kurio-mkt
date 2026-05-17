// Render the ROAS data as a single self-contained HTML report.
// Output: out/roas_report.html — open in any browser, no server needed.
import fs from 'node:fs';

const fmtVnd = n => n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US');
const fmtPct = n => n == null || !isFinite(n) ? '—' : (n * 100).toFixed(1) + '%';
const fmtRoas = n => n == null || !isFinite(n) ? '—' : n.toFixed(2);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function roasClass(r) {
  if (r == null || !isFinite(r)) return 'roas-na';
  if (r >= 1.5) return 'roas-great';
  if (r >= 1.0) return 'roas-good';
  if (r >= 0.5) return 'roas-meh';
  return 'roas-bad';
}

export function renderHtml({ totals, codeRows, lpRows, asOf }) {
  const minSpend = 1_000_000;
  const minLeads = 5;
  const filtered = codeRows.filter(r => r.spend >= minSpend && r.leads >= minLeads && r.roas != null);

  const topRoas = [...filtered].sort((a, b) => b.roas - a.roas).slice(0, 15);
  const bottomRoas = [...filtered].sort((a, b) => a.roas - b.roas).slice(0, 15);
  const zeroConv = codeRows.filter(r => r.spend >= 1_000_000 && r.paidPhones === 0 && r.leads > 0)
    .sort((a, b) => b.spend - a.spend);
  const nonCodeSpend = codeRows.filter(r => r.spend >= 5_000_000 && r.leads === 0)
    .sort((a, b) => b.spend - a.spend);
  const allByspend = [...codeRows].sort((a, b) => b.spend - a.spend);

  const renderTable = (rows, cols, opts = {}) => {
    const id = opts.id || 'tbl-' + Math.random().toString(36).slice(2, 8);
    const headerCells = cols.map((c, i) => `<th data-col="${i}" data-type="${c.type || 'text'}">${esc(c.label)}</th>`).join('');
    const bodyRows = rows.map(r => `<tr>${cols.map(c => `<td class="${c.cls?.(r) || ''}">${c.render(r)}</td>`).join('')}</tr>`).join('');
    return `<div class="table-wrap"><table id="${id}" class="data"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
  };

  const codeCols = [
    { label: 'Code', render: r => `<span class="code">${esc(r.key)}</span>` },
    { label: 'Spend', type: 'num', render: r => fmtVnd(r.spend), cls: () => 'num' },
    { label: 'Leads', type: 'num', render: r => r.leads.toLocaleString(), cls: () => 'num' },
    { label: 'Paid', type: 'num', render: r => r.paidPhones, cls: () => 'num' },
    { label: 'Revenue', type: 'num', render: r => fmtVnd(r.revenue), cls: () => 'num' },
    { label: 'CPL', type: 'num', render: r => fmtVnd(r.cpl), cls: () => 'num' },
    { label: 'CPS', type: 'num', render: r => fmtVnd(r.cps), cls: () => 'num' },
    { label: 'Conv%', type: 'num', render: r => fmtPct(r.convRate), cls: () => 'num' },
    { label: 'ROAS', type: 'num', render: r => fmtRoas(r.roas), cls: r => 'num ' + roasClass(r.roas) },
  ];

  const lpCols = [
    { label: 'Landing page', render: r => `<span class="code">${esc(r.key)}</span>` },
    { label: 'Leads', type: 'num', render: r => r.leads.toLocaleString(), cls: () => 'num' },
    { label: 'Paid', type: 'num', render: r => r.paidPhones, cls: () => 'num' },
    { label: 'Revenue', type: 'num', render: r => fmtVnd(r.revenue), cls: () => 'num' },
    { label: 'Conv%', type: 'num', render: r => fmtPct(r.convRate), cls: () => 'num' },
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kurio Meta Ads — ROAS by code, 2026 YTD</title>
<style>
:root {
  --bg: #f7f7f5;
  --panel: #fff;
  --ink: #1a1a1a;
  --muted: #6e6e6e;
  --border: #e4e4e0;
  --accent: #1f5fff;
  --roas-great: #1f6e1f;
  --roas-good: #2c8c2c;
  --roas-meh: #9b6b00;
  --roas-bad: #b23a3a;
  --roas-na: #999;
}
@media (prefers-color-scheme: dark) {
  :root { --bg:#0f1115; --panel:#1a1d23; --ink:#e8e8e8; --muted:#999; --border:#2c2f36; }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
}
header {
  padding: 32px 40px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
h1 { margin: 0 0 4px; font-size: 24px; letter-spacing: -0.02em; }
.subtitle { color: var(--muted); font-size: 14px; }
main { padding: 24px 40px 80px; max-width: 1400px; }
section { margin-bottom: 40px; }
h2 { font-size: 18px; margin: 0 0 14px; letter-spacing: -0.01em; }
h2 .qual { font-weight: 400; color: var(--muted); font-size: 14px; margin-left: 8px; }
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}
.kpi {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 18px;
}
.kpi-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
.kpi-value { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
.kpi-sub { font-size: 12px; color: var(--muted); margin-top: 4px; }
.kpi.highlight .kpi-value { color: var(--accent); }
.kpi.warn .kpi-value { color: var(--roas-bad); }

.attrib-bar {
  height: 28px;
  display: flex;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
  margin: 8px 0 6px;
}
.attrib-bar > div { display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: 500; }
.attrib-bar .code-attr { background: #2c6ecf; }
.attrib-bar .lp-attr   { background: #6a9cd4; }
.attrib-bar .unattr    { background: #b8b8b8; }
.attrib-legend { display: flex; gap: 16px; font-size: 13px; color: var(--muted); }
.attrib-legend span:before { content: ''; display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
.attrib-legend .code-attr:before { background: #2c6ecf; }
.attrib-legend .lp-attr:before { background: #6a9cd4; }
.attrib-legend .unattr:before { background: #b8b8b8; }

.table-wrap {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: auto;
  max-height: 600px;
}
table.data {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}
table.data th {
  text-align: left;
  padding: 12px 14px;
  font-weight: 600;
  border-bottom: 2px solid var(--border);
  cursor: pointer;
  user-select: none;
  position: sticky;
  top: 0;
  background: var(--panel);
  z-index: 1;
}
table.data th[data-type="num"] { text-align: right; }
table.data th:hover { background: color-mix(in srgb, var(--accent) 8%, var(--panel)); }
table.data th.sort-asc::after  { content: ' ↑'; color: var(--accent); }
table.data th.sort-desc::after { content: ' ↓'; color: var(--accent); }
table.data td {
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
table.data td.num { text-align: right; font-feature-settings: "tnum"; }
table.data tr:hover td { background: color-mix(in srgb, var(--accent) 4%, transparent); }
table.data tr:last-child td { border-bottom: none; }

.code { font-family: "SF Mono", "JetBrains Mono", Menlo, monospace; font-size: 13px; }
.roas-great { color: var(--roas-great); font-weight: 600; }
.roas-good  { color: var(--roas-good); font-weight: 600; }
.roas-meh   { color: var(--roas-meh); }
.roas-bad   { color: var(--roas-bad); font-weight: 600; }
.roas-na    { color: var(--roas-na); }

.callout {
  background: color-mix(in srgb, var(--accent) 6%, var(--panel));
  border-left: 3px solid var(--accent);
  padding: 14px 18px;
  border-radius: 6px;
  margin-bottom: 16px;
}
.callout.warn { background: color-mix(in srgb, var(--roas-bad) 6%, var(--panel)); border-left-color: var(--roas-bad); }
.callout strong { font-weight: 600; }

footer { padding: 32px 40px; border-top: 1px solid var(--border); color: var(--muted); font-size: 13px; }
footer p { margin: 0 0 8px; }
footer code { background: var(--panel); padding: 2px 6px; border-radius: 3px; font-size: 12px; }
</style>
</head>
<body>

<header>
  <h1>Kurio Meta Ads — ROAS by campaign code</h1>
  <div class="subtitle">2026 YTD · as of ${asOf} · Kurio 2 + Kurio 3 ad accounts</div>
</header>

<main>

<section>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Spend</div><div class="kpi-value">${fmtVnd(totals.spend)} <span style="font-size:14px;color:var(--muted)">VND</span></div></div>
    <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-value">${fmtVnd(totals.universeRevenue)} <span style="font-size:14px;color:var(--muted)">VND</span></div></div>
    <div class="kpi highlight"><div class="kpi-label">Blended ROAS</div><div class="kpi-value">${fmtRoas(totals.universeRevenue / totals.spend)}×</div></div>
    <div class="kpi"><div class="kpi-label">Paying customers</div><div class="kpi-value">${totals.payingCustomers.toLocaleString()}</div></div>
    <div class="kpi"><div class="kpi-label">Total leads</div><div class="kpi-value">${totals.totalLeads.toLocaleString()}</div><div class="kpi-sub">Sheet rows YTD</div></div>
    <div class="kpi"><div class="kpi-label">Blended CPL</div><div class="kpi-value">${fmtVnd(totals.spend / totals.totalLeads)}</div><div class="kpi-sub">cost per lead</div></div>
    <div class="kpi"><div class="kpi-label">Blended CPS</div><div class="kpi-value">${fmtVnd(totals.spend / totals.payingCustomers)}</div><div class="kpi-sub">cost per sale</div></div>
  </div>
</section>

<section>
  <h2>Attribution coverage <span class="qual">how much revenue we can trace to a campaign</span></h2>
  <div class="attrib-bar">
    <div class="code-attr" style="flex:${totals.codeAttrib.revenue}">${(totals.codeAttrib.revenue / totals.universeRevenue * 100).toFixed(0)}% code</div>
    <div class="lp-attr"   style="flex:${totals.lpAttrib.revenue}">${(totals.lpAttrib.revenue / totals.universeRevenue * 100).toFixed(0)}% LP-only</div>
    <div class="unattr"    style="flex:${totals.universeRevenue - totals.codeAttrib.revenue - totals.lpAttrib.revenue}">${((totals.universeRevenue - totals.codeAttrib.revenue - totals.lpAttrib.revenue) / totals.universeRevenue * 100).toFixed(0)}% unattributable</div>
  </div>
  <div class="attrib-legend">
    <span class="code-attr">Code-level: ${totals.codeAttrib.paid} paid · ${fmtVnd(totals.codeAttrib.revenue)} VND</span>
    <span class="lp-attr">LP fallback: ${totals.lpAttrib.paid} paid · ${fmtVnd(totals.lpAttrib.revenue)} VND</span>
    <span class="unattr">Not in sheet: ${totals.payingCustomers - totals.codeAttrib.paid - totals.lpAttrib.paid} paid · ${fmtVnd(totals.universeRevenue - totals.codeAttrib.revenue - totals.lpAttrib.revenue)} VND</span>
  </div>
</section>

<section>
  <h2>Scale up <span class="qual">top ROAS (min 1M spend, 5+ leads)</span></h2>
  ${renderTable(topRoas, codeCols, { id: 'tbl-top' })}
</section>

<section>
  <h2>Money-burners — pause immediately <span class="qual">spent ≥1M VND, zero conversions</span></h2>
  ${zeroConv.length ? `<div class="callout warn"><strong>${zeroConv.length} codes burned ${fmtVnd(zeroConv.reduce((s, r) => s + r.spend, 0))} VND</strong> with zero paying customers. Cutting these recovers the spend without losing revenue.</div>` : ''}
  ${renderTable(zeroConv, codeCols, { id: 'tbl-zero' })}
</section>

<section>
  <h2>Investigate — high-spend ads with no tracked leads <span class="qual">Vietnamese-named campaigns, ≥5M spend, 0 sheet leads</span></h2>
  <div class="callout"><strong>${fmtVnd(nonCodeSpend.reduce((s, r) => s + r.spend, 0))} VND</strong> across ${nonCodeSpend.length} campaigns named in Vietnamese (e.g. "quảng cáo doanh số mới") — these are engagement/sales-objective campaigns that don't drive form submissions with utm_content, so leads aren't tracked. May or may not be productive depending on goal.</div>
  ${renderTable(nonCodeSpend, codeCols, { id: 'tbl-noncode' })}
</section>

<section>
  <h2>Bottom 15 by ROAS <span class="qual">underperforming at scale (min 1M spend, 5+ leads)</span></h2>
  ${renderTable(bottomRoas, codeCols, { id: 'tbl-bottom' })}
</section>

<section>
  <h2>Landing page fallback <span class="qual">paying customers without a code, attributed by LP</span></h2>
  <div class="callout"><strong>toantuduy.kurio.vn/thao</strong> alone drove <strong>${fmtVnd(lpRows.find(r => r.key === 'toantuduy.kurio.vn/thao')?.revenue || 0)} VND</strong> revenue at 38.9% conversion — the highest-converting LP, but its URLs don't carry utm_content, so spend can't be attributed to specific creatives. Worth instrumenting.</div>
  ${renderTable(lpRows.filter(r => r.revenue > 0), lpCols, { id: 'tbl-lp' })}
</section>

<section>
  <h2>Full table — all codes <span class="qual">click any header to sort · ${codeRows.length} rows</span></h2>
  ${renderTable(allByspend, codeCols, { id: 'tbl-all' })}
</section>

</main>

<footer>
  <p><strong>Methodology.</strong> Spend pulled per ad via Meta Marketing API ${'`/insights?level=ad`'} for ${asOf.slice(0, 4)}-01-01 → ${asOf}. Leads pulled from the team's Google Sheet (column C = phone, column P = utm_content code, column K = landing URL). Revenue is each Getfly account's <code>total_revenue</code>. Spend joins to leads via lowercase match of Meta ad name ↔ sheet utm_content. Revenue joins via phone (Vietnamese 10-digit normalized).</p>
  <p><strong>Attribution model:</strong> first-touch per phone. The earliest sheet row for each phone owns its revenue. Code is preferred; LP path is the fallback.</p>
  <p><strong>Caveats.</strong> ${totals.payingCustomers - totals.codeAttrib.paid - totals.lpAttrib.paid} paying customers (${fmtPct((totals.payingCustomers - totals.codeAttrib.paid - totals.lpAttrib.paid) / totals.payingCustomers)} of total) aren't in the sheet — likely direct sales, IKMC organic, or repeat 2025 customers. Ad-level granularity is limited because one code (e.g. <code>code63</code>) often maps to many Meta ads; ROAS is at the creative-cluster level, not per-ad. Some codes in the sheet have no Meta ad of the same name (typos or retired); some Meta ads have no sheet leads (zero-attribution spend).</p>
</footer>

<script>
// Vanilla sortable tables
document.querySelectorAll('table.data').forEach(tbl => {
  tbl.querySelectorAll('th').forEach((th, idx) => {
    th.addEventListener('click', () => {
      const type = th.dataset.type || 'text';
      const desc = !th.classList.contains('sort-desc');
      tbl.querySelectorAll('th').forEach(o => o.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(desc ? 'sort-desc' : 'sort-asc');
      const rows = Array.from(tbl.tBodies[0].rows);
      const parse = v => {
        if (type === 'num') {
          const m = v.replace(/[,\\s\\u202f]/g, '').match(/-?\\d+\\.?\\d*/);
          return m ? parseFloat(m[0]) : (v.includes('—') ? -Infinity : NaN);
        }
        return v.toLowerCase();
      };
      rows.sort((a, b) => {
        const av = parse(a.cells[idx].innerText);
        const bv = parse(b.cells[idx].innerText);
        if (av < bv) return desc ? 1 : -1;
        if (av > bv) return desc ? -1 : 1;
        return 0;
      });
      const tbody = tbl.tBodies[0];
      rows.forEach(r => tbody.appendChild(r));
    });
  });
});
</script>

</body>
</html>`;
  return html;
}
