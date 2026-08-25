import { NextResponse } from "next/server";
import { getShopifyToken, ensureDate } from "@/lib/sync-utils";
import { upsert, pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  const steps: any = {};
  try {
    const token = await getShopifyToken();
    steps.token = "OK";
    const SHOP = process.env.SHOPIFY_SHOP;
    const query = `{ orders(first: 5, query: "created_at:>=2024-01-01", sortKey: CREATED_AT, reverse: true) {
      nodes { id name createdAt
        customer { id email numberOfOrders }
        currentSubtotalPriceSet { shopMoney { amount } }
        totalPriceSet { shopMoney { amount } }
        totalShippingPriceSet { shopMoney { amount } }
        totalDiscountsSet { shopMoney { amount } }
        lineItems(first: 10) { nodes { id sku quantity product { id } discountedUnitPriceSet { shopMoney { amount } } } }
      } } }`;
    const res = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    if (json.errors) { steps.query_errors = json.errors; return NextResponse.json(steps); }
    const nodes = json.data.orders.nodes;
    steps.commandes_recues = nodes.length;

    let written = 0;
    for (const o of nodes) {
      const num = (s: any) => parseFloat(s?.shopMoney?.amount ?? "0");
      const dateKey = o.createdAt.slice(0, 10);
      await ensureDate(dateKey);
      await upsert("raw_shopify_orders", { order_id: o.id, payload: JSON.stringify(o) }, ["order_id"]);
      const custId = o.customer?.id ?? null;
      await upsert("fct_orders", {
        order_id: o.id, order_number: o.name, customer_id: custId, date_key: dateKey,
        created_at: o.createdAt, ca_ht: num(o.currentSubtotalPriceSet), ca_ttc: num(o.totalPriceSet),
        shipping_ht: num(o.totalShippingPriceSet), discount_ht: num(o.totalDiscountsSet),
        is_new_customer: (o.customer?.numberOfOrders ?? 1) <= 1, utm_source: null, utm_medium: null, landing_ref: null,
      }, ["order_id"]);
      written++;
    }
    steps.ecrites = written;
    const [{ c }] = (await pool.query("SELECT count(*) c FROM fct_orders")).rows;
    steps.total_en_base = c;
    steps.resultat = "SUCCÈS";
  } catch (e: any) {
    steps.ERREUR = String(e?.message ?? e);
    steps.stack = String(e?.stack ?? "").split("\n").slice(0, 3);
  }
  return NextResponse.json(steps, { status: 200 });
}
