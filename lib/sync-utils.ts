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
