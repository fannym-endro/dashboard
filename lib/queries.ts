import { q } from "./db";

type Range = { from: string; to: string };

// ---------- VUE D'ENSEMBLE (agrégats) ----------
export async function getOverview({ from, to }: Range) {
  const [row] = await q(
    `SELECT COALESCE(SUM(total_sales),0) ca, COALESCE(SUM(orders),0) orders,
            COALESCE(SUM(sessions),0) sessions,
            CASE WHEN SUM(orders)>0 THEN SUM(total_sales)/SUM(orders) END aov,
            CASE WHEN SUM(sessions)>0 THEN 100.0*SUM(orders)/SUM(sessions) END cvr
     FROM agg_daily WHERE date_key BETWEEN $1 AND $2`, [from, to]);
  const [meta] = await q(
    `SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(purchase_value),0) pv
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2`, [from, to]);
  const [klav] = await q(
    `SELECT COALESCE(SUM(revenue_ht),0) rev FROM fct_email_events
     WHERE metric='Placed Order' AND date_key BETWEEN $1 AND $2`, [from, to]);
  const ca = Number(row.ca), spend = Number(meta.spend);
  return {
    ca_ht: ca, orders: Number(row.orders), sessions: Number(row.sessions),
    aov_ht: row.aov ? Number(row.aov) : null,
    cvr: row.cvr ? +Number(row.cvr).toFixed(2) : null,
    meta_spend: spend, meta_attributed_ca: Number(meta.pv),
    meta_roas: spend > 0 ? +(Number(meta.pv)/spend).toFixed(2) : null,
    klaviyo_ca: Number(klav.rev),
    mer: spend > 0 ? +(ca/spend).toFixed(2) : null,
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
