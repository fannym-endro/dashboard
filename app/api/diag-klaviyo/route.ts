import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};
  const test = async (id: string, measurements: string[]) => {
    const body = { data: { type: "metric-aggregate", attributes: {
      metric_id: id, measurements, interval: "day",
      filter: ["greater-or-equal(datetime,2026-08-25T00:00:00)", "less-than(datetime,2026-08-28T00:00:00)"],
      timezone: "Europe/Paris",
    } } };
    const res = await fetch("https://a.klaviyo.com/api/metric-aggregates/", { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
    const j = await res.json();
    return { dates: j.data?.attributes?.dates, measurements: j.data?.attributes?.data?.[0]?.measurements, errors: j.errors };
  };
  // Opened Email avec count seul, puis avec unique
  out.opened_count = await test("Xiuy3N", ["count"]);
  out.opened_unique = await test("Xiuy3N", ["unique"]);
  return NextResponse.json(out);
}
