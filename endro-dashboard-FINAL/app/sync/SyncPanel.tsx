"use client";
import { useState } from "react";

const BRAND = "#142e1f";

const JOBS = [
  { id: "shopify", label: "Shopify (commandes, produits, clients)" },
  { id: "meta", label: "Meta Ads (dépenses, ROAS, campagnes)" },
  { id: "klaviyo", label: "Klaviyo (emails, flows, CA attribué)" },
];

export default function SyncPanel() {
  const [state, setState] = useState<Record<string, string>>({});

  async function run(which: string) {
    setState((s) => ({ ...s, [which]: "⏳ En cours… (peut prendre 1 à 2 min)" }));
    try {
      const res = await fetch("/api/run-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ which }),
      });
      const data = await res.json();
      if (data.ok) {
        const n = data.body?.processed;
        setState((s) => ({ ...s, [which]: `✅ Terminé${n != null ? ` — ${n} éléments importés` : ""}` }));
      } else {
        setState((s) => ({ ...s, [which]: `❌ Erreur : ${data.body?.error || data.error || data.status}` }));
      }
    } catch (e: any) {
      setState((s) => ({ ...s, [which]: `❌ Erreur : ${String(e?.message ?? e)}` }));
    }
  }

  async function runAll() {
    for (const j of JOBS) await run(j.id);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f3", fontFamily: "system-ui, sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: BRAND }}>Synchronisation des données</h1>
        <p style={{ color: "#7a7770", fontSize: 15 }}>
          Clique sur chaque bouton pour importer les données dans le dashboard.
          Commence par Shopify. La première fois peut prendre une à deux minutes par source.
        </p>

        <button onClick={runAll}
          style={{ background: BRAND, color: "#fff", border: "none", borderRadius: 8, padding: "12px 20px",
            fontSize: 15, fontWeight: 600, cursor: "pointer", marginBottom: 24 }}>
          Tout synchroniser
        </button>

        {JOBS.map((j) => (
          <div key={j.id} style={{ background: "#fff", border: "1px solid #e6e3dd", borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div style={{ fontWeight: 600, color: "#1a1a1a" }}>{j.label}</div>
              <button onClick={() => run(j.id)}
                style={{ background: "#fff", color: BRAND, border: `1.5px solid ${BRAND}`, borderRadius: 8,
                  padding: "8px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                Synchroniser
              </button>
            </div>
            {state[j.id] && <div style={{ marginTop: 12, fontSize: 14, color: "#4a4740" }}>{state[j.id]}</div>}
          </div>
        ))}

        <p style={{ marginTop: 24 }}>
          <a href="/dashboard" style={{ color: BRAND, fontWeight: 600 }}>→ Voir le dashboard</a>
        </p>
      </div>
    </div>
  );
}
