"use client";
import { useState, useRef } from "react";

const BRAND = "#142e1f";

export default function Importer() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const stop = useRef(false);

  function add(msg: string) { setLog((l) => [msg, ...l].slice(0, 30)); }

  async function start() {
    setRunning(true); stop.current = false; setLog([]);
    let cursor: string | null = null;
    let done = false;
    let loops = 0;
    add("Import démarré (depuis 2025)…");
    while (!done && !stop.current && loops < 500) {
      loops++;
      try {
        const u = new URL("/api/import-batch", window.location.origin);
        u.searchParams.set("from", "2025-01-01");
        if (cursor) u.searchParams.set("cursor", cursor);
        const res = await fetch(u.toString());
        const d = await res.json();
        if (d.error) { add("Erreur : " + d.error); break; }
        setTotal(Number(d.total));
        add(`Lot ${loops} — ${d.ecrit} importées · total en base : ${d.total}`);
        done = d.done;
        cursor = d.cursor;
      } catch (e: any) {
        add("Coupure réseau, on réessaie… (" + String(e?.message ?? e) + ")");
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (done) add("✅ Import terminé ! Tout l'historique 2025 → aujourd'hui est en base.");
    setRunning(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f6f3", fontFamily: "system-ui, sans-serif", padding: 32 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ color: BRAND }}>Import de l'historique Shopify</h1>
        <p style={{ color: "#7a7770" }}>
          Clique sur Démarrer. L'import avance tout seul par petits lots jusqu'à tout charger.
          Garde cet onglet ouvert pendant l'opération (quelques minutes).
        </p>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
          <button onClick={start} disabled={running}
            style={{ background: running ? "#999" : BRAND, color: "#fff", border: "none", borderRadius: 8,
              padding: "12px 24px", fontSize: 15, fontWeight: 600, cursor: running ? "default" : "pointer" }}>
            {running ? "Import en cours…" : "Démarrer l'import"}
          </button>
          {running && <button onClick={() => { stop.current = true; }}
            style={{ background: "#fff", color: BRAND, border: `1.5px solid ${BRAND}`, borderRadius: 8, padding: "12px 20px", cursor: "pointer" }}>
            Arrêter
          </button>}
          {total != null && <span style={{ fontWeight: 700, color: BRAND }}>Total en base : {total}</span>}
        </div>
        <div style={{ background: "#fff", border: "1px solid #e6e3dd", borderRadius: 12, padding: 16, fontSize: 13, fontFamily: "monospace", color: "#4a4740" }}>
          {log.length === 0 ? "En attente…" : log.map((l, i) => <div key={i} style={{ padding: "2px 0" }}>{l}</div>)}
        </div>
        <p style={{ marginTop: 20 }}><a href="/dashboard" style={{ color: BRAND, fontWeight: 600 }}>→ Voir le dashboard</a></p>
      </div>
    </div>
  );
}
