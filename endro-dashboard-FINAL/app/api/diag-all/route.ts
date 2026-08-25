import { NextResponse } from "next/server";
import { getShopifyToken } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Diagnostic GLOBAL : teste les 3 sources et dit, pour chacune,
// si elle se connecte et combien de données elle voit. Ne modifie rien.
export async function GET() {
  const out: any = { shopify: {}, meta: {}, klaviyo: {} };

  // ---- SHOPIFY ----
  try {
    const token = await getShopifyToken();
    const SHOP = process.env.SHOPIFY_SHOP;
    const res = await fetch(`https://${SHOP}/admin/api/2025-01/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: `{ orders(first: 3, query: "created_at:>=2024-01-01") { edges { node { name } } } }` }),
    });
    const b = await res.json();
    out.shopify = { connexion: "OK", commandes_vues: b.data?.orders?.edges?.length ?? 0, erreurs: b.errors ?? null };
  } catch (e: any) {
    out.shopify = { connexion: "ÉCHEC", erreur: String(e?.message ?? e) };
  }

  // ---- META ----
  try {
    const ACCOUNT = "act_1036120010066341";
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    const url = `https://graph.facebook.com/v21.0/${ACCOUNT}/insights` +
      `?level=ad&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
      `&fields=ad_name,spend&limit=5&access_token=${process.env.META_ACCESS_TOKEN}`;
    const res = await fetch(url);
    const b = await res.json();
    out.meta = b.error
      ? { connexion: "ÉCHEC", erreur: b.error.message }
      : { connexion: "OK", lignes_vues: b.data?.length ?? 0 };
  } catch (e: any) {
    out.meta = { connexion: "ÉCHEC", erreur: String(e?.message ?? e) };
  }

  // ---- KLAVIYO ----
  try {
    const since = new Date(Date.now() - 2 * 864e5).toISOString();
    const res = await fetch(
      `https://a.klaviyo.com/api/events/?filter=${encodeURIComponent(`greater-than(datetime,${since})`)}&page[size]=5`,
      { headers: { Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_API_KEY}`, accept: "application/json", revision: "2024-10-15" } }
    );
    const b = await res.json();
    out.klaviyo = b.errors
      ? { connexion: "ÉCHEC", erreur: JSON.stringify(b.errors) }
      : { connexion: "OK", evenements_vus: b.data?.length ?? 0 };
  } catch (e: any) {
    out.klaviyo = { connexion: "ÉCHEC", erreur: String(e?.message ?? e) };
  }

  return NextResponse.json(out, { status: 200 });
}
