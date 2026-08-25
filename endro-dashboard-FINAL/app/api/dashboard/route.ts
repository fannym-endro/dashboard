import { NextResponse } from "next/server";
import { getOverview, getDailySeries, getEcommerce, getMeta, getKlaviyo } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Sert les données d'un onglet pour une plage de dates.
// Appelé par l'interface quand on change d'onglet ou de dates.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") ?? "overview";
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const from =
    url.searchParams.get("from") ??
    new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const range = { from, to };

  try {
    if (tab === "overview") {
      const [kpis, series] = await Promise.all([getOverview(range), getDailySeries(range)]);
      return NextResponse.json({ kpis, series });
    }
    if (tab === "ecommerce") return NextResponse.json(await getEcommerce(range));
    if (tab === "meta") return NextResponse.json(await getMeta(range));
    if (tab === "klaviyo") return NextResponse.json(await getKlaviyo(range));
    return NextResponse.json({ error: "unknown tab" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
