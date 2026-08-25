import { q } from "./db";

// Toutes les requêtes acceptent une fenêtre de dates [from, to] (format YYYY-MM-DD).
// Pas de cache ici : le sélecteur de dates change souvent, on lit en direct.

type Range = { from: string; to: string };

// ---------- VUE D'ENSEMBLE ----------
export async function getOverview({ from, to }: Range) {
  const [row] = await q(
    `SELECT
       COALESCE(SUM(o.ca_ht),0)                                   AS ca_ht,
       COUNT(o.order_id)                                          AS orders,
       COUNT(o.order_id) FILTER (WHERE o.is_new_customer)         AS new_orders,
       COALESCE(AVG(o.ca_ht),0)                                   AS aov_ht
     FROM fct_orders o
     WHERE o.date_key BETWEEN $1 AND $2`,
    [from, to]
  );
  const [meta] = await q(
    `SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(purchase_value),0) pv,
            COALESCE(SUM(purchases),0) conv
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2`,
    [from, to]
  );
  const [klav] = await q(
    `SELECT COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE metric='Placed Order' AND date_key BETWEEN $1 AND $2`,
    [from, to]
  );
  const caHt = Number(row.ca_ht);
  const spend = Number(meta.spend);
  const newOrders = Number(row.new_orders);
  return {
    ca_ht: caHt,
    orders: Number(row.orders),
    new_orders: newOrders,
    pct_new: row.orders > 0 ? +(100 * newOrders / row.orders).toFixed(1) : 0,
    aov_ht: Number(row.aov_ht),
    meta_spend: spend,
    meta_attributed_ca: Number(meta.pv),
    meta_roas: spend > 0 ? +(Number(meta.pv) / spend).toFixed(2) : null,
    klaviyo_ca: Number(klav.rev),
    mer: spend > 0 ? +(caHt / spend).toFixed(2) : null,            // CA total / dépenses ads
    cac: newOrders > 0 ? +(spend / newOrders).toFixed(2) : null,   // dépenses / nouveaux clients
  };
}

// Série quotidienne pour le graphe principal
export async function getDailySeries({ from, to }: Range) {
  return q(
    `SELECT d.date_key,
       COALESCE(o.ca_ht,0) ca_ht,
       COALESCE(m.spend,0)  meta_spend,
       COALESCE(m.pv,0)     meta_ca
     FROM (SELECT generate_series($1::date,$2::date,'1 day')::date date_key) d
     LEFT JOIN (SELECT date_key, SUM(ca_ht) ca_ht FROM fct_orders
                WHERE date_key BETWEEN $1 AND $2 GROUP BY date_key) o USING (date_key)
     LEFT JOIN (SELECT date_key, SUM(spend) spend, SUM(purchase_value) pv FROM fct_ad_spend
                WHERE date_key BETWEEN $1 AND $2 GROUP BY date_key) m USING (date_key)
     ORDER BY d.date_key`,
    [from, to]
  );
}

// ---------- E-COMMERCE ----------
export async function getEcommerce({ from, to }: Range) {
  const topByCa = await q(
    `SELECT p.title, p.categorie, SUM(l.line_ca_ht) ca_ht, SUM(l.qty) units
     FROM fct_order_lines l JOIN fct_orders o ON o.order_id=l.order_id
     LEFT JOIN dim_product p ON p.product_id=l.product_id
     WHERE o.date_key BETWEEN $1 AND $2
     GROUP BY p.title,p.categorie ORDER BY ca_ht DESC LIMIT 10`,
    [from, to]
  );
  const topByUnits = await q(
    `SELECT p.title, SUM(l.qty) units, SUM(l.line_ca_ht) ca_ht
     FROM fct_order_lines l JOIN fct_orders o ON o.order_id=l.order_id
     LEFT JOIN dim_product p ON p.product_id=l.product_id
     WHERE o.date_key BETWEEN $1 AND $2
     GROUP BY p.title ORDER BY units DESC LIMIT 10`,
    [from, to]
  );
  const byCategory = await q(
    `SELECT COALESCE(p.categorie,'(non classé)') categorie, SUM(l.line_ca_ht) ca_ht
     FROM fct_order_lines l JOIN fct_orders o ON o.order_id=l.order_id
     LEFT JOIN dim_product p ON p.product_id=l.product_id
     WHERE o.date_key BETWEEN $1 AND $2
     GROUP BY p.categorie ORDER BY ca_ht DESC`,
    [from, to]
  );
  const bySource = await q(
    `SELECT COALESCE(NULLIF(utm_source,''),'(non attribué)') source,
            SUM(ca_ht) ca_ht, COUNT(*) orders, AVG(ca_ht) aov
     FROM fct_orders WHERE date_key BETWEEN $1 AND $2
     GROUP BY 1 ORDER BY ca_ht DESC`,
    [from, to]
  );
  const [clients] = await q(
    `SELECT
       COUNT(*) FILTER (WHERE is_new_customer) new_orders,
       COUNT(*) FILTER (WHERE NOT is_new_customer) returning_orders,
       COUNT(*) total,
       COALESCE(SUM(discount_ht),0) discounts,
       COALESCE(SUM(ca_ht),0) ca
     FROM fct_orders WHERE date_key BETWEEN $1 AND $2`,
    [from, to]
  );
  return { topByCa, topByUnits, byCategory, bySource, clients };
}

// ---------- META ADS ----------
export async function getMeta({ from, to }: Range) {
  const [tot] = await q(
    `SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions,
            COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(purchases),0) purchases,
            COALESCE(SUM(purchase_value),0) pv
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2`,
    [from, to]
  );
  const byCampaign = await q(
    `SELECT campaign_name, SUM(spend) spend, SUM(purchase_value) pv,
            SUM(purchases) purchases, SUM(impressions) impressions, SUM(clicks) clicks
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2
     GROUP BY campaign_name ORDER BY spend DESC LIMIT 20`,
    [from, to]
  );
  const byAd = await q(
    `SELECT ad_name, campaign_name, SUM(spend) spend, SUM(purchase_value) pv,
            SUM(purchases) purchases, SUM(impressions) impressions, SUM(clicks) clicks
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2
     GROUP BY ad_name,campaign_name ORDER BY spend DESC LIMIT 20`,
    [from, to]
  );
  const s = Number(tot.spend), imp = Number(tot.impressions), clk = Number(tot.clicks), cv = Number(tot.purchases);
  return {
    totals: {
      spend: s, impressions: imp, clicks: clk, purchases: cv, pv: Number(tot.pv),
      roas: s > 0 ? +(Number(tot.pv) / s).toFixed(2) : null,
      cpa: cv > 0 ? +(s / cv).toFixed(2) : null,
      cpm: imp > 0 ? +(s / imp * 1000).toFixed(2) : null,
      ctr: imp > 0 ? +(100 * clk / imp).toFixed(2) : null,
      cpc: clk > 0 ? +(s / clk).toFixed(2) : null,
    },
    byCampaign, byAd,
  };
}

// ---------- KLAVIYO / CRM ----------
export async function getKlaviyo({ from, to }: Range) {
  const byMetric = await q(
    `SELECT metric, COUNT(*) n, COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE date_key BETWEEN $1 AND $2
     GROUP BY metric ORDER BY n DESC`,
    [from, to]
  );
  const byFlow = await q(
    `SELECT COALESCE(flow_name,'(campagne)') flow_name,
            COUNT(*) FILTER (WHERE metric='Placed Order') orders,
            COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE date_key BETWEEN $1 AND $2
     GROUP BY flow_name ORDER BY rev DESC LIMIT 15`,
    [from, to]
  );
  const get = (m: string) => Number(byMetric.find((r: any) => r.metric === m)?.n ?? 0);
  const received = get("Received Email");
  const opened = get("Opened Email");
  const clicked = get("Clicked Email");
  const placed = get("Placed Order");
  const rev = byMetric.reduce((s: number, r: any) => s + Number(r.rev), 0);
  return {
    totals: {
      received, opened, clicked, placed, revenue: rev,
      or: received > 0 ? +(100 * opened / received).toFixed(1) : null,
      ctr: received > 0 ? +(100 * clicked / received).toFixed(1) : null,
      ctor: opened > 0 ? +(100 * clicked / opened).toFixed(1) : null,
      rpe: received > 0 ? +(rev / received).toFixed(2) : null,
    },
    byMetric, byFlow,
  };
}
