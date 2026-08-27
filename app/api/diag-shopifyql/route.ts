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
    // 1. Interroger ShopifyQL en direct pour cette date précise
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
                ... on TableResponse {
                  tableData {
                    rowData
                    columns { name }
                  }
                }
                parseErrors { message }
              }
            }
          `,
        }),
      }
    );

    const json = await res.json();
