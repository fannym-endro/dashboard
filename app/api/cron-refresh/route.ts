import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Chaque jour : rafraîchit le mois en cours (capte la veille + corrections).
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const base = "https://dashboard-fannym-endros-projects.vercel.app";
  const month = new Date().toISOString().slice(0, 7);

  try {
    const res = await fetch(`${base}/api/import-agg?month=${month}`);
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw_non_json: text.slice(0, 500) };
    }
    return NextResponse.json({ ok: res.ok, status: res.status, body });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
