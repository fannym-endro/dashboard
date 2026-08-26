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
    return { cols: q?.tableData?.columns?.map((c: any) => c.name), n: q?.tableData?.rows?.length, sample: q?.tableData?.rows?.slice(0,2), errs: q?.parseErrors };
  };
  const out: any = {};
  out.prod_day = await run("FROM sales SHOW net_sales, net_items_sold GROUP BY product_title, day SINCE 2025-11-01 UNTIL 2025-11-02 ORDER BY net_sales DESC LIMIT 5");
  out.cat_day = await run("FROM sales SHOW net_sales GROUP BY product_type, day SINCE 2025-11-01 UNTIL 2025-11-02");
  out.promo = await run("FROM sales SHOW orders, ordered_item_quantity GROUP BY day SINCE 2025-11-01 UNTIL 2025-11-02");
  return NextResponse.json(out);
}
