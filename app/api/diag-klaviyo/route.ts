import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};

  // Reporting flow sur AOUT 2026 (même période que ton fichier CSV), avec les vrais IDs
  try {
    const body = { data: { type: "flow-values-report", attributes: {
      timeframe: { start: "2026-08-01T00:00:00+00:00", end: "2026-09-01T00:00:00+00:00" },
      statistics: ["recipients", "conversion_value"],
      conversion_metric_id: "VKWrzv",
    } } };
    const res = await fetch("https://a.klaviyo.com/api/flow-values-reports/", { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
    const j = await res.json();
    // On regroupe par flow_id en sommant les messages, puis on trie
    const agg: Record<string, number> = {};
    for (const r of (j.data?.attributes?.results ?? [])) {
      const fid = r.groupings?.flow_id;
      if (fid) agg[fid] = (agg[fid] ?? 0) + (r.statistics?.recipients ?? 0);
    }
    const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6);
    out.top_flows = top.map(([id, recv]) => ({ flow_id: id, recipients: recv }));
    out.exemple_groupings = j.data?.attributes?.results?.[0]?.groupings;
    out.status = res.status;
    out.erreurs = j.errors;
  } catch (e: any) { out.erreur = String(e?.message ?? e); }

  return NextResponse.json(out);
}
