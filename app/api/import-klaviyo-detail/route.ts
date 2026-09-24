import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const KEY = process.env.KLAVIYO_API_KEY;
const REV = "2024-10-15";
const h = () => ({ Authorization: `Klaviyo-API-Key ${KEY}`, accept: "application/json", revision: REV, "content-type": "application/json" });

const STATS = ["recipients", "opens_unique", "clicks_unique", "conversion_value"];

async function report(kind: "campaign" | "flow", timeframeKey: string) {
  const body = { data: { type: `${kind}-values-report`, attributes: {
    timeframe: { key: timeframeKey },
    statistics: STATS,
    conversion_metric_id: "VKWrzv",
  } } };
  const res = await fetch(`https://a.klaviyo.com/api/${kind}-values-reports/`, { method: "POST", headers: h(), body: JSON.stringify(body), cache: "no-store" });
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors));
  return j.data?.attributes?.results ?? [];
}

async function campaignNames(): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const channel of ["email", "sms"]) {
    let url: string | null = `https://a.klaviyo.com/api/campaigns/?filter=equals(messages.channel,'${channel}')&fields[campaign]=name&page[size]=100`;
    let pages = 0;
    while (url && pages < 100) {
      const res: any = await fetch(url, { headers: h(), cache: "no-store" });
      const j: any = await res.json();
      for (const c of (j.data ?? [])) names[c.id] = c.attributes?.name ?? c.id;
      url = j.links?.next ?? null;
      pages++;
    }
  }
  return names;
}

async function flowNames(): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  let url: string | null = "https://a.klaviyo.com/api/flows/?fields[flow]=name&page[size]=50";
  let pages = 0;
  while (url && pages < 100) {
    const res: any = await fetch(url, { headers: h(), cache: "no-store" });
    const j: any = await res.json();
    for (const f of (j.data ?? [])) names[f.id] = f.attributes?.name ?? f.id;
    url = j.links?.next ?? null;
    pages++;
  }
  return names;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tf = url.searchParams.get("timeframe") ?? "last_12_months";
  const out: any = { timeframe: tf };

  try {
    // --- CAMPAGNES ---
    const camps = await report("campaign", tf);
    const cNames = await campaignNames();
    const cRows: any[] = [];
    for (const r of camps) {
      const id = r.groupings?.campaign_id;
      if (!id) continue;
      const s = r.statistics ?? {};
      cRows.push([id, cNames[id] ?? id, Math.round(s.recipients ?? 0),
        Math.round(s.opens_unique ?? 0), Math.round(s.clicks_unique ?? 0),
        s.recipients ? (s.opens_unique / s.recipients) : 0,
        s.recipients ? (s.clicks_unique / s.recipients) : 0,
        Math.round((s.conversion_value ?? 0) * 100) / 100]);
    }
    if (cRows.length) {
      const vals = cRows.map((_, i) => { const b = i*8; return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`; }).join(",");
      await pool.query(
        `INSERT INTO agg_klaviyo_campaign (campaign_id,name,recipients,opens_unique,clicks_unique,open_rate,click_rate,revenue)
         VALUES ${vals}
         ON CONFLICT (campaign_id) DO UPDATE SET name=EXCLUDED.name, recipients=EXCLUDED.recipients,
           opens_unique=EXCLUDED.opens_unique, clicks_unique=EXCLUDED.clicks_unique,
           open_rate=EXCLUDED.open_rate, click_rate=EXCLUDED.click_rate, revenue=EXCLUDED.revenue, updated_at=now()`,
        cRows.flat());
    }
    out.campagnes = cRows.length;

    // --- FLOWS (regroupés par flow_id) ---
    const flows = await report("flow", tf);
    const fNames = await flowNames();
    const agg: Record<string, any> = {};
    for (const r of flows) {
      const id = r.groupings?.flow_id;
      if (!id) continue;
      const s = r.statistics ?? {};
      if (!agg[id]) agg[id] = { recipients: 0, opens: 0, clicks: 0, rev: 0 };
      agg[id].recipients += s.recipients ?? 0;
      agg[id].opens += s.opens_unique ?? 0;
      agg[id].clicks += s.clicks_unique ?? 0;
      agg[id].rev += s.conversion_value ?? 0;
    }
    const fRows = Object.entries(agg).map(([id, a]: any) => [
      id, fNames[id] ?? id, Math.round(a.recipients), Math.round(a.opens), Math.round(a.clicks),
      a.recipients ? (a.opens / a.recipients) : 0, a.recipients ? (a.clicks / a.recipients) : 0,
      Math.round(a.rev * 100) / 100]);
    if (fRows.length) {
      const vals = fRows.map((_, i) => { const b = i*8; return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`; }).join(",");
      await pool.query(
        `INSERT INTO agg_klaviyo_flow (flow_id,name,recipients,opens_unique,clicks_unique,open_rate,click_rate,revenue)
         VALUES ${vals}
         ON CONFLICT (flow_id) DO UPDATE SET name=EXCLUDED.name, recipients=EXCLUDED.recipients,
           opens_unique=EXCLUDED.opens_unique, clicks_unique=EXCLUDED.clicks_unique,
           open_rate=EXCLUDED.open_rate, click_rate=EXCLUDED.click_rate, revenue=EXCLUDED.revenue, updated_at=now()`,
        fRows.flat());
    }
    out.flows = fRows.length;
    out.ok = true;
  } catch (e: any) { out.error = String(e?.message ?? e); }
  return NextResponse.json(out);
}
