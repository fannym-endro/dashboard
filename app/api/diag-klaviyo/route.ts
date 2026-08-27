import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "KLAVIYO_API_KEY manquant" }, { status: 500 });
  }

  const out: any = {};
  const all: any[] = [];
  let url = "https://a.klaviyo.com/api/metrics/?page[size]=100";
  let pages = 0;

  try {
    while (url && pages < 20) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Klaviyo-API-Key ${apiKey}`,
          revision: "2024-10-15",
          accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json(
          { error: `Erreur Klaviyo ${res.status}`, detail: text },
          { status: 500 }
        );
      }

      const json = await res.json();
      const items = json.data || [];
      for (const item of items) {
        all.push({
          id: item.id,
          name: item.attributes?.name,
          category: item.attributes?.integration?.category,
        });
      }

      url = json.links?.next || null;
      pages++;
    }

    out.total_metriques = all.length;
    out.pages_parcourues = pages;
    out.email = all.filter((m: any) => m.category === "email");
    out.sms = all.filter((m: any) => m.category === "sms");
    out.autres = all.filter((m: any) => m.category !== "email" && m.category !== "sms");
    out.toutes = all;

    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
