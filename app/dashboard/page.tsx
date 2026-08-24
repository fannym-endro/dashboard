import { getKpiTotals, getDailyKpis, getTopProducts, getChannelSplit } from "@/lib/queries";
import { RevenueChart } from "./RevenueChart";

// Rendu à la demande (lecture DB), pas de pré-génération statique au build.
export const dynamic = "force-dynamic";

const BRAND = "#142e1f";
const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);

export default async function DashboardPage() {
  const [[totals], daily, top, channels] = await Promise.all([
    getKpiTotals(30),
    getDailyKpis(30),
    getTopProducts(30),
    getChannelSplit(30),
  ]);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ color: BRAND }}>Dashboard Endro — 30 jours</h1>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
        <Kpi label="CA HT" value={eur(totals.ca_ht)} />
        <Kpi label="Commandes" value={`${totals.orders ?? 0} (${totals.pct_new ?? 0}% new)`} />
        <Kpi label="AOV HT" value={eur(totals.aov_ht)} />
        <Kpi label="ROAS Meta" value={totals.meta_roas ?? "—"} />
        <Kpi label="Dépense Meta" value={eur(totals.meta_spend)} />
        <Kpi label="CA attribué Meta" value={eur(totals.meta_attributed_ca)} />
        <Kpi label="CA attribué Klaviyo" value={eur(totals.klaviyo_attributed_ca)} />
      </section>

      <h2 style={{ color: BRAND, marginTop: 32 }}>CA HT quotidien</h2>
      <RevenueChart data={daily as any[]} brand={BRAND} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 32 }}>
        <div>
          <h2 style={{ color: BRAND }}>Top produits</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {top.map((p: any, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 6 }}>{p.title ?? "—"}</td>
                  <td style={{ padding: 6, color: "#888" }}>{p.categorie}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{eur(p.ca_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h2 style={{ color: BRAND }}>Répartition par source</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {channels.map((c: any, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: 6 }}>{c.source}</td>
                  <td style={{ padding: 6, textAlign: "right" }}>{eur(c.ca_ht)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#142e1f" }}>{value}</div>
    </div>
  );
}
