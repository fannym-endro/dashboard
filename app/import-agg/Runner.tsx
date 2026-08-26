"use client";
import { useState } from "react";
const BRAND = "#142e1f";

// Liste des mois de 2025-01 à aujourd'hui
function months(): string[] {
  const out: string[] = [];
  const now = new Date();
  let y = 2025, m = 1;
  while (y < now.getUTCFullYear() || (y === now.getUTCFullYear() && m <= now.getUTCMonth() + 1)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export default function Runner() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  function add(s: string) { setLog((l) => [s, ...l].slice(0, 60)); }

  async function start() {
    setRunning(true); setLog([]);
    const ms = months();
    add(`Import agrégé de ${ms.length} mois (2025 → aujourd'hui)…`);
    for (const mo of ms) {
      try {
        const res = await fetch(`/api/import-agg?month=${mo}`);
        const d = await res.json();
        if (d.error) add(`❌ ${mo} : ${d.error}`);
        else add(`✅ ${mo} — ${d.jours ?? 0} jours · ${d.lignes_produits ?? 0} produits · ${d.lignes_collections ?? 0} collections`);
      } catch (e: any) {
        add(`❌ ${mo} : ${String(e?.message ?? e)}`);
      }
    }
    add("🎉 Import terminé.");
    setRunning(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f3", fontFamily: "system-ui, sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: BRAND }}>Import agrégé (mois par mois)</h1>
        <p style={{ color: "#7a7770" }}>Clique sur Démarrer. Chaque mois est importé sans dépasser la limite de Shopify. Garde l'onglet ouvert.</p>
        <button onClick={start} disabled={running}
          style={{ background: running ? "#999" : BRAND, color: "#fff", border: "none", borderRadius: 8,
            padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: running ? "default" : "pointer", marginBottom: 20 }}>
          {running ? "Import en cours…" : "Démarrer l'import agrégé"}
        </button>
        <div style={{ background: "#fff", border: "1px solid #e6e3dd", borderRadius: 12, padding: 16, fontSize: 13, fontFamily: "monospace", color: "#4a4740" }}>
          {log.length === 0 ? "En attente…" : log.map((l, i) => <div key={i} style={{ padding: "2px 0" }}>{l}</div>)}
        </div>
        <p style={{ marginTop: 20 }}><a href="/dashboard" style={{ color: BRAND, fontWeight: 600 }}>→ Voir le dashboard</a></p>
      </div>
    </div>
  );
}
