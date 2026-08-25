import { Pool } from "pg";

// Pool unique réutilisé entre invocations (Vercel garde le module chaud).
// On retire un éventuel sslmode= de l'URL et on impose le SSL nous-mêmes,
// ce qui évite l'avertissement "SECURITY WARNING: SSL modes..." et fiabilise Neon.
const globalForPg = globalThis as unknown as { pgPool?: Pool };

const rawUrl = process.env.DATABASE_URL ?? "";
// Retire les paramètres sslmode et channel_binding de la query string
// sans casser le reste de l'URL, puis on impose le SSL nous-mêmes.
function cleanConnectionUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch {
    return url; // si l'URL n'est pas parsable, on la laisse telle quelle
  }
}
const cleanUrl = cleanConnectionUrl(rawUrl);

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: cleanUrl,
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
