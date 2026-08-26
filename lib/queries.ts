import { q } from "./db";

type Range = { from: string; to: string };

// Décale une plage de N jours (négatif = vers le passé)
function shift(from: string, to: string, days: number): Range {
  const f = new Date(from + "T00:00:00Z"); f.setUTCDate(f.getUTCDate() + days);
  const t = new Date(to + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + days);
  return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) };
}
function daysBetween(from: string, to: string) {
  return Math.round((+new Date(to) - +new Date(from)) / 864e5) + 1;
}
function variation(cur: number, prev: number): number | null {
  if (!prev) return null;
  return +(((cur - prev) / prev) * 100).toFixed(1);
}

async function overviewRaw({ from, to }: Range) {
  const [row] = await q(
    `SELECT COALESCE(SUM(total_sales),0) ca, COALESCE(SUM(orders),0) orders,
            COALESCE(SUM(sessions),0) sessions,
            CASE WHEN SUM(orders)>0 THEN SUM(total_sales)/SUM(orders) END aov,
            CASE WHEN SUM(sessions)>0 THEN 100.0*SUM(orders)/SUM(sessions) END cvr
     FROM agg_daily WHERE date_key BETWEEN $1 AND $2`, [from, to]);
  return {
    ca: Number(row.ca), orders: Number(row.orders), sessions: Number(row.sessions),
    aov: row.aov ? Number(row.aov) : 0, cvr: row.cvr ? Number(row.cvr) : 0,
  };
}

// ---------- VUE D'ENSEMBLE (agrégats + comparaisons) ----------
export async function getOverview({ from, to }: Range) {
  const n = daysBetween(from, to);
  const prevR = shift(from, to, -n);        // période juste avant, même durée
  const yoyR = shift(from, to, -365);       // même période l'an dernier

  const [cur, prev, yoy, meta, klav] = await Promise.all([
    overviewRaw({ from, to }),
    overviewRaw(prevR),
    overviewRaw(yoyR),
    q(`SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(purchase_value),0) pv
       FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2`, [from, to]),
    q(`SELECT COALESCE(SUM(revenue_ht),0) rev FROM fct_email_events
       WHERE metric='Placed Order' AND date_key BETWEEN $1 AND $2`, [from, to]),
  ]);
  const spend = Number(meta[0].spend);
  const cmp = (k: keyof typeof cur) => ({
    vs_prev: variation(cur[k], prev[k]),
    vs_yoy: variation(cur[k], yoy[k]),
  });
  return {
    ca_ht: cur.ca, orders: cur.orders, sessions: cur.sessions,
    aov_ht: cur.aov || null, cvr: cur.cvr ? +cur.cvr.toFixed(2) : null,
    meta_spend: spend, meta_attributed_ca: Number(meta[0].pv),
    meta_roas: spend > 0 ? +(Number(meta[0].pv)/spend).toFixed(2) : null,
    klaviyo_ca: Number(klav[0].rev),
    mer: spend > 0 ? +(cur.ca/spend).toFixed(2) : null,
    cmp: { ca: cmp("ca"), orders: cmp("orders"), sessions: cmp("sessions"), aov: cmp("aov"), cvr: cmp("cvr") },
  };
}

export async function getDailySeries({ from, to }: Range) {
  return q(
    `SELECT date_key, total_sales ca_ht, sessions, orders, conversion_rate
     FROM agg_daily WHERE date_key BETWEEN $1 AND $2 ORDER BY date_key`, [from, to]);
}

// ---------- E-COMMERCE ----------
export async function getEcommerce({ from, to }: Range) {
  const [tot] = await q(
    `SELECT COALESCE(SUM(total_sales),0) ca, COALESCE(SUM(net_sales),0) net,
            COALESCE(SUM(orders),0) orders, COALESCE(SUM(discounts),0) discounts,
            COALESCE(SUM(returns),0) returns, COALESCE(SUM(sessions),0) sessions,
            CASE WHEN SUM(sessions)>0 THEN 100.0*SUM(orders)/SUM(sessions) END cvr
     FROM agg_daily WHERE date_key BETWEEN $1 AND $2`, [from, to]);
  const topByCa = await q(
    `SELECT product_title title, SUM(net_sales) ca_ht, SUM(units) units
     FROM agg_product_day WHERE date_key BETWEEN $1 AND $2
     GROUP BY product_title ORDER BY ca_ht DESC LIMIT 40`, [from, to]);
  const topByUnits = await q(
    `SELECT product_title title, SUM(units) units, SUM(net_sales) ca_ht
     FROM agg_product_day WHERE date_key BETWEEN $1 AND $2
     GROUP BY product_title ORDER BY units DESC LIMIT 40`, [from, to]);
  const byCategory = await q(
    `SELECT product_type categorie, SUM(net_sales) ca_ht
     FROM agg_category_day WHERE date_key BETWEEN $1 AND $2
     GROUP BY product_type ORDER BY ca_ht DESC`, [from, to]);
  return { totals: tot, topByCa, topByUnits, byCategory };
}

// ---------- META ----------
export async function getMeta({ from, to }: Range) {
  const [tot] = await q(
    `SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions,
            COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(purchases),0) purchases,
            COALESCE(SUM(purchase_value),0) pv
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2`, [from, to]);
  const byCampaign = await q(
    `SELECT campaign_name, SUM(spend) spend, SUM(purchase_value) pv, SUM(purchases) purchases,
            SUM(impressions) impressions, SUM(clicks) clicks
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2
     GROUP BY campaign_name ORDER BY spend DESC LIMIT 20`, [from, to]);
  const byAd = await q(
    `SELECT ad_name, campaign_name, SUM(spend) spend, SUM(purchase_value) pv, SUM(purchases) purchases,
            SUM(impressions) impressions, SUM(clicks) clicks
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2
     GROUP BY ad_name,campaign_name ORDER BY spend DESC LIMIT 20`, [from, to]);
  const s = Number(tot.spend), imp = Number(tot.impressions), clk = Number(tot.clicks), cv = Number(tot.purchases);
  return {
    totals: { spend: s, impressions: imp, clicks: clk, purchases: cv, pv: Number(tot.pv),
      roas: s>0 ? +(Number(tot.pv)/s).toFixed(2) : null, cpa: cv>0 ? +(s/cv).toFixed(2) : null,
      cpm: imp>0 ? +(s/imp*1000).toFixed(2) : null, ctr: imp>0 ? +(100*clk/imp).toFixed(2) : null,
      cpc: clk>0 ? +(s/clk).toFixed(2) : null },
    byCampaign, byAd,
  };
}

// ---------- KLAVIYO ----------
export async function getKlaviyo({ from, to }: Range) {
  const byMetric = await q(
    `SELECT metric, COUNT(*) n, COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE date_key BETWEEN $1 AND $2 GROUP BY metric ORDER BY n DESC`, [from, to]);
  const byFlow = await q(
    `SELECT COALESCE(flow_name,'(campagne)') flow_name,
            COUNT(*) FILTER (WHERE metric='Placed Order') orders, COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE date_key BETWEEN $1 AND $2
     GROUP BY flow_name ORDER BY rev DESC LIMIT 15`, [from, to]);
  const get = (m: string) => Number(byMetric.find((r: any) => r.metric === m)?.n ?? 0);
  const received = get("Received Email"), opened = get("Opened Email"),
        clicked = get("Clicked Email"), placed = get("Placed Order");
  const rev = byMetric.reduce((s: number, r: any) => s + Number(r.rev), 0);
  return {
    totals: { received, opened, clicked, placed, revenue: rev,
      or: received>0 ? +(100*opened/received).toFixed(1) : null,
      ctr: received>0 ? +(100*clicked/received).toFixed(1) : null,
      ctor: opened>0 ? +(100*clicked/opened).toFixed(1) : null,
      rpe: received>0 ? +(rev/received).toFixed(2) : null },
    byMetric, byFlow,
  };
}
