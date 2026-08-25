import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

// Diagnostic : teste la connexion base + présence des variables + écriture test.
export async function GET() {
  const out: any = { env: {}, db: {}, write: {} };

  // 1. Variables présentes ? (on ne montre pas les valeurs, juste oui/non)
  out.env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    SHOPIFY_SHOP: process.env.SHOPIFY_SHOP ?? null,
    SHOPIFY_CLIENT_ID: !!process.env.SHOPIFY_CLIENT_ID,
    SHOPIFY_CLIENT_SECRET: !!process.env.SHOPIFY_CLIENT_SECRET,
    META_ACCESS_TOKEN: !!process.env.META_ACCESS_TOKEN,
    KLAVIYO_API_KEY: !!process.env.KLAVIYO_API_KEY,
    CRON_SECRET: !!process.env.CRON_SECRET,
  };

  // 2. Connexion base + comptage des lignes
  try {
    const r = await pool.query(`SELECT
      (SELECT count(*) FROM raw_shopify_orders) shopify_raw,
      (SELECT count(*) FROM fct_orders) orders,
      (SELECT count(*) FROM fct_ad_spend) meta,
      (SELECT count(*) FROM fct_email_events) klaviyo`);
    out.db = { ok: true, counts: r.rows[0] };
  } catch (e: any) {
    out.db = { ok: false, error: String(e?.message ?? e) };
  }

  // 3. Test d'écriture réelle dans la base
  try {
    await pool.query(`INSERT INTO dim_date (date_key,year,quarter,month,week_iso,day_of_week,is_weekend)
      VALUES ('2020-01-01',2020,1,1,1,3,false) ON CONFLICT (date_key) DO NOTHING`);
    out.write = { ok: true, message: "écriture base OK" };
  } catch (e: any) {
    out.write = { ok: false, error: String(e?.message ?? e) };
  }

  return NextResponse.json(out, { status: 200 });
}
