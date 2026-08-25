-- Agrégats journaliers issus de ShopifyQL (historique léger)
CREATE TABLE IF NOT EXISTS agg_daily (
  date_key      DATE PRIMARY KEY,
  total_sales   NUMERIC(14,2) DEFAULT 0,
  net_sales     NUMERIC(14,2) DEFAULT 0,
  gross_sales   NUMERIC(14,2) DEFAULT 0,
  discounts     NUMERIC(14,2) DEFAULT 0,
  returns       NUMERIC(14,2) DEFAULT 0,
  orders        INT DEFAULT 0,
  aov           NUMERIC(12,2) DEFAULT 0,
  sessions      INT DEFAULT 0,
  conversion_rate NUMERIC(8,5) DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Ventes agrégées par produit et par mois
CREATE TABLE IF NOT EXISTS agg_product_month (
  month_key     DATE NOT NULL,
  product_title TEXT NOT NULL,
  net_sales     NUMERIC(14,2) DEFAULT 0,
  units         INT DEFAULT 0,
  PRIMARY KEY (month_key, product_title)
);

-- Ventes agrégées par catégorie (product_type) et par mois
CREATE TABLE IF NOT EXISTS agg_category_month (
  month_key     DATE NOT NULL,
  product_type  TEXT NOT NULL,
  net_sales     NUMERIC(14,2) DEFAULT 0,
  PRIMARY KEY (month_key, product_type)
);
