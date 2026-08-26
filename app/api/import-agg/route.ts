import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API = "2025-10";

// Import agrégé ShopifyQL : remplit agg_daily / agg_product_month / agg_category_month.
// ?from=2025-01-01&to=2025-12-31 (par défaut : année en cours + précédente)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get("from") ?? "2025-01-01";
  const SHOP = process.env.SHOPIFY_SHOP;
  const out: any = { from, to };

  try {
    const token = await getShopifyToken();
    const ql = async (q: string) => {
      const res = await fetch(`https://${SHOP}/admin/api/${API}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query: `query { shopifyqlQuery(query: ${JSON.stringify(q)}) { tableData { rows } parseErrors } }` }),
      });
      const j = await res.json();
      const node = j.data?.shopifyqlQuery;
      if (node?.parseErrors?.length) throw new Error(JSON.stringify(node.parseErrors));
      if (j.errors) throw new Error(JSON.stringify(j.errors));
      return node?.tableData?.rows ?? [];
    };

    // 1. Ventes journalières
    const sales = await ql(`FROM sales SHOW total_sales, orders, average_order_value, gross_sales, discounts, returns, net_sales GROUP BY day SINCE ${from} UNTIL ${to}`);
    // 2. Sessions + conversion par jour
    const sess = await ql(`FROM sessions SHOW sessions, conversion_rate GROUP BY day SINCE ${from} UNTIL ${to}`);
    const sessMap = new Map(sess.map((r: any) => [r.day, r]));

    if (sales.length) {
      const rows = sales.map((r: any) => {
        const s: any = sessMap.get(r.day) ?? {};
        return [r.day, num(r.total_sales), num(r.net_sales), num(r.gross_sales), num(r.discounts),
          num(r.returns), int(r.orders), num(r.average_order_value), int(s.sessions), num(s.conversion_rate)];
      });
      const vals = rows.map((_: any, i: number) => {
        const b = i*10; return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`;
      }).join(",");
      await pool.query(
        `INSERT INTO agg_daily (date_key,total_sales,net_sales,gross_sales,discounts,returns,orders,aov,sessions,conversion_rate)
         VALUES ${vals}
         ON CONFLICT (date_key) DO UPDATE SET total_sales=EXCLUDED.total_sales, net_sales=EXCLUDED.net_sales,
           gross_sales=EXCLUDED.gross_sales, discounts=EXCLUDED.discounts, returns=EXCLUDED.returns,
           orders=EXCLUDED.orders, aov=EXCLUDED.aov, sessions=EXCLUDED.sessions, conversion_rate=EXCLUDED.conversion_rate`,
        rows.flat()
      );
      out.jours = rows.length;
    }

    // 3. Produits par mois
    const prod = await ql(`FROM sales SHOW net_sales, net_items_sold GROUP BY product_title, day SINCE ${from} UNTIL ${to}`);
    if (prod.length) {
      const pr = prod.filter((r: any) => r.product_title).map((r: any) => [r.day, r.product_title, num(r.net_sales), int(r.net_items_sold)]);
      // insertion par paquets de 500 pour éviter des requêtes trop grosses
      for (let i=0; i<pr.length; i+=500) {
        const chunk = pr.slice(i, i+500);
        const pv = chunk.map((_: any, k: number) => { const b=k*4; return `($${b+1},$${b+2},$${b+3},$${b+4})`; }).join(",");
        await pool.query(
          `INSERT INTO agg_product_day (date_key,product_title,net_sales,units) VALUES ${pv}
           ON CONFLICT (date_key,product_title) DO UPDATE SET net_sales=EXCLUDED.net_sales, units=EXCLUDED.units`,
          chunk.flat()
        );
      }
      out.lignes_produits = pr.length;
    }

    // 4. Catégories par mois
    const cat = await ql(`FROM sales SHOW net_sales GROUP BY product_collection, day SINCE ${from} UNTIL ${to}`);
    if (cat.length) {
      const cr = cat.filter((r: any) => r.product_collection).map((r: any) => [r.day, r.product_collection, num(r.net_sales)]);
      for (let i=0; i<cr.length; i+=500) {
        const chunk = cr.slice(i, i+500);
        const cv = chunk.map((_: any, k: number) => { const b=k*3; return `($${b+1},$${b+2},$${b+3})`; }).join(",");
        await pool.query(
          `INSERT INTO agg_category_day (date_key,product_type,net_sales) VALUES ${cv}
           ON CONFLICT (date_key,product_type) DO UPDATE SET net_sales=EXCLUDED.net_sales`,
          chunk.flat()
        );
      }
      out.lignes_categories = cr.length;
    }

    out.ok = true;
  } catch (e: any) {
    out.error = String(e?.message ?? e);
  }
  return NextResponse.json(out);
}

function num(v: any) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function int(v: any) { const n = parseInt(v); return isNaN(n) ? 0 : n; }
