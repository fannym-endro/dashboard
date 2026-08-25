# Endro Dashboard — intégration

Dashboard Shopify + Meta + Klaviyo. Next.js (App Router) / Postgres / Vercel.
Principe : ingestion planifiée → Postgres normalisé → lecture depuis Server Components.

## Étapes d'intégration

1. **Copier les fichiers** dans ton projet Next.js existant (App Router).
   `@/` doit pointer sur la racine (`tsconfig` : `"paths": { "@/*": ["./*"] }`).

2. **Dépendances**
   ```bash
   npm install pg recharts
   npm install -D @types/pg
   ```

3. **Base de données** — exécuter le schéma une fois :
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```

4. **Variables d'env** — copier `.env.example` → `.env.local`, remplir.
   Sur Vercel, ajouter les mêmes + définir `CRON_SECRET` (obligatoire pour
   sécuriser les routes cron).

5. **Backfill initial** (avant d'activer le cron) — appeler chaque route à la
   main avec le Bearer :
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://ton-app.vercel.app/api/sync/shopify
   curl -H "Authorization: Bearer $CRON_SECRET" https://ton-app.vercel.app/api/sync/meta
   curl -H "Authorization: Bearer $CRON_SECRET" https://ton-app.vercel.app/api/sync/klaviyo
   ```
   Pour l'historique Shopify complet (>30j), remplace la fenêtre `since` par une
   bulk operation `bulkOperationRunQuery` (une passe, pas de rate limit).

6. **Webhooks Shopify** (temps réel, optionnel mais recommandé) — créer dans
   l'admin Shopify les webhooks `orders/create`, `orders/updated`,
   `refunds/create` pointant sur `/api/webhooks/shopify`, format JSON.

7. **Cron** — `vercel.json` planifie déjà les 3 syncs. Déployer suffit.

8. **Dashboard** — accessible sur `/dashboard`.

## Points d'attention

- **CA toujours HT**, source = Shopify uniquement. Meta et Klaviyo ne servent
  qu'à l'attribution ; leur "revenue" n'est jamais additionné au CA Shopify.
- **Fenêtre d'attribution Meta figée** (`7d_click, 1d_view`) dans la route meta.
  Ne pas la retirer sinon le ROAS devient instable.
- **Klaviyo $value est TTC** : converti en HT (/1.2) dans la route. Ajuste si
  ton taux de TVA diffère.
- **dim_product** n'est pas peuplée par les syncs (les commandes ne portent que
  product_id). Alimente-la depuis ta source catalogue (le mapping Type VF /
  Préoccupations / Catégorie / Sous-catégorie que tu maintiens déjà).
- Les jointures cross-source se font sur `dim_date` (et `email_hash` pour le CRM).
  Ne force jamais une jointure order ↔ impression Meta.
