# Setup complet — de GitHub vide au dashboard en ligne

Tu n'as rien d'installé côté projet. Suis les étapes dans l'ordre.

## 0. Prérequis (une fois sur ta machine)
- Node.js 18+ : https://nodejs.org (prends la version LTS)
- Git : déjà là si tu as créé le repo
- Un compte Vercel (gratuit) : https://vercel.com — connecte-le à ton GitHub
- Une base Postgres gratuite : Neon (https://neon.tech) ou Vercel Postgres
  (dans Vercel : Storage > Create > Postgres). Récupère la connection string.

## 1. Récupérer le repo et y déposer les fichiers
```bash
git clone https://github.com/<toi>/<ton-repo>.git
cd <ton-repo>
```
Copie TOUT le contenu de ce dossier dedans (garde l'arborescence exacte :
app/, lib/, db/, package.json, etc.).

## 2. Installer
```bash
npm install
```

## 3. Créer la base
Crée un fichier `.env.local` (copie `.env.example`) et remplis au moins
`DATABASE_URL`. Puis :
```bash
npm run db:init
```
(Si `psql` n'est pas installé : colle le contenu de `db/schema.sql` dans
l'éditeur SQL de Neon/Vercel et exécute.)

## 4. Tester en local
```bash
npm run dev
```
Ouvre http://localhost:3000 → tu es redirigé sur /dashboard (vide tant que
tu n'as pas synchronisé, c'est normal).

## 5. Pousser sur GitHub
```bash
git add .
git commit -m "Dashboard Shopify + Meta + Klaviyo"
git push
```

## 6. Déployer sur Vercel
- Vercel > Add New > Project > importe ton repo GitHub
- Dans Settings > Environment Variables, ajoute TOUTES les variables de
  `.env.example` (DATABASE_URL, CRON_SECRET, les tokens Shopify/Meta/Klaviyo)
- Deploy. Le `vercel.json` active automatiquement les 3 crons.

## 7. Premier remplissage (backfill)
Une fois déployé, lance les syncs à la main :
```bash
curl -H "Authorization: Bearer <TON_CRON_SECRET>" https://<ton-app>.vercel.app/api/sync/shopify
curl -H "Authorization: Bearer <TON_CRON_SECRET>" https://<ton-app>.vercel.app/api/sync/meta
curl -H "Authorization: Bearer <TON_CRON_SECRET>" https://<ton-app>.vercel.app/api/sync/klaviyo
```
Rafraîchis /dashboard : les données apparaissent.

## Où récupérer chaque token
- **SHOPIFY_ADMIN_TOKEN** : admin Shopify > Settings > Apps and sales channels
  > Develop apps > crée une app > Admin API access token. Scopes : read_orders,
  read_products, read_customers.
- **SHOPIFY_WEBHOOK_SECRET** : même app, section Webhooks (API secret key).
- **META_ACCESS_TOKEN** : business.facebook.com > System Users > génère un token
  long-lived avec ads_read sur le compte act_1036120010066341.
- **KLAVIYO_API_KEY** : Klaviyo > Settings > API Keys > Create Private API Key
  (scope read sur events, metrics, flows).
- **CRON_SECRET** : invente une longue chaîne aléatoire (ex: `openssl rand -hex 32`).
