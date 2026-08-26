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
    return { cols: q?.tableData?.columns?.map((c: any) => c.name), n: q?.tableData?.rows?.length, sample: q?.tableData?.rows?.slice(0,4), errs: q?.parseErrors };
  };
  const out: any = {};
  // Différents noms possibles pour "collection" dans ShopifyQL
  out.collection = await run("FROM sales SHOW net_sales GROUP BY collection SINCE 2025-11-01 UNTIL 2025-11-30 ORDER BY net_sales DESC LIMIT 5");
  out.collections = await run("FROM sales SHOW net_sales GROUP BY collections SINCE 2025-11-01 UNTIL 2025-11-30 ORDER BY net_sales DESC LIMIT 5");
  out.product_collection = await run("FROM sales SHOW net_sales GROUP BY product_collection SINCE 2025-11-01 UNTIL 2025-11-30 ORDER BY net_sales DESC LIMIT 5");
  out.collection_title = await run("FROM sales SHOW net_sales GROUP BY collection_title SINCE 2025-11-01 UNTIL 2025-11-30 ORDER BY net_sales DESC LIMIT 5");
  // Aussi : product_vendor et variant, au cas où
  out.product_vendor = await run("FROM sales SHOW net_sales GROUP BY product_vendor SINCE 2025-11-01 UNTIL 2025-11-30 ORDER BY net_sales DESC LIMIT 5");
  return NextResponse.json(out);
}
