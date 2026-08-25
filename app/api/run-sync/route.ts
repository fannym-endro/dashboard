import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Déclenche une synchro depuis le bouton /sync, en ajoutant le CRON_SECRET
// côté serveur (l'utilisateur n'a donc pas à le connaître).
export async function POST(req: Request) {
  const { which } = await req.json();
  const allowed = ["shopify", "meta", "klaviyo"];
  if (!allowed.includes(which)) {
    return NextResponse.json({ error: "cible inconnue" }, { status: 400 });
  }
  // URL absolue vers notre propre route de sync
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  try {
    const res = await fetch(`${base}/api/sync/${which}`, {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, status: res.status, body });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
