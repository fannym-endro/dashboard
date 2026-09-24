import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};

  // Test A : reporting flow SANS conversion_metric (groupé nativement par flow)
  try {
    const body = { data: { type: "flow-values-report", attributes: {
      timeframe: { key: "last_30_days" },
      statistics: ["recipients"],
    } } };
    const res = await fetch("https://a.klaviyo.com/api/flow-values-reports/", { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
    const j = await res.json();
    const results = (j.data?.attributes?.results ?? [])
      .sort((a: any, b: any) => (b.statistics?.recipients ?? 0) - (a.statistics?.recipients ?? 0))
      .slice(0, 5);
    out.test_A = { status: res.status, exemples: results.map((r: any) => ({ groupings: r.groupings, recipients: r.statistics?.recipients })), erreurs: j.errors };
  } catch (e: any) { out.test_A = { erreur: String(e?.message ?? e) }; }

  return NextResponse.json(out);
}
