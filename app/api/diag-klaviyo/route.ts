import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

// Teste plusieurs métriques candidates sur une même période récente,
// et renvoie pour chacune le total d'événements + le CA cumulé.
export async function GET() {
  const out: any = {};
  const candidates: Record<string, string> = {
    "Placed Order (TfEK2x)": "TfEK2x",
    "Placed Order (VKWrzv)": "VKWrzv",
    "Ordered Product (WnXuc8)": "WnXuc8",
    "Received Email (UT3BUG)": "UT3BUG",
    "Opened Email (Xiuy3N)": "Xiuy3N",
    "Clicked Email (YywDh4)": "YywDh4",
  };

  const test = async (id: string) => {
    const body = { data: { type: "metric-aggregate", attributes: {
      metric_id: id,
      measurements: ["count", "sum_value"],
      interval: "day",
      filter: ["greater-or-equal(datetime,2026-08-01T00:00:00)", "less-than(datetime,2026-08-08T00:00:00)"],
      timezone: "Europe/Paris",
    } } };
    const res = await fetch("https://a.klaviyo.com/api/metric-aggregates/", { method: "POST", headers: h(), body: JSON.stringify(body) });
    const j = await res.json();
    const m = j.data?.attributes?.data?.[0]?.measurements;
    if (!m) return { erreur: j.errors ?? "pas de données" };
    const count = (m.count ?? []).reduce((a: number, b: number) => a + b, 0);
    const value = (m.sum_value ?? []).reduce((a: number, b: number) => a + b, 0);
    return { total_evenements: count, ca_cumule: Math.round(value) };
  };

  for (const [name, id] of Object.entries(candidates)) {
    try { out[name] = await test(id); } catch (e: any) { out[name] = { erreur: String(e?.message ?? e) }; }
  }
  return NextResponse.json(out);
}
