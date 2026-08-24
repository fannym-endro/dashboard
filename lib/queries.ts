import { unstable_cache } from "next/cache";
import { q } from "./db";

// Lecture directe Postgres depuis les Server Components.
// unstable_cache calé sur la fréquence de sync (revalidate 3600s = 1h).

export const getDailyKpis = unstable_cache(
  async (days = 30) =>
    q(
      `SELECT * FROM v_daily_kpis
       WHERE date_key >= current_date - $1::int
       ORDER BY date_key`,
      [days]
    ),
  ["daily-kpis"],
  { revalidate: 3600 }
);

export const getKpiTotals = unstable_cache(
  async (days = 30) =>
    q(
      `SELECT
         SUM(ca_ht)                         AS ca_ht,
         SUM(orders)                        AS orders,
         SUM(new_orders)                    AS new_orders,
         SUM(meta_spend)                    AS meta_spend,
         SUM(meta_attributed_ca)            AS meta_attributed_ca,
         SUM(klaviyo_attributed_ca)         AS klaviyo_attributed_ca,
         CASE WHEN SUM(meta_spend) > 0
              THEN ROUND(SUM(meta_attributed_ca)/SUM(meta_spend),2) END AS meta_roas,
         CASE WHEN SUM(orders) > 0
              THEN ROUND(SUM(ca_ht)/SUM(orders),2) END AS aov_ht,
         CASE WHEN SUM(orders) > 0
              THEN ROUND(100.0*SUM(new_orders)/SUM(orders),1) END AS pct_new
       FROM v_daily_kpis
       WHERE date_key >= current_date - $1::int`,
      [days]
    ),
  ["kpi-totals"],
  { revalidate: 3600 }
);

// Top produits sur la période (grain ligne de commande)
export const getTopProducts = unstable_cache(
  async (days = 30, limit = 10) =>
    q(
      `SELECT p.title, p.categorie, SUM(l.line_ca_ht) ca_ht, SUM(l.qty) units
       FROM fct_order_lines l
       JOIN fct_orders o ON o.order_id = l.order_id
       LEFT JOIN dim_product p ON p.product_id = l.product_id
       WHERE o.date_key >= current_date - $1::int
       GROUP BY p.title, p.categorie
       ORDER BY ca_ht DESC
       LIMIT $2`,
      [days, limit]
    ),
  ["top-products"],
  { revalidate: 3600 }
);

// Répartition du CA par canal attribué (pour visualiser le bucket non attribué)
export const getChannelSplit = unstable_cache(
  async (days = 30) =>
    q(
      `SELECT
         COALESCE(NULLIF(utm_source,''),'(non attribué)') AS source,
         SUM(ca_ht) ca_ht, COUNT(*) orders
       FROM fct_orders
       WHERE date_key >= current_date - $1::int
       GROUP BY 1 ORDER BY ca_ht DESC`,
      [days]
    ),
  ["channel-split"],
  { revalidate: 3600 }
);
