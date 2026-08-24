-- ============================================================
-- ENDRO DASHBOARD — Schéma Postgres
-- Couches : raw (JSONB brut) -> marts (fct_*) -> dim (dimensions)
-- Convention : tout upsert sur clé naturelle => sync rejouable sans doublon
-- CA toujours HT. Meta/Klaviyo = attribution, jamais source de CA.
-- ============================================================

-- ---------- DIMENSIONS ----------

CREATE TABLE IF NOT EXISTS dim_date (
  date_key      DATE PRIMARY KEY,
  year          INT  NOT NULL,
  quarter       INT  NOT NULL,
  month         INT  NOT NULL,
  week_iso      INT  NOT NULL,
  day_of_week   INT  NOT NULL,
  is_weekend    BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS dim_product (
  product_id    TEXT PRIMARY KEY,      -- Shopify product GID
  sku           TEXT,
  title         TEXT,
  type_vf       TEXT,                  -- ta taxonomie interne
  categorie     TEXT,                  -- Skincare / Hygiène / Bodycare
  sous_categorie TEXT,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dim_customer (
  customer_id   TEXT PRIMARY KEY,      -- Shopify customer GID
  email_hash    TEXT UNIQUE,           -- sha256(lower(email)) => jointure Klaviyo
  first_order_at TIMESTAMPTZ,
  orders_count  INT DEFAULT 0,
  total_spent_ht NUMERIC(12,2) DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ---------- RAW (append/upsert brut, aucune transfo) ----------

CREATE TABLE IF NOT EXISTS raw_shopify_orders (
  order_id      TEXT PRIMARY KEY,
  payload       JSONB NOT NULL,
  ingested_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raw_meta_insights (
  ad_id         TEXT NOT NULL,
  date_key      DATE NOT NULL,
  payload       JSONB NOT NULL,
  ingested_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (ad_id, date_key)         -- grain Meta : ad × jour
);

CREATE TABLE IF NOT EXISTS raw_klaviyo_events (
  event_id      TEXT PRIMARY KEY,
  payload       JSONB NOT NULL,
  ingested_at   TIMESTAMPTZ DEFAULT now()
);

-- ---------- MARTS (tables de faits normalisées) ----------

CREATE TABLE IF NOT EXISTS fct_orders (
  order_id      TEXT PRIMARY KEY,
  order_number  TEXT,
  customer_id   TEXT REFERENCES dim_customer(customer_id),
  date_key      DATE NOT NULL REFERENCES dim_date(date_key),
  created_at    TIMESTAMPTZ NOT NULL,
  ca_ht         NUMERIC(12,2) NOT NULL,   -- HT, hors livraison
  ca_ttc        NUMERIC(12,2) NOT NULL,
  shipping_ht   NUMERIC(12,2) DEFAULT 0,
  discount_ht   NUMERIC(12,2) DEFAULT 0,
  is_new_customer BOOLEAN NOT NULL,
  utm_source    TEXT,
  utm_medium    TEXT,
  landing_ref   TEXT                       -- pour diag attribution
);
CREATE INDEX IF NOT EXISTS idx_fct_orders_date ON fct_orders(date_key);

CREATE TABLE IF NOT EXISTS fct_order_lines (
  order_id      TEXT NOT NULL REFERENCES fct_orders(order_id) ON DELETE CASCADE,
  line_id       TEXT NOT NULL,
  product_id    TEXT REFERENCES dim_product(product_id),
  sku           TEXT,
  qty           INT NOT NULL,
  unit_price_ht NUMERIC(12,2) NOT NULL,
  line_ca_ht    NUMERIC(12,2) NOT NULL,
  PRIMARY KEY (order_id, line_id)
);
CREATE INDEX IF NOT EXISTS idx_lines_product ON fct_order_lines(product_id);

CREATE TABLE IF NOT EXISTS fct_ad_spend (
  ad_id         TEXT NOT NULL,
  date_key      DATE NOT NULL REFERENCES dim_date(date_key),
  campaign_name TEXT,
  adset_name    TEXT,
  ad_name       TEXT,
  spend         NUMERIC(12,2) NOT NULL,
  impressions   BIGINT DEFAULT 0,
  clicks        BIGINT DEFAULT 0,
  purchases     INT DEFAULT 0,           -- action_type=purchase, fenêtre figée
  purchase_value NUMERIC(12,2) DEFAULT 0,-- action_values purchase (attribué Meta)
  add_to_cart   INT DEFAULT 0,
  PRIMARY KEY (ad_id, date_key)
);
CREATE INDEX IF NOT EXISTS idx_spend_date ON fct_ad_spend(date_key);

CREATE TABLE IF NOT EXISTS fct_email_events (
  event_id      TEXT PRIMARY KEY,
  date_key      DATE NOT NULL REFERENCES dim_date(date_key),
  customer_email_hash TEXT,
  metric        TEXT NOT NULL,           -- Placed Order / Opened Email / Clicked...
  flow_id       TEXT,
  flow_name     TEXT,
  campaign_id   TEXT,
  campaign_name TEXT,
  revenue_ht    NUMERIC(12,2) DEFAULT 0  -- revenu attribué Klaviyo (jamais sommé au ROAS Meta)
);
CREATE INDEX IF NOT EXISTS idx_email_date ON fct_email_events(date_key);
CREATE INDEX IF NOT EXISTS idx_email_metric ON fct_email_events(metric);

-- ---------- VUE SÉMANTIQUE : 1 KPI = 1 définition ----------

CREATE OR REPLACE VIEW v_daily_kpis AS
SELECT
  d.date_key,
  COALESCE(o.ca_ht, 0)                        AS ca_ht,
  COALESCE(o.orders, 0)                       AS orders,
  COALESCE(o.new_orders, 0)                   AS new_orders,
  COALESCE(m.spend, 0)                        AS meta_spend,
  COALESCE(m.purchase_value, 0)              AS meta_attributed_ca,
  CASE WHEN COALESCE(m.spend,0) > 0
       THEN ROUND(m.purchase_value / m.spend, 2) END AS meta_roas,
  COALESCE(k.email_revenue, 0)               AS klaviyo_attributed_ca,
  CASE WHEN COALESCE(o.orders,0) > 0
       THEN ROUND(o.ca_ht / o.orders, 2) END AS aov_ht
FROM dim_date d
LEFT JOIN (
  SELECT date_key, SUM(ca_ht) ca_ht, COUNT(*) orders,
         COUNT(*) FILTER (WHERE is_new_customer) new_orders
  FROM fct_orders GROUP BY date_key
) o ON o.date_key = d.date_key
LEFT JOIN (
  SELECT date_key, SUM(spend) spend, SUM(purchase_value) purchase_value
  FROM fct_ad_spend GROUP BY date_key
) m ON m.date_key = d.date_key
LEFT JOIN (
  SELECT date_key, SUM(revenue_ht) email_revenue
  FROM fct_email_events WHERE metric = 'Placed Order' GROUP BY date_key
) k ON k.date_key = d.date_key;
