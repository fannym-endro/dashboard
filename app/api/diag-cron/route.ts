
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = "https://dashboard-fannym-endros-projects.vercel.app";
  const month = new Date().toISOString().slice(0, 7);

  try {
    const res = await fetch(`${base}/api/import-agg?month=${month}`, {
      cache: "no-store",
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw_non_json: text.slice(0, 2000) };
    }
    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      content_type: res.headers.get("content-type"),
      body,
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
