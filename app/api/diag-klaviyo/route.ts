import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};
  try {
    const all: any[] = [];
    let url: string | null = "https://a.klaviyo.com/api/metrics/";
    let pages = 0;
    while (url && pages < 20) {
      const res: any = await fetch(url, { headers: h() });
      const j: any = await res.json();
      for (const m of (j.data ?? [])) all.push({ id: m.id, name: m.attributes?.name });
      url = j.links?.next ?? null;
      pages++;
    }
    out.total_metriques = all.length;
    out.emailish = all.filter((m: any) => /order|email|placed|open|click|receive|sent|deliver/i.test(m.name || ""));
  } catch (e: any) { out.error = String(e?.message ?? e); }
  return NextResponse.json(out);
}
