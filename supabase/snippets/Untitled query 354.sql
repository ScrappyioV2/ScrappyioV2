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
$function$
