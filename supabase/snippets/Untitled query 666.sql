-- Create sequences and set defaults for brand checking tables (6 tables)
CREATE SEQUENCE india_brand_checking_seller_1_id_seq;
ALTER TABLE india_brand_checking_seller_1 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_1_id_seq');
ALTER SEQUENCE india_brand_checking_seller_1_id_seq OWNED BY india_brand_checking_seller_1.id;

CREATE SEQUENCE india_brand_checking_seller_2_id_seq;
ALTER TABLE india_brand_checking_seller_2 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_2_id_seq');
ALTER SEQUENCE india_brand_checking_seller_2_id_seq OWNED BY india_brand_checking_seller_2.id;

CREATE SEQUENCE india_brand_checking_seller_3_id_seq;
ALTER TABLE india_brand_checking_seller_3 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_3_id_seq');
ALTER SEQUENCE india_brand_checking_seller_3_id_seq OWNED BY india_brand_checking_seller_3.id;

CREATE SEQUENCE india_brand_checking_seller_4_id_seq;
ALTER TABLE india_brand_checking_seller_4 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_4_id_seq');
ALTER SEQUENCE india_brand_checking_seller_4_id_seq OWNED BY india_brand_checking_seller_4.id;

CREATE SEQUENCE india_brand_checking_seller_5_id_seq;
ALTER TABLE india_brand_checking_seller_5 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_5_id_seq');
ALTER SEQUENCE india_brand_checking_seller_5_id_seq OWNED BY india_brand_checking_seller_5.id;

CREATE SEQUENCE india_brand_checking_seller_6_id_seq;
ALTER TABLE india_brand_checking_seller_6 ALTER COLUMN id SET DEFAULT nextval('india_brand_checking_seller_6_id_seq');
ALTER SEQUENCE india_brand_checking_seller_6_id_seq OWNED BY india_brand_checking_seller_6.id;
