-- Brand Checking Tables (6 tables)
CREATE SEQUENCE IF NOT EXISTS india_brand_checking_seller_1_id_seq;
ALTER TABLE india_brand_checking_seller_1 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_1_id_seq');
SELECT setval('india_brand_checking_seller_1_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_brand_checking_seller_1;

CREATE SEQUENCE IF NOT EXISTS india_brand_checking_seller_2_id_seq;
ALTER TABLE india_brand_checking_seller_2 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_2_id_seq');
SELECT setval('india_brand_checking_seller_2_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_brand_checking_seller_2;

CREATE SEQUENCE IF NOT EXISTS india_brand_checking_seller_3_id_seq;
ALTER TABLE india_brand_checking_seller_3 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_3_id_seq');
SELECT setval('india_brand_checking_seller_3_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_brand_checking_seller_3;

CREATE SEQUENCE IF NOT EXISTS india_brand_checking_seller_4_id_seq;
ALTER TABLE india_brand_checking_seller_4 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_4_id_seq');
SELECT setval('india_brand_checking_seller_4_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_brand_checking_seller_4;

CREATE SEQUENCE IF NOT EXISTS india_brand_checking_seller_5_id_seq;
ALTER TABLE india_brand_checking_seller_5 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_5_id_seq');
SELECT setval('india_brand_checking_seller_5_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_brand_checking_seller_5;

CREATE SEQUENCE IF NOT EXISTS india_brand_checking_seller_6_id_seq;
ALTER TABLE india_brand_checking_seller_6 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_6_id_seq');
SELECT setval('india_brand_checking_seller_6_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_brand_checking_seller_6;

-- Seller 1 Funnel Tables (3 tables)
CREATE SEQUENCE IF NOT EXISTS india_seller_1_high_demand_id_seq;
ALTER TABLE india_seller_1_high_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_1_high_demand_id_seq');
SELECT setval('india_seller_1_high_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_1_high_demand;

CREATE SEQUENCE IF NOT EXISTS india_seller_1_dropshipping_id_seq;
ALTER TABLE india_seller_1_dropshipping ALTER COLUMN id SET DEFAULT nextval('india_seller_1_dropshipping_id_seq');
SELECT setval('india_seller_1_dropshipping_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_1_dropshipping;

CREATE SEQUENCE IF NOT EXISTS india_seller_1_low_demand_id_seq;
ALTER TABLE india_seller_1_low_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_1_low_demand_id_seq');
SELECT setval('india_seller_1_low_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_1_low_demand;

-- Seller 2 Funnel Tables (3 tables)
CREATE SEQUENCE IF NOT EXISTS india_seller_2_high_demand_id_seq;
ALTER TABLE india_seller_2_high_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_2_high_demand_id_seq');
SELECT setval('india_seller_2_high_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_2_high_demand;

CREATE SEQUENCE IF NOT EXISTS india_seller_2_dropshipping_id_seq;
ALTER TABLE india_seller_2_dropshipping ALTER COLUMN id SET DEFAULT nextval('india_seller_2_dropshipping_id_seq');
SELECT setval('india_seller_2_dropshipping_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_2_dropshipping;

CREATE SEQUENCE IF NOT EXISTS india_seller_2_low_demand_id_seq;
ALTER TABLE india_seller_2_low_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_2_low_demand_id_seq');
SELECT setval('india_seller_2_low_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_2_low_demand;

-- Seller 3 Funnel Tables (3 tables)
CREATE SEQUENCE IF NOT EXISTS india_seller_3_high_demand_id_seq;
ALTER TABLE india_seller_3_high_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_3_high_demand_id_seq');
SELECT setval('india_seller_3_high_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_3_high_demand;

CREATE SEQUENCE IF NOT EXISTS india_seller_3_dropshipping_id_seq;
ALTER TABLE india_seller_3_dropshipping ALTER COLUMN id SET DEFAULT nextval('india_seller_3_dropshipping_id_seq');
SELECT setval('india_seller_3_dropshipping_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_3_dropshipping;

CREATE SEQUENCE IF NOT EXISTS india_seller_3_low_demand_id_seq;
ALTER TABLE india_seller_3_low_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_3_low_demand_id_seq');
SELECT setval('india_seller_3_low_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_3_low_demand;

-- Seller 4 Funnel Tables (3 tables)
CREATE SEQUENCE IF NOT EXISTS india_seller_4_high_demand_id_seq;
ALTER TABLE india_seller_4_high_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_4_high_demand_id_seq');
SELECT setval('india_seller_4_high_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_4_high_demand;

CREATE SEQUENCE IF NOT EXISTS india_seller_4_dropshipping_id_seq;
ALTER TABLE india_seller_4_dropshipping ALTER COLUMN id SET DEFAULT nextval('india_seller_4_dropshipping_id_seq');
SELECT setval('india_seller_4_dropshipping_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_4_dropshipping;

CREATE SEQUENCE IF NOT EXISTS india_seller_4_low_demand_id_seq;
ALTER TABLE india_seller_4_low_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_4_low_demand_id_seq');
SELECT setval('india_seller_4_low_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_4_low_demand;

-- Seller 5 Funnel Tables (3 tables)
CREATE SEQUENCE IF NOT EXISTS india_seller_5_high_demand_id_seq;
ALTER TABLE india_seller_5_high_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_5_high_demand_id_seq');
SELECT setval('india_seller_5_high_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_5_high_demand;

CREATE SEQUENCE IF NOT EXISTS india_seller_5_dropshipping_id_seq;
ALTER TABLE india_seller_5_dropshipping ALTER COLUMN id SET DEFAULT nextval('india_seller_5_dropshipping_id_seq');
SELECT setval('india_seller_5_dropshipping_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_5_dropshipping;

CREATE SEQUENCE IF NOT EXISTS india_seller_5_low_demand_id_seq;
ALTER TABLE india_seller_5_low_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_5_low_demand_id_seq');
SELECT setval('india_seller_5_low_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_5_low_demand;

-- Seller 6 Funnel Tables (3 tables)
CREATE SEQUENCE IF NOT EXISTS india_seller_6_high_demand_id_seq;
ALTER TABLE india_seller_6_high_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_6_high_demand_id_seq');
SELECT setval('india_seller_6_high_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_6_high_demand;

CREATE SEQUENCE IF NOT EXISTS india_seller_6_dropshipping_id_seq;
ALTER TABLE india_seller_6_dropshipping ALTER COLUMN id SET DEFAULT nextval('india_seller_6_dropshipping_id_seq');
SELECT setval('india_seller_6_dropshipping_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_6_dropshipping;

CREATE SEQUENCE IF NOT EXISTS india_seller_6_low_demand_id_seq;
ALTER TABLE india_seller_6_low_demand ALTER COLUMN id SET DEFAULT nextval('india_seller_6_low_demand_id_seq');
SELECT setval('india_seller_6_low_demand_id_seq', COALESCE(MAX(id), 0) + 1, false) FROM india_seller_6_low_demand;
