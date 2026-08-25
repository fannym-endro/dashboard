import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
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
    return { cols: q?.tableData?.columns?.map((c: any) => c.name), rows: q?.tableData?.rows?.slice(0,3), errs: q?.parseErrors };
  };
  const out: any = {};
  out.a = await run("FROM sales SHOW net_sales GROUP BY returning_customer_type SINCE 2025-11-01 UNTIL 2025-11-30");
  out.b = await run("FROM sales SHOW net_sales GROUP BY customer_returning_status SINCE 2025-11-01 UNTIL 2025-11-30");
  out.c = await run("FROM sessions SHOW sessions GROUP BY day SINCE 2025-11-01 UNTIL 2025-11-03");
  out.d = await run("FROM sessions SHOW sessions, conversion_rate GROUP BY day SINCE 2025-11-01 UNTIL 2025-11-03");
  out.e = await run("FROM sales SHOW net_sales GROUP BY product_type SINCE 2025-11-01 UNTIL 2025-11-30 ORDER BY net_sales DESC LIMIT 10");
  return NextResponse.json(out);
}
