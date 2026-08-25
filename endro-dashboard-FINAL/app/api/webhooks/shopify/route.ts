import { NextResponse } from "next/server";
import crypto from "crypto";

// Webhook temps réel : Shopify POST sur orders/create, orders/updated,
// refunds/create. On vérifie le HMAC puis on déclenche un sync ciblé.
// (Alternative légère : ré-appeler /api/sync/shopify sur fenêtre courte.)

export async function POST(req: Request) {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(raw, "utf8")
    .digest("base64");

  // comparaison constante pour éviter le timing attack
  const valid =
    digest.length === hmac.length &&
    crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
  if (!valid) return new NextResponse("Invalid HMAC", { status: 401 });

  // Ici tu peux traiter le payload directement (raw = JSON de la commande)
  // ou déclencher le sync incrémental. On répond vite (<5s) pour éviter le retry.
  const topic = req.headers.get("x-shopify-topic");
  console.log("Webhook reçu:", topic);

  // TODO: réutiliser la logique d'upsert de /api/sync/shopify sur ce payload unique
  return NextResponse.json({ ok: true });
}
