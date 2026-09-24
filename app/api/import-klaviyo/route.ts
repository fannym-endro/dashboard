import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

const METRICS = {
  orders: "VKWrzv",
  received: "UT3BUG",
  opened: "Xiuy3N",
  clicked: "YywDh4",
};

async function fetchMetric(id: string, from: string, to: string, withValue: boolean) {
  const measurements = withValue ? ["count", "sum_value"] : ["count"];
  const body = { data: { type: "metric-aggregate", attributes: {
    metric_id: id, measurements, interval: "day",
    filter: [`greater-or-equal(datetime,${from}T00:00:00)`, `less-than(datetime,${to}T00:00:00)`],
    timezone: "UTC",
  } } };
  const res = await fetch("https://a.klaviyo.com/api/metric-aggregates/", { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
  const j = await res.json();
  const dates: string[] = j.data?.attributes?.dates ?? [];
  const m = j.data?.attributes?.data?.[0]?.measurements ?? {};
  const counts = m.count ?? [];
  const values = m.sum_value ?? [];
  const out: Record<string, { count: number; value: number }> = {};
  dates.forEach((d, i) => {
    const key = d.slice(0, 10);
    out[key] = { count: counts[i] ?? 0, value: values[i] ?? 0 };
  });
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const [y, m] = base.split("-").map(Number);
  const from = `${base}-01`;
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const out: any = { mois: base };

  try {
    const [orders, received, opened, clicked] = await Promise.all([
      fetchMetric(METRICS.orders, from, next, true),
      fetchMetric(METRICS.received, from, next, false),
      fetchMetric(METRICS.opened, from, next, false),
      fetchMetric(METRICS.clicked, from, next, false),
    ]);

    const allDates = new Set<string>([
      ...Object.keys(orders), ...Object.keys(received), ...Object.keys(opened), ...Object.keys(clicked),
    ]);

    const rows: any[] = [];
    for (const d of allDates) {
      // ne garder que les dates du mois demandé (évite les débordements de bornes)
      if (!d.startsWith(base)) continue;
      rows.push([
        d,
        received[d]?.count ?? 0,
        opened[d]?.count ?? 0,
        clicked[d]?.count ?? 0,
        orders[d]?.count ?? 0,
        Math.round((orders[d]?.value ?? 0) * 100) / 100,
      ]);
    }

    if (rows.length) {
      const vals = rows.map((_, i) => { const b = i*6; return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6})`; }).join(",");
      await pool.query(
        `INSERT INTO agg_klaviyo_day (date_key,received,opened,clicked,orders,revenue)
         VALUES ${vals}
         ON CONFLICT (date_key) DO UPDATE SET received=EXCLUDED.received, opened=EXCLUDED.opened,
           clicked=EXCLUDED.clicked, orders=EXCLUDED.orders, revenue=EXCLUDED.revenue, updated_at=now()`,
        rows.flat()
      );
      out.jours = rows.length;
    }
    out.ok = true;
  } catch (e: any) { out.error = String(e?.message ?? e); }
  return NextResponse.json(out);
}
