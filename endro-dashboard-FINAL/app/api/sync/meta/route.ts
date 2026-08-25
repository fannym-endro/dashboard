import { NextResponse } from "next/server";
import { upsert } from "@/lib/db";
import { assertCron, ensureDate } from "@/lib/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ACCOUNT = "act_1036120010066341";           // ton compte Meta
const TOKEN = process.env.META_ACCESS_TOKEN;      // long-lived system user token
const API = "v21.0";

// ⚠️ Fenêtre d'attribution FIGÉE. Sans ça, Meta renvoie sa fenêtre par défaut
// (variable) et ton ROAS bouge sans raison. On force 7d click + 1d view.
const ATTRIBUTION = JSON.stringify(["7d_click", "1d_view"]);

export async function GET(req: Request) {
  try {
    assertCron(req);
  } catch (e) {
    return e as Response;
  }

  // Fenêtre glissante : on re-synchronise les 7 derniers jours à chaque run
  // (les conversions remontent avec du retard => on écrase les valeurs).
  const until = new Date();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const timeRange = JSON.stringify({
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  });

  const fields = [
    "ad_id",
    "ad_name",
    "adset_name",
    "campaign_name",
    "spend",
    "impressions",
    "clicks",
    "actions",
    "action_values",
  ].join(",");

  let url =
    `https://graph.facebook.com/${API}/${ACCOUNT}/insights` +
    `?level=ad&time_increment=1&time_range=${encodeURIComponent(timeRange)}` +
    `&action_attribution_windows=${encodeURIComponent(ATTRIBUTION)}` +
    `&fields=${fields}&limit=200&access_token=${TOKEN}`;

  let processed = 0;

  while (url) {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));

    for (const r of json.data) {
      const dateKey = r.date_start; // time_increment=1 => 1 ligne par jour
      await ensureDate(dateKey);

      const purchases = extractAction(r.actions, "purchase");
      const purchaseValue = extractAction(r.action_values, "purchase");
      const atc = extractAction(r.actions, "add_to_cart");

      await upsert(
        "raw_meta_insights",
        { ad_id: r.ad_id, date_key: dateKey, payload: JSON.stringify(r) },
        ["ad_id", "date_key"]
      );

      await upsert(
        "fct_ad_spend",
        {
          ad_id: r.ad_id,
          date_key: dateKey,
          campaign_name: r.campaign_name,
          adset_name: r.adset_name,
          ad_name: r.ad_name,
          spend: parseFloat(r.spend ?? "0"),
          impressions: parseInt(r.impressions ?? "0"),
          clicks: parseInt(r.clicks ?? "0"),
          purchases,
          purchase_value: purchaseValue,
          add_to_cart: atc,
        },
        ["ad_id", "date_key"]
      );
      processed++;
    }

    url = json.paging?.next ?? "";
  }

  return NextResponse.json({ ok: true, processed });
}

// actions/action_values sont des tableaux {action_type, value}
function extractAction(arr: any[] | undefined, type: string): number {
  if (!arr) return 0;
  const hit = arr.find((a) => a.action_type === type);
  return hit ? parseFloat(hit.value) : 0;
}
