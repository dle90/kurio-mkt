import { meta } from '../client.js';

const DATE_PRESET = process.env.DATE_PRESET || 'last_30d';

const TARGETS = [
  { id: 'act_1071893357737329', name: 'Kurio 2' },
  { id: 'act_930175825635997', name: 'Kurio 3' },
];

function actionValue(actions, type) {
  const a = (actions || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}

async function fetchAccount(account) {
  const campaigns = await meta.getAll(`/${account.id}/campaigns`, {
    fields: 'id,name,objective,effective_status',
    limit: 200,
  });
  const objByCampaign = Object.fromEntries(campaigns.map(c => [c.id, c]));

  const insights = await meta.getAll(`/${account.id}/insights`, {
    level: 'campaign',
    date_preset: DATE_PRESET,
    fields: 'campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,frequency,reach,actions',
    limit: 200,
  });

  return insights.map(row => {
    const camp = objByCampaign[row.campaign_id] || {};
    const spend = Number(row.spend) || 0;
    const linkClicks = actionValue(row.actions, 'link_click');
    const lpv = actionValue(row.actions, 'landing_page_view');
    const formLeads = actionValue(row.actions, 'onsite_conversion.lead_grouped');
    const pixelLeads = actionValue(row.actions, 'offsite_conversion.fb_pixel_lead');
    const leads = formLeads + pixelLeads;
    const registrations = actionValue(row.actions, 'complete_registration');
    const viewContent = actionValue(row.actions, 'view_content');
    const messaging = actionValue(row.actions, 'onsite_conversion.messaging_conversation_started_7d');
    const videoView = actionValue(row.actions, 'video_view');
    const postEng = actionValue(row.actions, 'post_engagement');
    return {
      account: account.name,
      campaign: row.campaign_name,
      campaign_id: row.campaign_id,
      objective: (camp.objective || '').replace('OUTCOME_', ''),
      status: camp.effective_status || '',
      spend,
      impressions: Number(row.impressions) || 0,
      reach: Number(row.reach) || 0,
      ctr: Number(row.ctr) || 0,
      cpm: Number(row.cpm) || 0,
      cpc: Number(row.cpc) || 0,
      freq: Number(row.frequency) || 0,
      link_clicks: linkClicks,
      lpv,
      lpv_rate: linkClicks > 0 ? (lpv / linkClicks) * 100 : 0,
      cplpv: lpv > 0 ? spend / lpv : null,
      leads,
      cpl: leads > 0 ? spend / leads : null,
      registrations,
      cpr: registrations > 0 ? spend / registrations : null,
      view_content: viewContent,
      messaging,
      video_view: videoView,
      post_engagement: postEng,
    };
  });
}

const all = [];
for (const t of TARGETS) {
  console.log(`Pulling ${DATE_PRESET} from ${t.name} (${t.id})...`);
  const rows = await fetchAccount(t);
  console.log(`  ${rows.length} campaigns with insight rows`);
  all.push(...rows);
}

const totals = {
  campaigns: all.length,
  spend: all.reduce((s, r) => s + r.spend, 0),
  impressions: all.reduce((s, r) => s + r.impressions, 0),
  link_clicks: all.reduce((s, r) => s + r.link_clicks, 0),
  lpv: all.reduce((s, r) => s + r.lpv, 0),
  leads: all.reduce((s, r) => s + r.leads, 0),
  registrations: all.reduce((s, r) => s + r.registrations, 0),
  view_content: all.reduce((s, r) => s + r.view_content, 0),
  messaging: all.reduce((s, r) => s + r.messaging, 0),
};

console.log(`\n=== Account totals (${DATE_PRESET}, VND) ===\n`);
console.table([{
  campaigns: totals.campaigns,
  spend: totals.spend.toLocaleString(),
  impressions: totals.impressions.toLocaleString(),
  link_clicks: totals.link_clicks.toLocaleString(),
  landing_page_views: totals.lpv.toLocaleString(),
  leads: totals.leads,
  registrations: totals.registrations,
  view_content: totals.view_content.toLocaleString(),
  msg_conversations: totals.messaging,
}]);

const fmt = n => (n == null ? '-' : Math.round(n).toLocaleString());

console.log('\n=== By objective ===\n');
const byObj = {};
for (const r of all) {
  const o = r.objective || '(unknown)';
  byObj[o] = byObj[o] || { campaigns: 0, spend: 0, link_clicks: 0, lpv: 0, leads: 0, registrations: 0 };
  byObj[o].campaigns += 1;
  byObj[o].spend += r.spend;
  byObj[o].link_clicks += r.link_clicks;
  byObj[o].lpv += r.lpv;
  byObj[o].leads += r.leads;
  byObj[o].registrations += r.registrations;
}
console.table(Object.entries(byObj).map(([objective, v]) => ({
  objective,
  campaigns: v.campaigns,
  spend: fmt(v.spend),
  link_clicks: v.link_clicks.toLocaleString(),
  lpv: v.lpv.toLocaleString(),
  leads: v.leads,
  registrations: v.registrations,
  cplpv: v.lpv > 0 ? fmt(v.spend / v.lpv) : '-',
  cpr: v.registrations > 0 ? fmt(v.spend / v.registrations) : '-',
  cpl: v.leads > 0 ? fmt(v.spend / v.leads) : '-',
})));

const active = all.filter(r => r.status === 'ACTIVE').sort((a, b) => b.spend - a.spend);
console.log(`\n=== ${active.length} ACTIVE campaigns, sorted by spend ===\n`);
console.table(active.map(r => ({
  acct: r.account,
  campaign: (r.campaign || '').slice(0, 40),
  obj: r.objective,
  spend: fmt(r.spend),
  imp: r.impressions.toLocaleString(),
  ctr: r.ctr.toFixed(2),
  link_clk: r.link_clicks,
  lpv: r.lpv,
  lpv_rate: r.lpv_rate.toFixed(0) + '%',
  cplpv: fmt(r.cplpv),
  reg: r.registrations,
  cpr: fmt(r.cpr),
  leads: r.leads,
  cpl: fmt(r.cpl),
})));
