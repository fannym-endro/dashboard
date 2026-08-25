import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const out: any = {};
  try {
    const token = await getShopifyToken();
    const SHOP = process.env.SHOPIFY_SHOP;
    const query = `query {
      shopifyqlQuery(query: "FROM sales SHOW total_sales, orders TIMESERIES month SINCE 2025-01-01 UNTIL 2025-12-31") {
        __typename
        ... on TableResponse {
          tableData {
            columns { name displayName dataType }
            rowData
          }
        }
        parseErrors { code message }
      }
    }`;
    const res = await fetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query }),
    });
    out.http = res.status;
    out.reponse = await res.json();
  } catch (e: any) {
    out.erreur = String(e?.message ?? e);
  }
  return NextResponse.json(out);
}
