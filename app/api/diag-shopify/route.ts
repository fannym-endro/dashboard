import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Diagnostic Shopify : teste chaque étape et renvoie le détail.
export async function GET() {
  const out: any = {};
  const SHOP = process.env.SHOPIFY_SHOP;
  const API = "2025-01";

  // Étape 1 : obtenir un jeton via client_credentials
  let token: string | null = null;
  try {
    const res = await fetch(`https://${SHOP}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.SHOPIFY_CLIENT_ID!,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
      }),
    });
    const body = await res.json();
    out.token_step = { status: res.status, ok: res.ok, has_token: !!body.access_token, body_keys: Object.keys(body), body };
    token = body.access_token ?? null;
  } catch (e: any) {
    out.token_step = { ok: false, error: String(e?.message ?? e) };
  }

  // Étape 2 : si on a un jeton, compter les commandes des 365 derniers jours
  if (token) {
    try {
      const query = `{ orders(first: 5, query: "created_at:>=2024-01-01") { edges { node { id name createdAt } } } }`;
      const res = await fetch(`https://${SHOP}/admin/api/${API}/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query }),
      });
      const body = await res.json();
      out.orders_step = {
        status: res.status,
        errors: body.errors ?? null,
        sample_count: body.data?.orders?.edges?.length ?? 0,
        sample: body.data?.orders?.edges?.map((e: any) => e.node.name) ?? [],
      };
    } catch (e: any) {
      out.orders_step = { ok: false, error: String(e?.message ?? e) };
    }
  }

  return NextResponse.json(out, { status: 200 });
}
