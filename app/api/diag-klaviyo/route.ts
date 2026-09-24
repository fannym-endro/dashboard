import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

export async function GET() {
  const out: any = {};

  const tryUrl = async (label: string, url: string) => {
    try {
      const res = await fetch(url, { headers: h(), cache: "no-store" });
      const j = await res.json();
      out[label] = {
        status: res.status,
        nb: j.data?.length ?? 0,
        exemple: j.data?.slice(0, 2)?.map((c: any) => ({ id: c.id, name: c.attributes?.name })),
        erreurs: j.errors,
      };
    } catch (e: any) { out[label] = { erreur: String(e?.message ?? e) }; }
  };

  // Variante A : filtre email (celle qui échoue peut-être)
  await tryUrl("A_filtre_email", "https://a.klaviyo.com/api/campaigns/?filter=equals(messages.channel,'email')&fields[campaign]=name&page[size]=3");
  // Variante B : sans le fields
  await tryUrl("B_sans_fields", "https://a.klaviyo.com/api/campaigns/?filter=equals(messages.channel,'email')&page[size]=3");
  // Variante C : filtre avec guillemets doubles
  await tryUrl("C_guillemets_doubles", `https://a.klaviyo.com/api/campaigns/?filter=equals(messages.channel,"email")&page[size]=3`);

  return NextResponse.json(out);
}
