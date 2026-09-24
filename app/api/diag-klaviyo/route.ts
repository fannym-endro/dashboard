import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};
  const ids = ["Ui2J6N", "VTrX2s", "Y8Hw8M", "RqivuM", "VpfLh4"];

  // Récupérer chaque flow par son id directement
  for (const id of ids) {
    try {
      const res = await fetch(`https://a.klaviyo.com/api/flows/${id}/?fields[flow]=name,status,archived`, { headers: h(), cache: "no-store" });
      const j = await res.json();
      out[id] = j.data ? { name: j.data.attributes?.name, status: j.data.attributes?.status, archived: j.data.attributes?.archived } : { erreur: j.errors };
    } catch (e: any) { out[id] = { erreur: String(e?.message ?? e) }; }
  }

  // Combien de flows au total renvoie la liste ?
  try {
    let count = 0, url: string | null = "https://a.klaviyo.com/api/flows/?fields[flow]=name";
    let pages = 0;
    while (url && pages < 100) {
      const res: any = await fetch(url, { headers: h(), cache: "no-store" });
      const j: any = await res.json();
      count += (j.data ?? []).length;
      url = j.links?.next ?? null;
      pages++;
    }
    out.total_flows_listes = count;
  } catch (e: any) { out.total_err = String(e?.message ?? e); }

  return NextResponse.json(out);
}
