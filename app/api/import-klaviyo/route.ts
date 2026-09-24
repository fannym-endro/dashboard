import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};

  // 1. Reporting des campagnes (performances agrégées par campagne)
  try {
    const body = {
      data: { type: "campaign-values-report", attributes: {
        timeframe: { key: "last_30_days" },
        statistics: ["recipients", "open_rate", "click_rate", "conversion_value", "opens_unique", "clicks_unique"],
        conversion_metric_id: "VKWrzv",
      } }
    };
    const res = await fetch("https://a.klaviyo.com/api/campaign-values-reports/", { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
    const j = await res.json();
    out.campagnes = { status: res.status, echantillon: j.data?.attributes?.results?.slice(0, 2), erreurs: j.errors };
  } catch (e: any) { out.campagnes = { erreur: String(e?.message ?? e) }; }

  // 2. Reporting des flows
  try {
    const body = {
      data: { type: "flow-values-report", attributes: {
        timeframe: { key: "last_30_days" },
        statistics: ["recipients", "open_rate", "click_rate", "conversion_value", "opens_unique", "clicks_unique"],
        conversion_metric_id: "VKWrzv",
      } }
    };
    const res = await fetch("https://a.klaviyo.com/api/flow-values-reports/", { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
    const j = await res.json();
    out.flows = { status: res.status, echantillon: j.data?.attributes?.results?.slice(0, 2), erreurs: j.errors };
  } catch (e: any) { out.flows = { erreur: String(e?.message ?? e) }; }

  return NextResponse.json(out);
}
