"use client";
import { useEffect, useState, Component } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";

// Barrière d'erreur : si un onglet plante, on montre un message au lieu d'une page blanche.
class ErrorBoundary extends Component<{ children: any }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidUpdate(prev: any) { if (prev.children !== this.props.children && this.state.hasError) this.setState({ hasError: false }); }
  render() {
    if (this.state.hasError)
      return <div style={{ background: "#fff", border: "1px solid #e6e3dd", borderRadius: 12, padding: 40, textAlign: "center", color: "#7a7770" }}>
        Cet onglet n'a pas pu s'afficher (données incomplètes). Essaie une autre période ou lance une synchronisation.
      </div>;
    return this.props.children;
  }
}

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
  { label: "Hier", days: 1, offset: 1 },
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

  function setPreset(days: number, offset = 0) {
    const end = new Date(Date.now() - offset * 864e5);
    setTo(iso(end));
    setFrom(iso(new Date(end.getTime() - (days - 1) * 864e5)));
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
          <ErrorBoundary>
            {tab === "overview" && <Overview data={data} />}
            {tab === "ecommerce" && <Ecommerce data={data} />}
            {tab === "meta" && <Meta data={data} />}
            {tab === "klaviyo" && <Klaviyo data={data} />}
          </ErrorBoundary>
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
        <button key={p.label} onClick={() => setPreset(p.days, (p as any).offset ?? 0)}
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

function Delta({ v, label }: { v: number | null; label: string }) {
  if (v == null) return <span style={{ color: "#c4c0b8" }}>{label} —</span>;
  const up = v >= 0;
  return <span style={{ color: up ? "#2e7d52" : "#c0392b" }}>{label} {up ? "▲" : "▼"} {Math.abs(v)}%</span>;
}

function Kpi({ label, value, sub, hint, cmp }: any) {
  return (
    <Card>
      <div style={{ fontSize: 11, color: "#9a968e", textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: BRAND, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: "#7a7770", marginTop: 4 }}>{sub}</div>}
      {cmp && (
        <div style={{ fontSize: 11, marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
          <Delta v={cmp.vs_prev} label="vs préc." />
          <Delta v={cmp.vs_yoy} label="vs N-1" />
        </div>
      )}
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
  const k = data?.kpis ?? {};
  const series = (data.series ?? []).map((d: any) => ({
    date: new Date(d.date_key).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    ca: Number(d.ca_ht), sessions: Number(d.sessions),
  }));
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="CA" value={eur(k.ca_ht)} cmp={k.cmp?.ca} />
        <Kpi label="Commandes" value={num(k.orders)} cmp={k.cmp?.orders} />
        <Kpi label="AOV" value={eur(k.aov_ht, 2)} cmp={k.cmp?.aov} />
        <Kpi label="Sessions" value={num(k.sessions)} cmp={k.cmp?.sessions} />
        <Kpi label="Taux conversion" value={k.cvr != null ? k.cvr + " %" : "—"} cmp={k.cmp?.cvr} />
        <Kpi label="ROAS Meta" value={k.meta_roas ?? "—"} />
        <Kpi label="Dépenses Meta" value={eur(k.meta_spend)} />
        <Kpi label="CA attribué Meta" value={eur(k.meta_attributed_ca)} />
        <Kpi label="CA attribué Klaviyo" value={eur(k.klaviyo_ca)} />
        <Kpi label="MER" value={k.mer ?? "—"} hint="CA / dépenses ads" />
      </div>
      <SectionTitle>CA quotidien</SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v: any) => eur(v)} />
            <Line type="monotone" dataKey="ca" stroke={BRAND} strokeWidth={2} dot={false} name="CA" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}

// ---------------- E-COMMERCE ----------------
function Ecommerce({ data }: any) {
  const c = data?.totals ?? {};
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="CA total" value={eur(c.ca)} cmp={data?.cmp?.ca} />
        <Kpi label="CA net" value={eur(c.net)} cmp={data?.cmp?.net} />
        <Kpi label="Commandes" value={num(c.orders)} cmp={data?.cmp?.orders} />
        <Kpi label="Sessions" value={num(c.sessions)} cmp={data?.cmp?.sessions} />
        <Kpi label="Taux conversion" value={c.cvr != null ? Number(c.cvr).toFixed(2) + " %" : "—"} cmp={data?.cmp?.cvr} />
        <Kpi label="Remises" value={eur(c.discounts)} cmp={data?.cmp?.discounts} />
        <Kpi label="Retours" value={eur(c.returns)} cmp={data?.cmp?.returns} />
      </div>

      <SectionTitle>Top 100 produits par CA</SectionTitle>
      <Card><Table rows={data?.topByCa ?? []} cols={[
        ["title", "Produit"], ["categorie", "Catégorie"], ["ca_ht", "CA HT", eur], ["units", "Unités", num],
      ]} /></Card>

      <SectionTitle>Top 100 produits par unités</SectionTitle>
      <Card><Table rows={data?.topByUnits ?? []} cols={[
        ["title", "Produit"], ["units", "Unités", num], ["ca_ht", "CA HT", eur],
      ]} /></Card>

      <SectionTitle>CA par collection</SectionTitle>
      <Card><Table rows={data?.byCategory ?? []} cols={[["categorie", "Collection"], ["ca_ht", "CA net", eur]]} /></Card>
      <p style={{ fontSize: 12, color: "#b8b4ac", marginTop: 8, fontStyle: "italic" }}>
        Un produit peut appartenir à plusieurs collections : le total par collection peut donc dépasser le CA global.
      </p>
    </>
  );
}

// ---------------- META ----------------
function Meta({ data }: any) {
  const t = data?.totals ?? {};
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="Dépenses" value={eur(t.spend)} cmp={data?.cmp?.spend} />
        <Kpi label="ROAS" value={t.roas ?? "—"} cmp={data?.cmp?.roas} />
        <Kpi label="CA attribué" value={eur(t.pv)} cmp={data?.cmp?.pv} />
        <Kpi label="Conversions" value={num(t.purchases)} cmp={data?.cmp?.purchases} />
        <Kpi label="CPA" value={eur(t.cpa, 2)} cmp={data?.cmp?.cpa} />
        <Kpi label="CPM" value={eur(t.cpm, 2)} cmp={data?.cmp?.cpm} />
        <Kpi label="CTR" value={pct(t.ctr)} cmp={data?.cmp?.ctr} />
        <Kpi label="CPC" value={eur(t.cpc, 2)} cmp={data?.cmp?.cpc} />
      </div>

      <SectionTitle>Par campagne</SectionTitle>
      <Card><Table rows={data?.byCampaign ?? []} cols={[
        ["campaign_name", "Campagne"],
        ["spend", "Dépense", eur],
        ["pv", "CA attr.", eur],
        ["__roas", "ROAS", null, (r:any)=> Number(r.spend)>0 ? (Number(r.pv)/Number(r.spend)).toFixed(2) : "—"],
        ["purchases", "Conv.", num],
      ]} /></Card>

      <SectionTitle>Par publicité</SectionTitle>
      <Card><Table rows={data?.byAd ?? []} cols={[
        ["ad_name", "Publicité"],
        ["campaign_name", "Campagne"],
        ["spend", "Dépense", eur],
        ["__roas", "ROAS", null, (r:any)=> Number(r.spend)>0 ? (Number(r.pv)/Number(r.spend)).toFixed(2) : "—"],
        ["__ctr", "CTR", null, (r:any)=> Number(r.impressions)>0 ? (100*Number(r.clicks)/Number(r.impressions)).toFixed(2)+" %" : "—"],
      ]} /></Card>
    </>
  );
}

// ---------------- KLAVIYO ----------------
function Klaviyo({ data }: any) {
  const t = data?.totals ?? {};
  return (
    <>
      <div style={grid(4)}>
        <Kpi label="Emails reçus" value={num(t.received)} cmp={data?.cmp?.received} />
        <Kpi label="Taux ouverture" value={pct(t.or)} cmp={data?.cmp?.or} />
        <Kpi label="Taux clic" value={pct(t.ctr)} cmp={data?.cmp?.ctr} />
        <Kpi label="CTOR" value={pct(t.ctor)} cmp={data?.cmp?.ctor} />
        <Kpi label="CA attribué" value={eur(t.revenue)} cmp={data?.cmp?.revenue} />
        <Kpi label="RPE" value={eur(t.rpe, 3)} hint="CA / email reçu" cmp={data?.cmp?.rpe} />
        <Kpi label="Commandes email" value={num(t.placed)} cmp={data?.cmp?.placed} />
      </div>

      <SectionTitle>Performance par flow</SectionTitle>
      <Card><Table rows={data?.byFlow ?? []} cols={[
        ["flow_name", "Flow"], ["orders", "Commandes", num], ["rev", "CA attr.", eur],
      ]} /></Card>

      <SectionTitle>Détail par évènement</SectionTitle>
      <Card><Table rows={data?.byMetric ?? []} cols={[
        ["metric", "Évènement"], ["n", "Volume", num], ["rev", "CA", eur],
      ]} /></Card>
      <p style={{ fontSize: 12, color: "#b8b4ac", marginTop: 16, fontStyle: "italic" }}>
        SMS et WhatsApp : à brancher via Klaviyo SMS / Yotpo.
      </p>
    </>
  );
}

// ---------------- TABLE générique (triable + filtrable) ----------------
function Table({ rows, cols }: { rows: any[]; cols: any[] }) {
  const [sortKey, setSortKey] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState("");
  const [visible, setVisible] = useState(10);

  if (!rows || rows.length === 0)
    return <div style={{ color: "#9a968e", fontSize: 14 }}>Aucune donnée sur la période.</div>;

  // valeur brute d'une cellule pour le tri
  const rawVal = (r: any, col: any) => {
    const [key, , , compute] = col;
    let v = compute ? compute(r) : r[key];
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
    return isNaN(n) ? String(v ?? "") : n;
  };

  let view = [...rows];
  if (filter.trim()) {
    const f = filter.toLowerCase();
    view = view.filter((r) => String(r[cols[0][0]] ?? "").toLowerCase().includes(f));
  }
  if (sortKey != null) {
    const col = cols[sortKey];
    view.sort((a, b) => {
      const va = rawVal(a, col), vb = rawVal(b, col);
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }

  function clickHeader(i: number) {
    if (sortKey === i) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(i); setSortDir("desc"); }
  }
  const shown = view.slice(0, visible);
  const restant = view.length - shown.length;

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Filtrer ${cols[0][1].toLowerCase()}…`}
        style={{ marginBottom: 10, padding: "6px 10px", borderRadius: 6, border: "1px solid #e6e3dd", fontSize: 13, width: 260 }} />
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${BRAND}` }}>
            {cols.map((col: any, i: number) => (
              <th key={i} onClick={() => clickHeader(i)}
                style={{ textAlign: i === 0 ? "left" : "right", padding: "8px 6px", color: BRAND, fontSize: 12,
                  textTransform: "uppercase", letterSpacing: 0.3, cursor: "pointer", userSelect: "none" }}>
                {col[1]}{sortKey === i ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r: any, ri: number) => (
            <tr key={ri} style={{ borderBottom: "1px solid #f0ede7" }}>
              {cols.map((col: any, ci: number) => {
                const [key, , fmt, compute] = col;
                let val: any;
                try { val = compute ? compute(r) : r[key]; if (fmt && !compute) val = fmt(val); }
                catch { val = "—"; }
                if (val == null || (typeof val === "number" && isNaN(val))) val = "—";
                if (typeof val === "object") val = String(val);
                return (
                  <td key={ci} style={{ textAlign: ci === 0 ? "left" : "right", padding: "8px 6px", color: ci === 0 ? "#1a1a1a" : "#4a4740" }}>{val}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {restant > 0 && (
        <button onClick={() => setVisible(visible + 10)}
          style={{ marginTop: 12, padding: "8px 16px", borderRadius: 6, border: `1.5px solid ${BRAND}`,
            background: "#fff", color: BRAND, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
          Voir plus (+{Math.min(10, restant)}) · {shown.length}/{view.length}
        </button>
      )}
    </div>
  );
}
