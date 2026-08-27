import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";
import { pool } from "@/lib/db";


export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Paramètre ?date=YYYY-MM-DD requis" }, { status: 400 });
  }

  const out: any = { date };

  try {
    const token = await getShopifyToken();
    const shop = process.env.SHOPIFY_SHOP;

    const query = `
      FROM sales
      SHOW total_sales, orders, average_order_value, sessions, conversion_rate
      SINCE ${date}
      UNTIL ${date}
    `;

    const res = await fetch(
      `https://${shop}/admin/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        body: JSON.stringify({
          query: `
            {
              shopifyqlQuery(query: "${query.replace(/\n/g, " ").replace(/"/g, '\\"')}") {
                tableData {
                  columns { name }
                  rowData
                }
                parseErrors
              }
            }
          `,
        }),
      }
    );

    const json = await res.json();
    out.shopifyql_raw = json;

    const table = json?.data?.shopifyqlQuery?.tableData;
    if (table && table.rowData?.length > 0) {
      const columns = table.columns.map((c: any) => c.name);
      const row = table.rowData[0];
      const direct: any = {};
      columns.forEach((col: string, i: number) => {
        direct[col] = row[i];
      });
      out.shopifyql_direct = direct;
    } else {
      out.shopifyql_direct = null;
      out.shopifyql_parse_errors = json?.data?.shopifyqlQuery?.parseErrors ?? null;
    }

    const dbRes = await pool.query(
      `SELECT * FROM agg_daily WHERE date_key = $1`,
      [date]
    );
    out.en_base = dbRes.rows[0] ?? null;

    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err), stack: err.stack }, { status: 500 });
  }
}
