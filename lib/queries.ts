import { q } from "./db";

type Range = { from: string; to: string };

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
// Construit un objet cmp {vs_prev, vs_yoy} pour chaque clé d'un set de totaux
function makeCmp(cur: any, prev: any, yoy: any, keys: string[]) {
  const out: any = {};
  for (const k of keys) out[k] = { vs_prev: variation(cur[k], prev[k]), vs_yoy: variation(cur[k], yoy[k]) };
  return out;
}

// ---------- VUE D'ENSEMBLE ----------
async function overviewRaw({ from, to }: Range) {
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
  const ca = Number(row.ca), spend = Number(meta.spend), pv = Number(meta.pv);
  return {
    ca, orders: Number(row.orders), sessions: Number(row.sessions),
    aov: row.aov ? Number(row.aov) : 0, cvr: row.cvr ? Number(row.cvr) : 0,
    meta_spend: spend, meta_attributed_ca: pv,
    meta_roas: spend > 0 ? +(pv / spend).toFixed(2) : 0,
    klaviyo_ca: Number(klav.rev),
    mer: spend > 0 ? +(ca / spend).toFixed(2) : 0,
  };
}

export async function getOverview({ from, to }: Range) {
  const n = daysBetween(from, to);
  const [cur, prev, yoy] = await Promise.all([
    overviewRaw({ from, to }), overviewRaw(shift(from, to, -n)), overviewRaw(shift(from, to, -365)),
  ]);
  return {
    ca_ht: cur.ca, orders: cur.orders, sessions: cur.sessions,
    aov_ht: cur.aov || null, cvr: cur.cvr ? +cur.cvr.toFixed(2) : null,
    meta_spend: cur.meta_spend, meta_attributed_ca: cur.meta_attributed_ca,
    meta_roas: cur.meta_roas || null, klaviyo_ca: cur.klaviyo_ca, mer: cur.mer || null,
    cmp: makeCmp(cur, prev, yoy, ["ca", "orders", "sessions", "aov", "cvr", "meta_spend", "meta_attributed_ca", "meta_roas", "klaviyo_ca", "mer"]),
  };
}

export async function getDailySeries({ from, to }: Range) {
  return q(
    `SELECT date_key, total_sales ca_ht, sessions, orders, conversion_rate
     FROM agg_daily WHERE date_key BETWEEN $1 AND $2 ORDER BY date_key`, [from, to]);
}

// ---------- E-COMMERCE ----------
async function ecomRaw({ from, to }: Range) {
  const [t] = await q(
    `SELECT COALESCE(SUM(total_sales),0) ca, COALESCE(SUM(net_sales),0) net,
            COALESCE(SUM(orders),0) orders, COALESCE(SUM(discounts),0) discounts,
            COALESCE(SUM(returns),0) returns, COALESCE(SUM(sessions),0) sessions,
            CASE WHEN SUM(sessions)>0 THEN 100.0*SUM(orders)/SUM(sessions) END cvr,
            CASE WHEN SUM(orders)>0 THEN SUM(total_sales)/SUM(orders) END aov
     FROM agg_daily WHERE date_key BETWEEN $1 AND $2`, [from, to]);
  return { ca: Number(t.ca), net: Number(t.net), orders: Number(t.orders),
    discounts: Number(t.discounts), returns: Number(t.returns), sessions: Number(t.sessions),
    cvr: t.cvr ? Number(t.cvr) : 0, aov: t.aov ? Number(t.aov) : 0 };
}

export async function getEcommerce({ from, to }: Range) {
  const n = daysBetween(from, to);
  const [tot, prev, yoy] = await Promise.all([
    ecomRaw({ from, to }), ecomRaw(shift(from, to, -n)), ecomRaw(shift(from, to, -365)),
  ]);
  const topByCa = await q(
    `SELECT product_title title, SUM(net_sales) ca_ht, SUM(units) units
     FROM agg_product_day WHERE date_key BETWEEN $1 AND $2
     GROUP BY product_title ORDER BY ca_ht DESC LIMIT 100`, [from, to]);
  const topByUnits = await q(
    `SELECT product_title title, SUM(units) units, SUM(net_sales) ca_ht
     FROM agg_product_day WHERE date_key BETWEEN $1 AND $2
     GROUP BY product_title ORDER BY units DESC LIMIT 100`, [from, to]);
  const byCategory = await q(
    `SELECT product_type categorie, SUM(net_sales) ca_ht
     FROM agg_category_day WHERE date_key BETWEEN $1 AND $2
     GROUP BY product_type ORDER BY ca_ht DESC`, [from, to]);
  return { totals: tot, topByCa, topByUnits, byCategory,
    cmp: makeCmp(tot, prev, yoy, ["ca", "net", "orders", "sessions", "cvr", "discounts", "returns"]) };
}

// ---------- META ----------
async function metaRaw({ from, to }: Range) {
  const [t] = await q(
    `SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions,
            COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(purchases),0) purchases,
            COALESCE(SUM(purchase_value),0) pv
     FROM fct_ad_spend WHERE date_key BETWEEN $1 AND $2`, [from, to]);
  const s = Number(t.spend), imp = Number(t.impressions), clk = Number(t.clicks), cv = Number(t.purchases), pv = Number(t.pv);
  return { spend: s, impressions: imp, clicks: clk, purchases: cv, pv,
    roas: s > 0 ? +(pv / s).toFixed(2) : 0, cpa: cv > 0 ? +(s / cv).toFixed(2) : 0,
    cpm: imp > 0 ? +(s / imp * 1000).toFixed(2) : 0, ctr: imp > 0 ? +(100 * clk / imp).toFixed(2) : 0,
    cpc: clk > 0 ? +(s / clk).toFixed(2) : 0 };
}

export async function getMeta({ from, to }: Range) {
  const n = daysBetween(from, to);
  const [tot, prev, yoy] = await Promise.all([
    metaRaw({ from, to }), metaRaw(shift(from, to, -n)), metaRaw(shift(from, to, -365)),
  ]);
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
  return { totals: { ...tot, roas: tot.roas || null, cpa: tot.cpa || null, cpm: tot.cpm || null, ctr: tot.ctr || null, cpc: tot.cpc || null },
    byCampaign, byAd,
    cmp: makeCmp(tot, prev, yoy, ["spend", "pv", "purchases", "roas", "cpa", "cpm", "ctr", "cpc"]) };
}

// ---------- KLAVIYO ----------
async function klavRaw({ from, to }: Range) {
  const rows = await q(
    `SELECT metric, COUNT(*) n, COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE date_key BETWEEN $1 AND $2 GROUP BY metric`, [from, to]);
  const get = (m: string) => Number(rows.find((r: any) => r.metric === m)?.n ?? 0);
  const received = get("Received Email"), opened = get("Opened Email"),
        clicked = get("Clicked Email"), placed = get("Placed Order");
  const rev = rows.reduce((s: number, r: any) => s + Number(r.rev), 0);
  return { received, opened, clicked, placed, revenue: rev,
    or: received > 0 ? +(100 * opened / received).toFixed(1) : 0,
    ctr: received > 0 ? +(100 * clicked / received).toFixed(1) : 0,
    ctor: opened > 0 ? +(100 * clicked / opened).toFixed(1) : 0,
    rpe: received > 0 ? +(rev / received).toFixed(2) : 0 };
}

export async function getKlaviyo({ from, to }: Range) {
  const n = daysBetween(from, to);
  const [tot, prev, yoy] = await Promise.all([
    klavRaw({ from, to }), klavRaw(shift(from, to, -n)), klavRaw(shift(from, to, -365)),
  ]);
  const byMetric = await q(
    `SELECT metric, COUNT(*) n, COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE date_key BETWEEN $1 AND $2 GROUP BY metric ORDER BY n DESC`, [from, to]);
  const byFlow = await q(
    `SELECT COALESCE(flow_name,'(campagne)') flow_name,
            COUNT(*) FILTER (WHERE metric='Placed Order') orders, COALESCE(SUM(revenue_ht),0) rev
     FROM fct_email_events WHERE date_key BETWEEN $1 AND $2
     GROUP BY flow_name ORDER BY rev DESC LIMIT 15`, [from, to]);
  return { totals: { ...tot, or: tot.or || null, ctr: tot.ctr || null, ctor: tot.ctor || null, rpe: tot.rpe || null },
    byMetric, byFlow,
    cmp: makeCmp(tot, prev, yoy, ["received", "opened", "clicked", "placed", "revenue", "or", "ctr", "ctor", "rpe"]) };
}
