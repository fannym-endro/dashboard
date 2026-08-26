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
    const find = (name: string) => (mj.data ?? []).find((m: any) => m.attributes?.name === name)?.id ?? null;
    const ids = {
      placed: find("Placed Order"),
      opened: find("Opened Email"),
      clicked: find("Clicked Email"),
      received: find("Received Email"),
    };
    out.ids = ids;

    if (ids.placed) {
      const body = {
        data: { type: "metric-aggregate", attributes: {
          metric_id: ids.placed,
          measurements: ["count", "sum_value"],
          interval: "day",
          filter: ["greater-or-equal(datetime,2025-11-01T00:00:00Z)", "less-than(datetime,2025-11-08T00:00:00Z)"],
          timezone: "Europe/Paris",
        } }
      };
      const ares = await fetch("https://a.klaviyo.com/api/metric-aggregates/", { method: "POST", headers: h(), body: JSON.stringify(body) });
      out.aggregate = await ares.json();
    }
  } catch (e: any) { out.error = String(e?.message ?? e); }
  return NextResponse.json(out);
}
