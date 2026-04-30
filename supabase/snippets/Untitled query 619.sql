-- Updating/Adding function: public.bulk_insert_india_master_with_distribution
CREATE OR REPLACE FUNCTION public.bulk_insert_india_master_with_distribution(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count int := 0;
  updated_count int := 0;
  asin_list text[];
BEGIN
  -- Extract ASIN list
  SELECT array_agg((elem->>'asin')::text) INTO asin_list
  FROM jsonb_array_elements(batch_data) elem;
 
  -- Disable triggers for speed
  ALTER TABLE india_master_sellers DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_1 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_2 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_3 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_4 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_5 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_6 DISABLE TRIGGER USER;
  ALTER TABLE india_seller_1_high_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_1_dropshipping DISABLE TRIGGER USER;
  ALTER TABLE india_seller_1_low_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_2_high_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_2_dropshipping DISABLE TRIGGER USER;
  ALTER TABLE india_seller_2_low_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_3_high_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_3_dropshipping DISABLE TRIGGER USER;
  ALTER TABLE india_seller_3_low_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_4_high_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_4_dropshipping DISABLE TRIGGER USER;
  ALTER TABLE india_seller_4_low_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_5_high_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_5_dropshipping DISABLE TRIGGER USER;
  ALTER TABLE india_seller_5_low_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_6_high_demand DISABLE TRIGGER USER;
  ALTER TABLE india_seller_6_dropshipping DISABLE TRIGGER USER;
  ALTER TABLE india_seller_6_low_demand DISABLE TRIGGER USER;
 
  -- ✅ INSERT/UPDATE Master Table
  INSERT INTO india_master_sellers (
    asin, amz_link, product_name, remark, brand, price,
    monthly_unit, monthly_sales, bsr, seller, category,
    dimensions, weight, weight_unit, link
  )
  SELECT
    (elem->>'asin')::text,
    (elem->>'amz_link')::text,
    (elem->>'product_name')::text,
    (elem->>'remark')::text,
    (elem->>'brand')::text,
    (elem->>'price')::numeric,
    (elem->>'monthly_unit')::numeric,
    (elem->>'monthly_sales')::numeric,
    (elem->>'bsr')::numeric,
    (elem->>'seller')::numeric,
    (elem->>'category')::text,
    (elem->>'dimensions')::text,
    (elem->>'weight')::numeric,
    (elem->>'weight_unit')::text,
    (elem->>'link')::text
  FROM jsonb_array_elements(batch_data) elem
  ON CONFLICT (asin) DO UPDATE SET
    amz_link = COALESCE(EXCLUDED.amz_link, india_master_sellers.amz_link),
    product_name = COALESCE(EXCLUDED.product_name, india_master_sellers.product_name),
    remark = COALESCE(EXCLUDED.remark, india_master_sellers.remark),
    brand = COALESCE(EXCLUDED.brand, india_master_sellers.brand),
    price = COALESCE(EXCLUDED.price, india_master_sellers.price),
    monthly_unit = COALESCE(EXCLUDED.monthly_unit, india_master_sellers.monthly_unit),
    monthly_sales = COALESCE(EXCLUDED.monthly_sales, india_master_sellers.monthly_sales),
    bsr = COALESCE(EXCLUDED.bsr, india_master_sellers.bsr),
    seller = COALESCE(EXCLUDED.seller, india_master_sellers.seller),
    category = COALESCE(EXCLUDED.category, india_master_sellers.category),
    dimensions = COALESCE(EXCLUDED.dimensions, india_master_sellers.dimensions),
    weight = COALESCE(EXCLUDED.weight, india_master_sellers.weight),
    weight_unit = COALESCE(EXCLUDED.weight_unit, india_master_sellers.weight_unit),
    link = COALESCE(EXCLUDED.link, india_master_sellers.link),
    updated_at = CURRENT_TIMESTAMP;
 
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
 
  -- ============================================
  -- INSERT/UPDATE Brand Checking Tables
  -- ============================================
  
  -- Seller 1 (GA)
  INSERT INTO india_brand_checking_seller_1 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
  SELECT 
    m.id, 'GA', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new',
    CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list)
  ON CONFLICT (asin) DO UPDATE SET
    product_name = EXCLUDED.product_name,
    brand = EXCLUDED.brand,
    price = EXCLUDED.price,
    monthly_unit = EXCLUDED.monthly_unit,
    monthly_sales = EXCLUDED.monthly_sales,
    bsr = EXCLUDED.bsr,
    seller = EXCLUDED.seller,
    category = EXCLUDED.category,
    dimensions = EXCLUDED.dimensions,
    weight = EXCLUDED.weight,
    weight_unit = EXCLUDED.weight_unit,
    remark = EXCLUDED.remark,
    funnel = EXCLUDED.funnel,
    updated_at = CURRENT_TIMESTAMP;
 
  -- Seller 2 (RR)
  INSERT INTO india_brand_checking_seller_2 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
  SELECT m.id, 'RR', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new',
    CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list)
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, price=EXCLUDED.price, monthly_unit=EXCLUDED.monthly_unit, monthly_sales=EXCLUDED.monthly_sales, bsr=EXCLUDED.bsr, seller=EXCLUDED.seller, category=EXCLUDED.category, dimensions=EXCLUDED.dimensions, weight=EXCLUDED.weight, weight_unit=EXCLUDED.weight_unit, remark=EXCLUDED.remark, funnel=EXCLUDED.funnel, updated_at=CURRENT_TIMESTAMP;
 
  -- Seller 3 (UB)
  INSERT INTO india_brand_checking_seller_3 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
  SELECT m.id, 'UB', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new',
    CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list)
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, price=EXCLUDED.price, monthly_unit=EXCLUDED.monthly_unit, monthly_sales=EXCLUDED.monthly_sales, bsr=EXCLUDED.bsr, seller=EXCLUDED.seller, category=EXCLUDED.category, dimensions=EXCLUDED.dimensions, weight=EXCLUDED.weight, weight_unit=EXCLUDED.weight_unit, remark=EXCLUDED.remark, funnel=EXCLUDED.funnel, updated_at=CURRENT_TIMESTAMP;
 
  -- Seller 4 (VV)
  INSERT INTO india_brand_checking_seller_4 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
  SELECT m.id, 'VV', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new',
    CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list)
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, price=EXCLUDED.price, monthly_unit=EXCLUDED.monthly_unit, monthly_sales=EXCLUDED.monthly_sales, bsr=EXCLUDED.bsr, seller=EXCLUDED.seller, category=EXCLUDED.category, dimensions=EXCLUDED.dimensions, weight=EXCLUDED.weight, weight_unit=EXCLUDED.weight_unit, remark=EXCLUDED.remark, funnel=EXCLUDED.funnel, updated_at=CURRENT_TIMESTAMP;
 
  -- Seller 5 (DE)
  INSERT INTO india_brand_checking_seller_5 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
  SELECT m.id, 'DE', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new',
    CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list)
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, price=EXCLUDED.price, monthly_unit=EXCLUDED.monthly_unit, monthly_sales=EXCLUDED.monthly_sales, bsr=EXCLUDED.bsr, seller=EXCLUDED.seller, category=EXCLUDED.category, dimensions=EXCLUDED.dimensions, weight=EXCLUDED.weight, weight_unit=EXCLUDED.weight_unit, remark=EXCLUDED.remark, funnel=EXCLUDED.funnel, updated_at=CURRENT_TIMESTAMP;
 
  -- Seller 6 (CV)
  INSERT INTO india_brand_checking_seller_6 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
  SELECT m.id, 'CV', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new',
    CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list)
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, price=EXCLUDED.price, monthly_unit=EXCLUDED.monthly_unit, monthly_sales=EXCLUDED.monthly_sales, bsr=EXCLUDED.bsr, seller=EXCLUDED.seller, category=EXCLUDED.category, dimensions=EXCLUDED.dimensions, weight=EXCLUDED.weight, weight_unit=EXCLUDED.weight_unit, remark=EXCLUDED.remark, funnel=EXCLUDED.funnel, updated_at=CURRENT_TIMESTAMP;
 
  -- ============================================
  -- INSERT/UPDATE Funnel Tables (18 tables)
  -- ============================================
  
  -- Seller 1 Funnels
  INSERT INTO india_seller_1_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_1 WHERE asin = ANY(asin_list) AND monthly_unit > 60
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  
  INSERT INTO india_seller_1_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_1 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  
  INSERT INTO india_seller_1_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_1 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0)
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;

  -- Seller 2 Funnels
  INSERT INTO india_seller_2_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_2 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_2_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_2 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_2_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_2 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;

  -- Seller 3 Funnels
  INSERT INTO india_seller_3_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_3 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_3_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_3 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_3_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_3 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;

  -- Seller 4 Funnels
  INSERT INTO india_seller_4_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_4 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_4_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_4 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_4_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_4 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;

  -- Seller 5 Funnels
  INSERT INTO india_seller_5_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_5 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_5_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_5 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_5_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_5 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;

  -- Seller 6 Funnels
  INSERT INTO india_seller_6_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_6 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_6_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_6 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
  INSERT INTO india_seller_6_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_6 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark, updated_at=CURRENT_TIMESTAMP;
 
  -- Re-enable all triggers
  ALTER TABLE india_master_sellers ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_1 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_2 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_3 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_4 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_5 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_6 ENABLE TRIGGER USER;
  ALTER TABLE india_seller_1_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_1_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_1_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_2_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_2_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_2_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_3_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_3_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_3_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_4_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_4_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_4_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_5_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_5_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_5_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_6_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_6_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_6_low_demand ENABLE TRIGGER USER;
 
  RETURN json_build_object('success', true, 'inserted_count', inserted_count);
 
EXCEPTION WHEN OTHERS THEN
  -- Re-enable all triggers on error
  ALTER TABLE india_master_sellers ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_1 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_2 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_3 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_4 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_5 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_6 ENABLE TRIGGER USER;
  ALTER TABLE india_seller_1_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_1_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_1_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_2_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_2_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_2_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_3_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_3_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_3_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_4_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_4_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_4_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_5_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_5_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_5_low_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_6_high_demand ENABLE TRIGGER USER;
  ALTER TABLE india_seller_6_dropshipping ENABLE TRIGGER USER;
  ALTER TABLE india_seller_6_low_demand ENABLE TRIGGER USER;
  RAISE;
END;
$function$;


-- Updating/Adding function: public.distribute_to_brand_checking_background
CREATE OR REPLACE FUNCTION public.distribute_to_brand_checking_background()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  processed_count int := 0;
  asin_list text[];
BEGIN
  -- Find pending ASINs (limit 1000 per run)
  SELECT array_agg(asin) INTO asin_list
  FROM india_master_sellers
  WHERE processing_status = 'pending_bc'
  LIMIT 1000;

  -- If nothing to process, exit early
  IF asin_list IS NULL OR array_length(asin_list, 1) = 0 THEN
    RETURN json_build_object('success', true, 'processed', 0, 'message', 'No pending items');
  END IF;

  -- Disable triggers for speed
  ALTER TABLE india_brand_checking_seller_1 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_2 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_3 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_4 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_5 DISABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_6 DISABLE TRIGGER USER;

  -- Distribute to seller 1 (GA)
  INSERT INTO india_brand_checking_seller_1 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link)
  SELECT 
    m.id, 
    'GA', 
    m.asin, 
    m.link, 
    m.product_name, 
    m.brand, 
    m.price, 
    m.monthly_unit, 
    m.monthly_sales, 
    m.bsr, 
    m.seller, 
    m.category, 
    m.dimensions, 
    m.weight, 
    m.weight_unit, 
    m.created_at, 
    m.updated_at, 
    m.remark,  -- Clean remark (no markers)
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new'  -- Generated link
  FROM india_master_sellers m 
  WHERE m.asin = ANY(asin_list) 
  ON CONFLICT (asin) DO NOTHING;

  -- Distribute to seller 2 (RR)
  INSERT INTO india_brand_checking_seller_2 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link)
  SELECT m.id, 'RR', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new'
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;

  -- Distribute to seller 3 (UB)
  INSERT INTO india_brand_checking_seller_3 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link)
  SELECT m.id, 'UB', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new'
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;

  -- Distribute to seller 4 (VV)
  INSERT INTO india_brand_checking_seller_4 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link)
  SELECT m.id, 'VV', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new'
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;

  -- Distribute to seller 5 (DE)
  INSERT INTO india_brand_checking_seller_5 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link)
  SELECT m.id, 'DE', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new'
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;

  -- Distribute to seller 6 (CV)
  INSERT INTO india_brand_checking_seller_6 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link)
  SELECT m.id, 'CV', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new'
  FROM india_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;

  -- Update master status: pending_bc → pending_funnel
  UPDATE india_master_sellers 
  SET processing_status = 'pending_funnel'
  WHERE asin = ANY(asin_list);

  -- Re-enable triggers
  ALTER TABLE india_brand_checking_seller_1 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_2 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_3 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_4 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_5 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_6 ENABLE TRIGGER USER;

  processed_count := array_length(asin_list, 1);
  RETURN json_build_object('success', true, 'processed', processed_count);

EXCEPTION WHEN OTHERS THEN
  -- Always re-enable triggers
  ALTER TABLE india_brand_checking_seller_1 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_2 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_3 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_4 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_5 ENABLE TRIGGER USER;
  ALTER TABLE india_brand_checking_seller_6 ENABLE TRIGGER USER;
  RAISE;
END;
$function$;


-- Updating/Adding function: public.distribute_to_brand_checking_sellers
CREATE OR REPLACE FUNCTION public.distribute_to_brand_checking_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Seller 1 (Golden Aura)
  INSERT INTO public.india_brand_checking_seller_1 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, 
    dimensions, weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S1', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price,
    NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category,
    NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 2 (Rudra Retail)
  INSERT INTO public.india_brand_checking_seller_2 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, 
    dimensions, weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S2', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price,
    NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category,
    NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 3 (UBeauty)
  INSERT INTO public.india_brand_checking_seller_3 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, 
    dimensions, weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S3', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price,
    NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category,
    NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 4 (Velvet Vista)
  INSERT INTO public.india_brand_checking_seller_4 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, 
    dimensions, weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S4', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price,
    NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category,
    NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- ✅ NEW: Seller 5 (Dropy Ecom)
  INSERT INTO public.india_brand_checking_seller_5 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, 
    dimensions, weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S5', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price,
    NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category,
    NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- ✅ NEW: Seller 6 (Costech Ventures)
  INSERT INTO public.india_brand_checking_seller_6 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, 
    dimensions, weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S6', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price,
    NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category,
    NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$;


-- Updating/Adding function: public.flipkart_move_checking_to_brand_checking
CREATE OR REPLACE FUNCTION public.flipkart_move_checking_to_brand_checking()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id TEXT;
  seller_tag TEXT;
  target_table TEXT;
  final_link TEXT;
BEGIN
  -- Extract seller number from table name
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'checking_seller_([0-9]+)');
  target_table := 'flipkart_brand_checking_seller_' || seller_id;
  
  -- Map seller ID to tag
  seller_tag := CASE seller_id
    WHEN '1' THEN 'GR'
    WHEN '2' THEN 'RR'
    WHEN '3' THEN 'UB'
    WHEN '4' THEN 'VV'
    WHEN '5' THEN 'DE'
    WHEN '6' THEN 'CV'
  END;

  -- Handle Link (Check if 'link' exists, otherwise use 'product_link')
  -- We try to access the field dynamically or just default to product_link if we know that's the column name.
  -- Since the error says "new has no field link", we MUST use NEW.product_link.
  
  -- Insert into brand_checking table
  EXECUTE format(
    'INSERT INTO %I (
      source_id, tag, asin, link, product_name, brand, price, 
      monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
      weight, weight_unit, created_at, updated_at, remark, amz_link
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW(), $16, $17)
    ON CONFLICT (asin) DO NOTHING',
    target_table
  )
  USING 
    NEW.id,
    seller_tag,
    NEW.asin,
    NEW.product_link, -- ✅ FIXED: Changed from NEW.link to NEW.product_link
    NEW.product_name,
    NEW.brand,
    NEW.target_price, -- Mapping target_price to price (adjust if needed)
    0, -- monthly_unit (default)
    0, -- monthly_sales (default)
    0, -- bsr (default)
    NEW.seller_company, -- seller
    NULL, -- category
    NULL, -- dimensions
    NEW.product_weight,
    'kg', -- weight_unit
    NULL, -- remark
    NEW.inr_purchase_link; -- amz_link (Mapping purchase link to amz_link)

  RETURN NEW;
END;
$function$;


-- Updating/Adding function: public.flipkart_restore_old_distribution
CREATE OR REPLACE FUNCTION public.flipkart_restore_old_distribution()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    target_table text;
    final_seller_id int;
    clean_input text;
BEGIN
    -- 1. Get Input & Default to Seller 1
    clean_input := TRIM(COALESCE(NEW.seller, ''));
    final_seller_id := 1; 

    -- 2. Smart Seller Routing (Handle "8" as count, etc.)
    IF clean_input ~ '^[0-9]+$' THEN
        -- Number Input
        UPDATE public.flipkart_master_sellers 
        SET no_of_sellers = clean_input::INT 
        WHERE id = NEW.id;
        -- Keep final_seller_id = 1 (Default)

    ELSIF clean_input ILIKE '%Golden%' THEN final_seller_id := 1;
    ELSIF clean_input ILIKE '%Rudra%'  THEN final_seller_id := 2;
    ELSIF clean_input ILIKE '%Ubeauty%' THEN final_seller_id := 3;
    ELSIF clean_input ILIKE '%Velvet%' THEN final_seller_id := 4;
    ELSIF clean_input ILIKE '%Dropy%'  THEN final_seller_id := 5;
    ELSIF clean_input ILIKE '%Costech%' THEN final_seller_id := 6;
    END IF;

    -- 3. Construct Table Name
    target_table := 'flipkart_brand_checking_seller_' || final_seller_id;

    -- 4. INSERT OR UPDATE (The Critical Fix)
    -- We changed "DO NOTHING" to "DO UPDATE SET..."
    EXECUTE format('
        INSERT INTO public.%I (
            asin, product_name, brand, monthly_unit, 
            link, amz_link, remark, seller
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (asin) DO UPDATE SET
            remark = EXCLUDED.remark,
            monthly_unit = EXCLUDED.monthly_unit,
            product_name = EXCLUDED.product_name,
            brand = EXCLUDED.brand,
            link = EXCLUDED.link,
            amz_link = EXCLUDED.amz_link,
            seller = EXCLUDED.seller
        ', 
        target_table
    ) 
    USING 
        NEW.asin, 
        NEW.product_name, 
        NEW.brand, 
        NEW.monthly_unit, 
        NEW.link, 
        NEW.amz_link, 
        NEW.remark, 
        final_seller_id; 

    RETURN NEW;
END;
$function$;


-- Updating/Adding function: public.inc_brand_check_approved
CREATE OR REPLACE FUNCTION public.inc_brand_check_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 🔒 DISABLED: approved comes ONLY from usa_validation_main_file
  RETURN NEW;
END;
$function$;


-- Updating/Adding function: public.inc_brand_check_not_approved
CREATE OR REPLACE FUNCTION public.inc_brand_check_not_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 🔒 DISABLED: not_approved handled by recalc_brand_check_progress
  RETURN NEW;
END;
$function$;


-- Updating/Adding function: public.india_distribute_seller_products
CREATE OR REPLACE FUNCTION public.india_distribute_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_table TEXT;
  funnel_tag TEXT;
  seller_id TEXT;
BEGIN
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'india_brand_checking_seller_([0-9]+)');

  IF NEW.monthly_unit > 60 THEN
    target_table := 'india_seller_' || seller_id || '_high_demand';
    funnel_tag := 'HD';
  ELSIF NEW.monthly_unit BETWEEN 1 AND 60 THEN
    target_table := 'india_seller_' || seller_id || '_dropshipping';
    funnel_tag := 'DP';
  ELSE
    target_table := 'india_seller_' || seller_id || '_low_demand';
    funnel_tag := 'LD';
  END IF;

  -- ✅ FIXED: Added remark column (line 26) and NEW.remark value (line 30)
  EXECUTE format(
    'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (asin) DO NOTHING',
    target_table
  )
  USING NEW.asin, NEW.product_name, NEW.brand, funnel_tag, 
        NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark;

  RETURN NEW;
END;
$function$;


-- Updating/Adding function: public.refresh_india_brand_check_progress
CREATE OR REPLACE FUNCTION public.refresh_india_brand_check_progress()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_record RECORD;
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
  seller_codes TEXT[] := ARRAY['GR', 'RR', 'UB', 'VV', 'DE', 'CV'];  -- ✅ FIXED: GA → GR
BEGIN
  -- Loop through all 6 sellers
  FOR i IN 1..6 LOOP
    -- ✅ APPROVED = Products with this seller tag (including multi-seller)
    SELECT COUNT(*) INTO approved_cnt
    FROM india_validation_main_file
    WHERE seller_tag LIKE '%' || seller_codes[i] || '%';  -- ✅ FIXED: Now matches multi-seller tags

    -- ✅ NOT APPROVED = Products in not_approved table
    EXECUTE format('SELECT COUNT(*) FROM india_seller_%s_not_approved', i)
     INTO notapproved_cnt;

    -- ✅ TOTAL = Only pending products (HD + LD + DS)
    EXECUTE format(
      'SELECT (SELECT COUNT(*) FROM india_seller_%s_high_demand) + 
              (SELECT COUNT(*) FROM india_seller_%s_low_demand) + 
              (SELECT COUNT(*) FROM india_seller_%s_dropshipping)',
      i, i, i
    )
    INTO total_cnt;

    -- ✅ UPDATE progress table (UPSERT)
    INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
    VALUES (i, total_cnt, approved_cnt, notapproved_cnt, now())
    ON CONFLICT (sellerid)
    DO UPDATE SET
      total = EXCLUDED.total,
      approved = EXCLUDED.approved,
      notapproved = EXCLUDED.notapproved,
      updatedat = EXCLUDED.updatedat;
  END LOOP;
END;
$function$;


-- Updating/Adding function: public.restart_product_cycle
CREATE OR REPLACE FUNCTION public.restart_product_cycle(p_asin text, p_seller_suffix text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_val_record record;      -- Validation & Admin Data
  v_purchase_record record; -- Purchase Data
  v_reorder_record record;  -- Reorder Data
  v_backpack jsonb;         -- The final collection
BEGIN
  -- 1. COLLECT DATA (Pack the Backpack)

  -- A. Get Validation + Admin Validation Data
  SELECT * INTO v_val_record
  FROM public.usa_validation_main_file
  WHERE asin = p_asin;

  -- B. Get Purchase Data (Most recent order)
  SELECT * INTO v_purchase_record
  FROM public.usa_purchases
  WHERE asin = p_asin
  ORDER BY created_at DESC 
  LIMIT 1; 

  -- C. Get Reorder Data
  EXECUTE format('SELECT * FROM public.usa_reorder_%I WHERE asin = $1', p_seller_suffix)
  INTO v_reorder_record
  USING p_asin;

  -- 2. BUILD THE SNAPSHOT (Merge everything)
  -- Start with the main validation data (Validation + Admin)
  v_backpack := to_jsonb(v_val_record); 

  -- Add Purchase Data if it exists
  IF v_purchase_record IS NOT NULL THEN
    v_backpack := v_backpack || jsonb_build_object(
      'purchase_qty', v_purchase_record.quantity,
      'purchase_total', v_purchase_record.total_amount
      -- Note: If you have a specific unit price column in purchases, add it here
    );
  END IF;

  -- Add Reorder Data if it exists
  IF v_reorder_record IS NOT NULL THEN
    v_backpack := v_backpack || jsonb_build_object(
      'reorder_target_qty', v_reorder_record.admin_target_qty,
      'reorder_final_qty', v_reorder_record.final_reorder_qty
    );
  END IF;

  -- 3. SAVE TO HISTORY
  -- FIX: Changed from "IS FOUND" to "IS NOT NULL"
  IF v_val_record.id IS NOT NULL THEN
    INSERT INTO public.usa_journey_history (
      asin,
      seller_tag,
      final_profit,
      final_judgement,
      snapshot_data
    ) VALUES (
      p_asin,
      v_val_record.seller_tag,
      v_val_record.profit,
      v_val_record.judgement,
      v_backpack -- Contains Validation + Admin + Purchase + Reorder
    );

    -- 4. RESET MAIN FILE (Validation)
    UPDATE public.usa_validation_main_file
    SET
      judgement = NULL,
      admin_status = 'pending',
      sent_to_purchases = false,
      sent_to_purchases_at = NULL,
      profit = NULL,
      total_cost = NULL,
      total_revenue = NULL,
      notes = COALESCE(notes, '') || ' [Cycle Restarted: ' || now()::date || ']',
      status = 'pending'
    WHERE asin = p_asin;

    -- 5. CLEANUP (Prevent Duplicates)
    EXECUTE format('DELETE FROM public.usa_reorder_%I WHERE asin = $1', p_seller_suffix)
    USING p_asin;

    DELETE FROM public.usa_purchases WHERE asin = p_asin;
    DELETE FROM public.usa_traking WHERE asin = p_asin;

  END IF;
END;
$function$;


-- Updating/Adding function: public.trg_brand_check_router
CREATE OR REPLACE FUNCTION public.trg_brand_check_router()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id INT;
BEGIN
  -- Extract seller_id from table name: usa_seller_2_low_demand → 2
  seller_id := split_part(TG_TABLE_NAME, '_', 3)::INT;

  PERFORM recalc_brand_check_progress(seller_id);

  RETURN NULL;
END;
$function$;


-- Updating/Adding function: public.trg_handle_approved_recalc
CREATE OR REPLACE FUNCTION public.trg_handle_approved_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  sid INT;
BEGIN
  -- seller_id nikaalo seller_tag se
  IF NEW.seller_tag ILIKE '%GR%' THEN
    sid := 1;
  ELSIF NEW.seller_tag ILIKE '%RR%' THEN
    sid := 2;
  ELSIF NEW.seller_tag ILIKE '%UB%' THEN
    sid := 3;
  ELSIF NEW.seller_tag ILIKE '%VV%' THEN
    sid := 4;
  ELSE
    RETURN NEW;
  END IF;

  -- ✅ ONLY correct function
  PERFORM recalc_brand_check_progress(sid);

  RETURN NEW;
END;
$function$;