import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};

  // 1. Un échantillon de campagnes via l'API campaigns (pour voir la forme des IDs)
  try {
    const res = await fetch("https://a.klaviyo.com/api/campaigns/?filter=equals(messages.channel,'email')&fields[campaign]=name&page[size]=3", { headers: h(), cache: "no-store" });
    const j = await res.json();
    out.exemple_campaigns_api = j.data?.map((c: any) => ({ id: c.id, name: c.attributes?.name }));
  } catch (e: any) { out.err1 = String(e?.message ?? e); }

  // 2. Le reporting avec le nom de campagne demandé directement
  try {
    const body = { data: { type: "campaign-values-report", attributes: {
      timeframe: { key: "last_30_days" },
      statistics: ["recipients", "conversion_value"],
      conversion_metric_id: "VKWrzv",
    } } };
    const res = await fetch("https://a.klaviyo.com/api/campaign-values-reports/", { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
    const j = await res.json();
    out.exemple_reporting = j.data?.attributes?.results?.slice(0, 3)?.map((r: any) => r.groupings);
  } catch (e: any) { out.err2 = String(e?.message ?? e); }

  return NextResponse.json(out);
}
