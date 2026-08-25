import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const out: any = {};
  try {
    const token = await getShopifyToken();
    const SHOP = process.env.SHOPIFY_SHOP;
    const introspect = `query { __type(name: "ShopifyqlTableData") { fields { name type { name kind ofType { name kind } } } } }`;
    const r1 = await fetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: introspect }),
    });
    out.champs_disponibles = await r1.json();
  } catch (e: any) {
    out.erreur = String(e?.message ?? e);
  }
  return NextResponse.json(out);
}
