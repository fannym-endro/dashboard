import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";

export async function GET() {
  const out: any = {};
  const h = { Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" };

  try {
    const res = await fetch("https://a.klaviyo.com/api/metrics/", { headers: h });
    const j = await res.json();
    out.metrics = (j.data ?? []).map((m: any) => ({ id: m.id, name: m.attributes?.name }));
  } catch (e: any) { out.metrics_err = String(e?.message ?? e); }

  return NextResponse.json(out);
}
