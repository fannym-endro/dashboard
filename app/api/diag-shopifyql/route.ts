import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const token = await getShopifyToken();
  const SHOP = process.env.SHOPIFY_SHOP;
  const run = async (ql: string) => {
    const res = await fetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: `query { shopifyqlQuery(query: ${JSON.stringify(ql)}) { tableData { columns { name } rows } parseErrors } }` }),
    });
    const j = await res.json();
    const q = j.data?.shopifyqlQuery;
    return { cols: q?.tableData?.columns?.map((c: any) => c.name), n: q?.tableData?.rows?.length, errs: q?.parseErrors, gql: j.errors };
  };

  const out: any = {};
  out.sales_daily = await run("FROM sales SHOW total_sales, orders, average_order_value, gross_sales, discounts, returns, net_sales GROUP BY day SINCE 2025-11-01 UNTIL 2025-11-03");
  out.products = await run("FROM sales SHOW net_sales, net_items_sold GROUP BY product_title SINCE 2025-11-01 UNTIL 2025-11-30 ORDER BY net_sales DESC LIMIT 5");
  out.new_returning = await run("FROM sales SHOW net_sales GROUP BY customer_type SINCE 2025-11-01 UNTIL 2025-11-30");
  out.sessions = await run("FROM sessions SHOW sessions, sessions_converted GROUP BY day SINCE 2025-11-01 UNTIL 2025-11-03");
  return NextResponse.json(out);
}
