"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

const BRAND = "#142e1f";
const BRAND_LIGHT = "#2d5741";
const GOLD = "#c9a227";
const BG = "#f7f6f3";

const eur = (n: any, d = 0) =>
  n == null || isNaN(Number(n)) ? "—"
  : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: d }).format(Number(n));
const num = (n: any) => n == null ? "—" : new Intl.NumberFormat("fr-FR").format(Number(n));
const pct = (n: any) => n == null ? "—" : `${Number(n).toLocaleString("fr-FR")} %`;

const TABS = [
  { id: "overview", label: "Vue d'ensemble" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "meta", label: "Ads · Meta" },
  { id: "klaviyo", label: "CRM · Klaviyo" },
];

const PRESETS = [
  { label: "7 j", days: 7 },
  { label: "30 j", days: 30 },
  { label: "90 j", days: 90 },
  { label: "365 j", days: 365 },
];

function iso(d: Date) { return d.toISOString().slice(0, 10); }

export default function Dashboard() {
  const [tab, setTab] = useState("overview");
  const [to, setTo] = useState(iso(new Date()));
  const [from, setFrom] = useState(iso(new Date(Date.now() - 29 * 864e5)));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true); setError(null);
    fetch(`/api/dashboard?tab=${tab}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [tab, from, to]);

  function setPreset(days: number) {
    setTo(iso(new Date()));
    setFrom(iso(new Date(Date.now() - (days - 1) * 864e5)));
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "system-ui, -apple-system, sans-serif", color: "#1a1a1a" }}>
      {/* Header */}
      <header style={{ background: BRAND, color: "#fff", padding: "20px 32px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 0.5 }}>ENDRO COSMÉTIQUES</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>Dashboard analytics</div>
          </div>
          <DateBar {...{ from, to, setFrom, setTo, setPreset }} />
        </div>
      </header>

      {/* Tabs */}
      <nav style={{ background: "#fff", borderBottom: "1px solid #e6e3dd", padding: "0 32px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 4 }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: "14px 20px", border: "none", background: "none", cursor: "pointer",
                fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? BRAND : "#7a7770",
                borderBottom: tab === t.id ? `3px solid ${BRAND}` : "3px solid transparent",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: 32 }}>
        {loading && <Info>Chargement…</Info>}
        {error && <Info>Aucune donnée pour le moment. Lance une synchronisation pour remplir le dashboard.<br /><span style={{ fontSize: 12, opacity: 0.6 }}>({error})</span></Info>}
        {!loading && !error && data && (
          <>
            {tab === "overview" && <Overview data={data} />}
            {tab === "ecommerce" && <Ecommerce data={data} />}
            {tab === "meta" && <Meta data={data} />}
            {tab === "klaviyo" && <Klaviyo data={data} />}
          </>
        )}
      </main>
      <footer style={{ textAlign: "center", padding: 24, color: "#a8a49c", fontSize: 12 }}>
        Endro Cosmétiques · données Shopify · Meta · Klaviyo
      </footer>
    </div>
  );
}

function DateBar({ from, to, setFrom, setTo, setPreset }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {PRESETS.map((p) => (
        <button key={p.label} onClick={() => setPreset(p.days)}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)",
            background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", fontSize: 13 }}>
          {p.label}
        </button>
      ))}
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
        style={{ padding: "6px 8px", borderRadius: 6, border: "none", fontSize: 13 }} />
      <span style={{ color: "#fff", opacity: 0.6 }}>→</span>
      <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
        style={{ padding: "6px 8px", borderRadius: 6, border: "none", fontSize: 13 }} />
    </div>
  );
}

function Info({ children }: any) {
  return <div style={{ background: "#fff", border: "1px solid #e6e3dd", borderRadius: 12, padding: 40, textAlign: "center", color: "#7a7770" }}>{children}</div>;
}

function Card({ children, span = 1 }: any) {
  return <div style={{ background: "#fff", border: "1px solid #e6e3dd", borderRadius: 12, padding: 20, gridColumn: `span ${span}` }}>{children}</div>;
}

function Kpi({ label, value, sub, hint }: any) {
  return (
    <Card>
      <div style={{ fontSize: 11, color: "#9a968e", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: BRAND, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: "#7a7770", marginTop: 4 }}>{sub}</div>}
      {hint && <div style={{ fontSize: 11, color: "#b8b4ac", marginTop: 6, fontStyle: "italic" }}>{hint}</div>}
    </Card>
  );
}

function SectionTitle({ children }: any) {
  return <h2 style={{ color: BRAND, fontSize: 16, margin: "28px 0 14px" }}>{children}</h2>;
}

function grid(cols: number) {
  return { display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 16 } as const;
}

// ---------------- OVERVIEW ----------------
function Overview({ data }: any) {
  const k = data.kpis;
  const series = (data.series ?? []).map((d: any) => ({
    date: new Date(d.date_key).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    ca: Number(d.ca_ht), meta: Number(d.meta_ca),
  }));
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="CA HT" value={eur(k.ca_ht)} />
        <Kpi label="Commandes" value={num(k.orders)} sub={`${k.pct_new}% nouveaux`} />
        <Kpi label="AOV HT" value={eur(k.aov_ht, 2)} />
        <Kpi label="ROAS Meta" value={k.meta_roas ?? "—"} />
        <Kpi label="Dépenses Meta" value={eur(k.meta_spend)} />
        <Kpi label="CA attribué Meta" value={eur(k.meta_attributed_ca)} />
        <Kpi label="CA attribué Klaviyo" value={eur(k.klaviyo_ca)} />
        <Kpi label="MER" value={k.mer ?? "—"} hint="CA total / dépenses ads" />
        <Kpi label="CAC" value={eur(k.cac, 2)} hint="dépenses / nouveaux clients" />
      </div>
      <SectionTitle>CA HT quotidien vs CA attribué Meta</SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: any) => eur(v)} />
            <Line type="monotone" dataKey="ca" stroke={BRAND} strokeWidth={2} dot={false} name="CA HT" />
            <Line type="monotone" dataKey="meta" stroke={GOLD} strokeWidth={1.5} dot={false} name="CA attr. Meta" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

// ---------------- E-COMMERCE ----------------
function Ecommerce({ data }: any) {
  const c = data.clients ?? {};
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="CA HT" value={eur(c.ca)} />
        <Kpi label="Commandes" value={num(c.total)} />
        <Kpi label="Nouveaux clients" value={num(c.new_orders)} sub={c.total > 0 ? `${(100 * c.new_orders / c.total).toFixed(1)}%` : "—"} />
        <Kpi label="Remises accordées" value={eur(c.discounts)} />
      </div>

      <SectionTitle>Top 10 produits par CA</SectionTitle>
      <Card><Table rows={data.topByCa} cols={[
        ["title", "Produit"], ["categorie", "Catégorie"], ["ca_ht", "CA HT", eur], ["units", "Unités", num],
      ]} /></Card>

      <SectionTitle>Top 10 produits par unités</SectionTitle>
      <Card><Table rows={data.topByUnits} cols={[
        ["title", "Produit"], ["units", "Unités", num], ["ca_ht", "CA HT", eur],
      ]} /></Card>

      <div style={{ ...grid(2), marginTop: 8 }}>
        <div>
          <SectionTitle>CA par catégorie</SectionTitle>
          <Card><Table rows={data.byCategory} cols={[["categorie", "Catégorie"], ["ca_ht", "CA HT", eur]]} /></Card>
        </div>
        <div>
          <SectionTitle>CA par source (attribution)</SectionTitle>
          <Card><Table rows={data.bySource} cols={[
            ["source", "Source"], ["orders", "Cmd", num], ["ca_ht", "CA HT", eur], ["aov", "AOV", (v:any)=>eur(v,0)],
          ]} /></Card>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#b8b4ac", marginTop: 16, fontStyle: "italic" }}>
        Sessions, taux de rebond et funnel détaillé nécessitent une connexion GA4 ou ShopifyQL (Plus) — à brancher ensuite.
      </p>
    </>
  );
}

// ---------------- META ----------------
function Meta({ data }: any) {
  const t = data.totals;
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="Dépenses" value={eur(t.spend)} />
        <Kpi label="ROAS" value={t.roas ?? "—"} />
        <Kpi label="CA attribué" value={eur(t.pv)} />
        <Kpi label="Conversions" value={num(t.purchases)} />
        <Kpi label="CPA" value={eur(t.cpa, 2)} />
        <Kpi label="CPM" value={eur(t.cpm, 2)} />
        <Kpi label="CTR" value={pct(t.ctr)} />
        <Kpi label="CPC" value={eur(t.cpc, 2)} />
      </div>

      <SectionTitle>Par campagne</SectionTitle>
      <Card><Table rows={data.byCampaign} cols={[
        ["campaign_name", "Campagne"],
        ["spend", "Dépense", eur],
        ["pv", "CA attr.", eur],
        ["__roas", "ROAS", null, (r:any)=> r.spend>0 ? (r.pv/r.spend).toFixed(2) : "—"],
        ["purchases", "Conv.", num],
      ]} /></Card>

      <SectionTitle>Par publicité</SectionTitle>
      <Card><Table rows={data.byAd} cols={[
        ["ad_name", "Publicité"],
        ["campaign_name", "Campagne"],
        ["spend", "Dépense", eur],
        ["__roas", "ROAS", null, (r:any)=> r.spend>0 ? (r.pv/r.spend).toFixed(2) : "—"],
        ["__ctr", "CTR", null, (r:any)=> r.impressions>0 ? (100*r.clicks/r.impressions).toFixed(2)+" %" : "—"],
      ]} /></Card>
    </>
  );
}

// ---------------- KLAVIYO ----------------
function Klaviyo({ data }: any) {
  const t = data.totals;
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="Emails reçus" value={num(t.received)} />
        <Kpi label="Taux ouverture" value={pct(t.or)} />
        <Kpi label="Taux clic" value={pct(t.ctr)} />
        <Kpi label="CTOR" value={pct(t.ctor)} />
        <Kpi label="CA attribué" value={eur(t.revenue)} />
        <Kpi label="RPE" value={eur(t.rpe, 3)} hint="CA / email reçu" />
        <Kpi label="Commandes email" value={num(t.placed)} />
      </div>

      <SectionTitle>Performance par flow</SectionTitle>
      <Card><Table rows={data.byFlow} cols={[
        ["flow_name", "Flow"], ["orders", "Commandes", num], ["rev", "CA attr.", eur],
      ]} /></Card>

      <SectionTitle>Détail par évènement</SectionTitle>
      <Card><Table rows={data.byMetric} cols={[
        ["metric", "Évènement"], ["n", "Volume", num], ["rev", "CA", eur],
      ]} /></Card>
      <p style={{ fontSize: 12, color: "#b8b4ac", marginTop: 16, fontStyle: "italic" }}>
        SMS et WhatsApp : à brancher via Klaviyo SMS / Yotpo.
      </p>
    </>
  );
}

// ---------------- TABLE générique ----------------
function Table({ rows, cols }: { rows: any[]; cols: any[] }) {
  if (!rows || rows.length === 0) return <div style={{ color: "#9a968e", fontSize: 14 }}>Aucune donnée sur la période.</div>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${BRAND}` }}>
          {cols.map((col, i) => (
            <th key={i} style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 6px", color: BRAND, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.3 }}>
              {col[1]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} style={{ borderBottom: "1px solid #f0ede7" }}>
            {cols.map((col, ci) => {
              const [key, , fmt, compute] = col;
              let val = compute ? compute(r) : r[key];
              if (fmt && !compute) val = fmt(val);
              return (
                <td key={ci} style={{ textAlign: ci === 0 ? "left" : "right", padding: "8px 6px", color: ci === 0 ? "#1a1a1a" : "#4a4740" }}>
                  {val ?? "—"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
