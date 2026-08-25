import crypto from "crypto";
import { pool } from "./db";

// Protège les routes /api/sync/*.
// Vercel Cron injecte automatiquement "Authorization: Bearer $CRON_SECRET"
// dès que la variable CRON_SECRET est définie dans le projet. On refuse
// tout appel qui ne la présente pas (appels manuels => passe le même header).
export function assertCron(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    throw new Response("Unauthorized", { status: 401 });
  }
}

// --- Authentification Shopify (Dev Dashboard, client credentials grant) ---
// Depuis 2026, Shopify ne fournit plus de jeton fixe. On l'obtient en échangeant
// CLIENT_ID + CLIENT_SECRET contre un access_token valable 24h, mis en cache ici.
let shopifyToken: string | null = null;
let shopifyTokenExpiresAt = 0;

export async function getShopifyToken(): Promise<string> {
  if (shopifyToken && Date.now() < shopifyTokenExpiresAt - 60_000) {
    return shopifyToken;
  }
  const shop = process.env.SHOPIFY_SHOP!; // ex: endro-cosmetiques.myshopify.com
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID!,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    throw new Error(`Shopify token request failed: ${res.status} ${await res.text()}`);
  }
  const { access_token, expires_in } = await res.json();
  shopifyToken = access_token;
  shopifyTokenExpiresAt = Date.now() + expires_in * 1000;
  return shopifyToken!;
}

export function hashEmail(email?: string | null): string | null {
  if (!email) return null;
  return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

// Garantit qu'une date existe dans dim_date avant tout insert de fait.
export async function ensureDate(dateKey: string) {
  const d = new Date(dateKey + "T00:00:00Z");
  await pool.query(
    `INSERT INTO dim_date (date_key, year, quarter, month, week_iso, day_of_week, is_weekend)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (date_key) DO NOTHING`,
    [
      dateKey,
      d.getUTCFullYear(),
      Math.floor(d.getUTCMonth() / 3) + 1,
      d.getUTCMonth() + 1,
      isoWeek(d),
      d.getUTCDay(),
      d.getUTCDay() === 0 || d.getUTCDay() === 6,
    ]
  );
}

function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
