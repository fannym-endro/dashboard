import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";
import { pool } from "@/lib/db";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date") ?? new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const SHOP = process.env.SHOPIFY_SHOP;
  const out: any = { date };
  try {
    const token = await getShopifyToken();
    const q = `FROM sales SHOW total_sales, orders, net_sales GROUP BY day SINCE ${date} UNTIL ${date}`;
    const res = await fetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: `query { shopifyqlQuery(query: ${JSON.stringify(q)}) { tableData { rows } parseErrors } }` }),
    });
    const j = await res.json();
    out.shopifyql_direct = j.data?.shopifyqlQuery?.tableData?.rows ?? j.data?.shopifyqlQuery?.parseErrors ?? j.errors;
    const stored = await pool.query(`SELECT total_sales, orders, net_sales FROM agg_daily WHERE date_key=$1`, [date]);
    out.en_base = stored.rows[0] ?? "absent";
  } catch (e: any) { out.error = String(e?.message ?? e); }
  return NextResponse.json(out);
}
