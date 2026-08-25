import { NextResponse } from "next/server";
import { getShopifyToken, ensureDate } from "@/lib/sync-utils";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "2025-01-01";
  const cursorIn = url.searchParams.get("cursor") || null;
  const num = (s: any) => parseFloat(s?.shopMoney?.amount ?? "0");
  const r: any = { ecrit: 0 };

  try {
    const token = await getShopifyToken();
    const SHOP = process.env.SHOPIFY_SHOP;
    const query = `query($cursor: String) {
      orders(first: 25, after: $cursor, query: "created_at:>=${from}", sortKey: CREATED_AT) {
        pageInfo { hasNextPage endCursor }
        nodes { id name createdAt
          customer { id numberOfOrders }
          currentSubtotalPriceSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          totalShippingPriceSet { shopMoney { amount } }
          totalDiscountsSet { shopMoney { amount } }
          lineItems(first: 50) { nodes { id sku quantity product { id } discountedUnitPriceSet { shopMoney { amount } } } }
        } } }`;
    const res = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables: { cursor: cursorIn } }),
    });
    const json = await res.json();
    if (json.errors) { r.errors = json.errors; return NextResponse.json(r); }
    const { nodes, pageInfo } = json.data.orders;

    const dates = [...new Set(nodes.map((o: any) => o.createdAt.slice(0, 10)))];
    for (const d of dates) await ensureDate(d as string);

    if (nodes.length) {
      const custRows: any[] = [];
      const orderRows: any[] = [];
      const lineRows: any[] = [];
      for (const o of nodes) {
        const dateKey = o.createdAt.slice(0, 10);
        const custId = o.customer?.id ?? null;
        if (custId) custRows.push([custId, o.customer?.numberOfOrders ?? 0]);
        orderRows.push([o.id, o.name, custId, dateKey, o.createdAt,
          num(o.currentSubtotalPriceSet), num(o.totalPriceSet), num(o.totalShippingPriceSet),
          num(o.totalDiscountsSet), (o.customer?.numberOfOrders ?? 1) <= 1]);
        for (const li of o.lineItems.nodes) {
          const unit = num(li.discountedUnitPriceSet);
          lineRows.push([o.id, li.id, li.product?.id ?? null, li.sku, li.quantity, unit, +(unit * li.quantity).toFixed(2)]);
        }
      }

      if (custRows.length) {
        const vals = custRows.map((_, i) => `($${i*2+1},$${i*2+2})`).join(",");
        await pool.query(
          `INSERT INTO dim_customer (customer_id, orders_count) VALUES ${vals}
           ON CONFLICT (customer_id) DO UPDATE SET orders_count=EXCLUDED.orders_count`,
          custRows.flat()
        );
      }
      const ov = orderRows.map((_, i) => {
        const b = i*10; return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`;
      }).join(",");
      await pool.query(
        `INSERT INTO fct_orders (order_id,order_number,customer_id,date_key,created_at,ca_ht,ca_ttc,shipping_ht,discount_ht,is_new_customer)
         VALUES ${ov}
         ON CONFLICT (order_id) DO UPDATE SET ca_ht=EXCLUDED.ca_ht, ca_ttc=EXCLUDED.ca_ttc`,
        orderRows.flat()
      );
      const orderIds = nodes.map((o: any) => o.id);
      await pool.query(`DELETE FROM fct_order_lines WHERE order_id = ANY($1)`, [orderIds]);
      if (lineRows.length) {
        const lv = lineRows.map((_, i) => {
          const b = i*7; return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7})`;
        }).join(",");
        await pool.query(
          `INSERT INTO fct_order_lines (order_id,line_id,product_id,sku,qty,unit_price_ht,line_ca_ht)
           VALUES ${lv} ON CONFLICT (order_id,line_id) DO NOTHING`,
          lineRows.flat()
        );
      }
      r.ecrit = nodes.length;
    }

    const [{ c }] = (await pool.query("SELECT count(*) c FROM fct_orders")).rows;
    r.total = c;
    r.done = !pageInfo.hasNextPage;
    r.cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } catch (e: any) { r.error = String(e?.message ?? e); }
  return NextResponse.json(r);
}
