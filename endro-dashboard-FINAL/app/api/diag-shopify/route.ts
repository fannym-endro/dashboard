import { NextResponse } from "next/server";
import { getShopifyToken, ensureDate } from "@/lib/sync-utils";
import { upsert, pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Import Shopify par tranche de dates, pour tenir dans le temps imparti.
// On passe la période dans l'URL : ?from=2024-01-01&to=2024-03-31
// À appeler plusieurs fois en avançant les dates jusqu'à aujourd'hui.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "2024-01-01";
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);

  const r: any = { periode: `${from} → ${to}`, recu: 0, ecrit: 0, erreurs: 0, premiere_erreur: null };
  try {
    const token = await getShopifyToken();
    const SHOP = process.env.SHOPIFY_SHOP;
    const num = (s: any) => parseFloat(s?.shopMoney?.amount ?? "0");
    let cursor: any = null;
    const started = Date.now();

    do {
      // sécurité : on s'arrête à 50s pour éviter le timeout brutal
      if (Date.now() - started > 50000) { r.arret = "limite de temps atteinte, relance avec ?from=" + to; break; }

      const query = `query($cursor: String) {
        orders(first: 50, after: $cursor, query: "created_at:>=${from} created_at:<=${to}", sortKey: CREATED_AT) {
          pageInfo { hasNextPage endCursor }
          nodes { id name createdAt
            customer { id email numberOfOrders }
            currentSubtotalPriceSet { shopMoney { amount } }
            totalPriceSet { shopMoney { amount } }
            totalShippingPriceSet { shopMoney { amount } }
            totalDiscountsSet { shopMoney { amount } }
            lineItems(first: 50) { nodes { id sku quantity product { id } discountedUnitPriceSet { shopMoney { amount } } } }
          } } }`;
      const res = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables: { cursor } }),
      });
      const json = await res.json();
      if (json.errors) { r.query_errors = json.errors; break; }
      const { nodes, pageInfo } = json.data.orders;
      for (const o of nodes) {
        r.recu++;
        try {
          const dateKey = o.createdAt.slice(0, 10);
          await ensureDate(dateKey);
          await upsert("raw_shopify_orders", { order_id: o.id, payload: JSON.stringify(o) }, ["order_id"]);
          const custId = o.customer?.id ?? null;
          if (custId) await upsert("dim_customer", { customer_id: custId, email_hash: null, orders_count: o.customer?.numberOfOrders ?? 0 }, ["customer_id"]);
          await upsert("fct_orders", {
            order_id: o.id, order_number: o.name, customer_id: custId, date_key: dateKey,
            created_at: o.createdAt, ca_ht: num(o.currentSubtotalPriceSet), ca_ttc: num(o.totalPriceSet),
            shipping_ht: num(o.totalShippingPriceSet), discount_ht: num(o.totalDiscountsSet),
            is_new_customer: (o.customer?.numberOfOrders ?? 1) <= 1, utm_source: null, utm_medium: null, landing_ref: null,
          }, ["order_id"]);
          await pool.query(`DELETE FROM fct_order_lines WHERE order_id=$1`, [o.id]);
          for (const li of o.lineItems.nodes) {
            const unit = num(li.discountedUnitPriceSet);
            await upsert("fct_order_lines", {
              order_id: o.id, line_id: li.id, product_id: li.product?.id ?? null, sku: li.sku,
              qty: li.quantity, unit_price_ht: unit, line_ca_ht: +(unit * li.quantity).toFixed(2),
            }, ["order_id", "line_id"]);
          }
          r.ecrit++;
        } catch (e: any) { r.erreurs++; if (!r.premiere_erreur) r.premiere_erreur = String(e?.message ?? e); }
      }
      cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
    } while (cursor);

    const [{ c }] = (await pool.query("SELECT count(*) c FROM fct_orders")).rows;
    r.total_en_base = c;
  } catch (e: any) { r.ERREUR_FATALE = String(e?.message ?? e); }
  return NextResponse.json(r, { status: 200 });
}
