import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SHOP = process.env.SHOPIFY_SHOP;
const API = "2025-01";

// Page de diagnostic : teste chaque étape de la connexion Shopify et renvoie
// un rapport clair, sans rien écrire en base.
export async function GET() {
  const report: any = { shop: SHOP, steps: {} };

  // 1) Obtenir un jeton
  let token: string;
  try {
    token = await getShopifyToken();
    report.steps.token = token ? "OK (jeton obtenu)" : "VIDE";
    report.tokenPrefix = token ? token.slice(0, 6) + "…" : null;
  } catch (e: any) {
    report.steps.token = "ERREUR: " + String(e?.message ?? e);
    return NextResponse.json(report);
  }

  // 2) Compter les commandes (test simple, 5 dernières, sans filtre de date)
  try {
    const query = `{ orders(first: 5, sortKey: CREATED_AT, reverse: true) {
      nodes { id name createdAt } } }`;
    const res = await fetch(`https://${SHOP}/admin/api/${API}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query }),
    });
    const json = await res.json();
    report.steps.httpStatus = res.status;
    if (json.errors) {
      report.steps.orders = "ERREUR GraphQL";
      report.graphqlErrors = json.errors;
    } else {
      const nodes = json.data?.orders?.nodes ?? [];
      report.steps.orders = `OK — ${nodes.length} commandes visibles`;
      report.sample = nodes.map((n: any) => ({ name: n.name, date: n.createdAt }));
    }
  } catch (e: any) {
    report.steps.orders = "ERREUR: " + String(e?.message ?? e);
  }

  return NextResponse.json(report);
}
