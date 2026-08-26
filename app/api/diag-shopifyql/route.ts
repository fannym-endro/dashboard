import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET() {
  const token = await getShopifyToken();
  const SHOP = process.env.SHOPIFY_SHOP;
  const run = async (ql: string) => {
    const res = await fetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: `query { shopifyqlQuery(query: ${JSON.stringify(ql)}) { tableData { columns { name } rows } parseErrors } }` }),
    });
    const j = await res.json(); const q = j.data?.shopifyqlQuery;
    return { cols: q?.tableData?.columns?.map((c: any) => c.name), sample: q?.tableData?.rows?.slice(0,4), errs: q?.parseErrors };
  };
  const out: any = {};
  out.a = await run("FROM sales SHOW net_sales, orders GROUP BY customer_type, day SINCE 2025-11-01 UNTIL 2025-11-02");
  out.b = await run("FROM sales SHOW net_sales, orders GROUP BY customer_order_index SINCE 2025-11-01 UNTIL 2025-11-30");
  out.c = await run("FROM sales SHOW net_sales, orders GROUP BY first_time_vs_returning SINCE 2025-11-01 UNTIL 2025-11-30");
  out.d = await run("FROM orders SHOW net_sales, orders GROUP BY customer_type SINCE 2025-11-01 UNTIL 2025-11-30");
  out.e = await run("FROM sales SHOW net_sales, orders GROUP BY returning_customer SINCE 2025-11-01 UNTIL 2025-11-30");
  return NextResponse.json(out);
}
