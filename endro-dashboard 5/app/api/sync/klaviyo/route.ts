import { NextResponse } from "next/server";
import { upsert } from "@/lib/db";
import { assertCron, ensureDate } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const KEY = process.env.KLAVIYO_API_KEY;     // Private API key (pk_...)
const REV = "2024-10-15";                     // version de révision API

// On récupère les events des dernières 48h (rattrapage) et on upsert par event_id.
export async function GET(req: Request) {
  try {
    assertCron(req);
  } catch (e) {
    return e as Response;
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 2);
  const filter = `greater-than(datetime,${since.toISOString()})`;

  // include=metric permet de récupérer le nom du metric (Placed Order, etc.)
  let url =
    `https://a.klaviyo.com/api/events/?filter=${encodeURIComponent(filter)}` +
    `&include=metric&fields[metric]=name&sort=-datetime`;

  let processed = 0;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Klaviyo-API-Key ${KEY}`,
        accept: "application/json",
        revision: REV,
      },
    });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));

    // Table de correspondance metric_id -> name depuis le bloc "included"
    const metricNames: Record<string, string> = {};
    for (const inc of json.included ?? []) {
      if (inc.type === "metric") metricNames[inc.id] = inc.attributes.name;
    }

    for (const ev of json.data) {
      const attrs = ev.attributes;
      const dateKey = attrs.datetime.slice(0, 10);
      await ensureDate(dateKey);

      const metricId = ev.relationships?.metric?.data?.id;
      const metricName = metricNames[metricId] ?? "Unknown";
      const props = attrs.event_properties ?? {};

      await upsert(
        "raw_klaviyo_events",
        { event_id: ev.id, payload: JSON.stringify(ev) },
        ["event_id"]
      );

      await upsert(
        "fct_email_events",
        {
          event_id: ev.id,
          date_key: dateKey,
          customer_email_hash: null, // enrichir via profile si besoin de jointure
          metric: metricName,
          flow_id: props.$flow ?? null,
          flow_name: props["Flow Name"] ?? null,
          campaign_id: props.$message ?? null,
          campaign_name: props["Campaign Name"] ?? null,
          // revenu HT attribué : $value est TTC chez Klaviyo => /1.2 si TVA 20%
          revenue_ht:
            metricName === "Placed Order"
              ? +(((props.$value ?? attrs.value ?? 0) as number) / 1.2).toFixed(2)
              : 0,
        },
        ["event_id"]
      );
      processed++;
    }

    url = json.links?.next ?? "";
  }

  return NextResponse.json({ ok: true, processed });
}
