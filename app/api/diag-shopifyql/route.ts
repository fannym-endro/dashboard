import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

async function runShopifyQL(shop: string, token: string, query: string) {
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
                rows
              }
              parseErrors
            }
          }
        `,
      }),
    }
  );

  const json = await res.json();
  const table = json?.data?.shopifyqlQuery?.tableData;
  const parseErrors = json?.data?.shopifyqlQuery?.parseErrors ?? null;

  let parsed: any = null;
  if (table && table.rows?.length > 0) {
    const columns = table.columns.map((c: any) => c.name);
    const row = table.rows[0];
    parsed = {};
    columns.forEach((col: string, i: number) => {
      parsed[col] = row[i];
    });
  }

  return { raw: json, parsed, parseErrors };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Paramètre ?date=YYYY-MM-DD requis" }, { status: 400 });
  }

  const out: any = { date };

  try {
    const token = await getShopifyToken();
    const shop = process.env.SHOPIFY_SHOP as string;

    const salesQuery = `
      FROM sales
      SHOW total_sales, orders, average_order_value
      SINCE ${date}
      UNTIL ${date}
    `;

    const sessionsQuery = `
      FROM sessions
      SHOW sessions, conversion_rate
      SINCE ${date}
      UNTIL ${date}
    `;

    const salesResult = await runShopifyQL(shop, token, salesQuery);
    const sessionsResult = await runShopifyQL(shop, token, sessionsQuery);

    out.sales_raw = salesResult.raw;
    out.sessions_raw = sessionsResult.raw;
    out.sales_parse_errors = salesResult.parseErrors;
    out.sessions_parse_errors = sessionsResult.parseErrors;

    out.shopifyql_direct = {
      ...(salesResult.parsed ?? {}),
      ...(sessionsResult.parsed ?? {}),
    };

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
