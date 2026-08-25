import { NextResponse } from "next/server";
import { pool, upsert } from "@/lib/db";
import { assertCron, hashEmail, ensureDate, getShopifyToken } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel : laisse le temps à la pagination

const SHOP = process.env.SHOPIFY_SHOP;           // ex: endro-cosmetiques.myshopify.com
const API = "2025-01";

// Incrémental : on récupère les commandes mises à jour depuis le dernier sync.
const ORDERS_QUERY = `
query($cursor: String, $q: String!) {
  orders(first: 50, after: $cursor, query: $q, sortKey: UPDATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt
      customer { id email numberOfOrders }
      currentSubtotalPriceSet { shopMoney { amount } }
      totalPriceSet { shopMoney { amount } }
      totalShippingPriceSet { shopMoney { amount } }
      totalDiscountsSet { shopMoney { amount } }
      customerJourneySummary { firstVisit { utmParameters { source medium } landingPage } }
      lineItems(first: 50) {
        nodes {
          id sku quantity
          product { id }
          discountedUnitPriceSet { shopMoney { amount } }
        }
      }
    }
  }
}`;

async function shopifyGraphQL(query: string, variables: any) {
  const token = await getShopifyToken(); // jeton obtenu/renouvelé automatiquement
  const res = await fetch(`https://${SHOP}/admin/api/${API}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

export async function GET(req: Request) {
  try {
    assertCron(req);
  } catch (e) {
    return e as Response;
  }

  // Fenêtre : depuis le dernier order ingéré, sinon 30j de rattrapage.
  const [{ last }] = (
    await pool.query(
      `SELECT COALESCE(MAX(created_at), now() - interval '365 days') AS last FROM fct_orders`
    )
  ).rows;
  const since = new Date(last).toISOString().slice(0, 10);
  const q = `updated_at:>=${since}`;

  let cursor: string | null = null;
  let processed = 0;

  try {
  do {
    const data = await shopifyGraphQL(ORDERS_QUERY, { cursor, q });
    const { nodes, pageInfo } = data.orders;

    for (const o of nodes) {
      const createdAt = o.createdAt;
      const dateKey = createdAt.slice(0, 10);
      await ensureDate(dateKey);

      // raw
      await upsert(
        "raw_shopify_orders",
        { order_id: o.id, payload: JSON.stringify(o) },
        ["order_id"]
      );

      // dim_customer
      const custId = o.customer?.id ?? null;
      if (custId) {
        await upsert(
          "dim_customer",
          {
            customer_id: custId,
            email_hash: hashEmail(o.customer?.email),
            orders_count: o.customer?.numberOfOrders ?? 0,
          },
          ["customer_id"]
        );
      }

      const journey = o.customerJourneySummary?.firstVisit;
      const isNew = (o.customer?.numberOfOrders ?? 1) <= 1;

      // fct_orders
      await upsert(
        "fct_orders",
        {
          order_id: o.id,
          order_number: o.name,
          customer_id: custId,
          date_key: dateKey,
          created_at: createdAt,
          ca_ht: num(o.currentSubtotalPriceSet),
          ca_ttc: num(o.totalPriceSet),
          shipping_ht: num(o.totalShippingPriceSet),
          discount_ht: num(o.totalDiscountsSet),
          is_new_customer: isNew,
          utm_source: journey?.utmParameters?.source ?? null,
          utm_medium: journey?.utmParameters?.medium ?? null,
          landing_ref: journey?.landingPage ?? null,
        },
        ["order_id"]
      );

      // lignes : on purge puis réinsère (gère les edits de commande)
      await pool.query(`DELETE FROM fct_order_lines WHERE order_id=$1`, [o.id]);
      for (const li of o.lineItems.nodes) {
        const unit = num(li.discountedUnitPriceSet);
        await upsert(
          "fct_order_lines",
          {
            order_id: o.id,
            line_id: li.id,
            product_id: li.product?.id ?? null,
            sku: li.sku,
            qty: li.quantity,
            unit_price_ht: unit,
            line_ca_ht: +(unit * li.quantity).toFixed(2),
          },
          ["order_id", "line_id"]
        );
      }
      processed++;
    }

    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, processed, error: String(e?.message ?? e) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, processed });
}

function num(set: any): number {
  return parseFloat(set?.shopMoney?.amount ?? "0");
}
