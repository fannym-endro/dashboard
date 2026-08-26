import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};
  try {
    const mres = await fetch("https://a.klaviyo.com/api/metrics/", { headers: h() });
    const mj = await mres.json();
    const all = (mj.data ?? []).map((m: any) => ({ id: m.id, name: m.attributes?.name, integration: m.attributes?.integration?.name }));

    const test = async (id: string) => {
      const body = { data: { type: "metric-aggregate", attributes: {
        metric_id: id, measurements: ["count"], interval: "day",
        filter: ["greater-or-equal(datetime,2025-11-01T00:00:00Z)", "less-than(datetime,2025-11-08T00:00:00Z)"],
        timezone: "Europe/Paris" } } };
      const res = await fetch("https://a.klaviyo.com/api/metric-aggregates/", { method: "POST", headers: h(), body: JSON.stringify(body) });
      const j = await res.json();
      const counts = j.data?.attributes?.data?.[0]?.measurements?.count ?? [];
      return counts.reduce((a: number, b: number) => a + b, 0);
    };
    const results: any = {};
    for (const m of all) {
      try { const tot = await test(m.id); if (tot > 0) results[m.name] = tot; } catch {}
    }
    out.metriques_avec_donnees = results;
  } catch (e: any) { out.error = String(e?.message ?? e); }
  return NextResponse.json(out);
}
