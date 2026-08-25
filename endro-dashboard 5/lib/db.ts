import { Pool } from "pg";

// Pool unique réutilisé entre invocations (Vercel garde le module chaud).
// DATABASE_URL = ta connexion Postgres (Neon/Supabase/Vercel Postgres).
const globalForPg = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function q<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

// Helper upsert générique par colonnes de conflit
export async function upsert(
  table: string,
  row: Record<string, any>,
  conflictCols: string[]
) {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(",");
  const updates = cols
    .filter((c) => !conflictCols.includes(c))
    .map((c) => `${c}=EXCLUDED.${c}`)
    .join(",");
  const sql = `INSERT INTO ${table} (${cols.join(",")}) VALUES (${placeholders})
    ON CONFLICT (${conflictCols.join(",")})
    ${updates ? `DO UPDATE SET ${updates}` : "DO NOTHING"}`;
  await pool.query(sql, vals);
}
