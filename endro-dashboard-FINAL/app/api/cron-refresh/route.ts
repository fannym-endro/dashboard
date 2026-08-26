import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Appelé chaque jour par Vercel Cron. Rafraîchit les agrégats des 10 derniers
// jours (pour capter la veille + corrections), sans toucher à l'historique.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  try {
    const res = await fetch(`${base}/api/import-agg?from=${from}&to=${to}`);
    const body = await res.json();
    return NextResponse.json({ ok: res.ok, body });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
