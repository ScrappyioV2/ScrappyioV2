CREATE OR REPLACE FUNCTION public.auto_insert_listing_error()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  target_table text;
  exists_check int;
begin
  -- Only when admin_status becomes confirmed
  if new.admin_status <> 'confirmed' then
    return new;
  end if;

  -- Decide seller table
  if new.seller_tag = 'GR' then
    target_table := 'usa_listing_error_seller_1_pending';
  elsif new.seller_tag = 'RR' then
    target_table := 'usa_listing_error_seller_2_pending';
  elsif new.seller_tag = 'UB' then
    target_table := 'usa_listing_error_seller_3_pending';
  elsif new.seller_tag = 'VV' then
    target_table := 'usa_listing_error_seller_4_pending';
  else
    -- Unknown seller, do nothing
    return new;
  end if;

  -- Prevent duplicates (check all status tables)
  execute format(
    'select count(*) from %I where asin = $1',
    target_table
  )
  into exists_check
  using new.asin;

  if exists_check > 0 then
    return new;
  end if;

  -- Insert into Listing & Error pending table
  execute format(
    'insert into %I
      (asin, product_name, sku, minimum_price, selling_price, maximum_price, seller_link)
     values
      ($1, $2, null, null, $3, null, $4)',
    target_table
  )
  using
    new.asin,
    new.product_name,
    new.admin_target_price,
    new.seller_link;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_insert_flipkart_master_with_distribution(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  inserted_count int := 0;
  updated_count int := 0;
  asin_list text[];
  error_message text;
  is_partial_update boolean;
  seller_num int;
BEGIN
  IF jsonb_array_length(batch_data) > 500 THEN
    RETURN json_build_object('success', false, 'error', 'Batch too large. Maximum 500 rows per batch.');
  END IF;
  
  SELECT array_agg((elem->>'asin')::text) INTO asin_list 
  FROM jsonb_array_elements(batch_data) elem;
  
  -- Detect if this is partial update (only asin, remark, monthly_unit)
  SELECT (elem->>'product_name') IS NULL INTO is_partial_update
  FROM jsonb_array_elements(batch_data) elem
  LIMIT 1;
  
  -- ============================================
  -- HANDLE PARTIAL UPDATE (auto-rebalance)
  -- ============================================
  IF is_partial_update THEN
    -- Disable triggers for partial update
    EXECUTE 'ALTER TABLE flipkart_master_sellers DISABLE TRIGGER ALL';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_1 DISABLE TRIGGER trg_flipkart_rebalance_1';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_2 DISABLE TRIGGER trg_flipkart_rebalance_2';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_3 DISABLE TRIGGER trg_flipkart_rebalance_3';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_4 DISABLE TRIGGER trg_flipkart_rebalance_4';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_5 DISABLE TRIGGER trg_flipkart_rebalance_5';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_6 DISABLE TRIGGER trg_flipkart_rebalance_6';
    
    -- Update master table
    UPDATE flipkart_master_sellers m
    SET 
      monthly_unit = NULLIF((elem->>'monthly_unit')::text, '')::numeric,
      remark = (elem->>'remark')::text
    FROM jsonb_array_elements(batch_data) elem
    WHERE m.asin = (elem->>'asin')::text;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Update brand checking tables (all 6 sellers)
    UPDATE flipkart_brand_checking_seller_1 bc
    SET 
      monthly_unit = m.monthly_unit,
      remark = m.remark,
      funnel = CASE 
        WHEN m.monthly_unit > 60 THEN 'HD'
        WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP'
        ELSE 'LD'
      END
    FROM flipkart_master_sellers m
    WHERE bc.asin = m.asin AND m.asin = ANY(asin_list);
    
    UPDATE flipkart_brand_checking_seller_2 bc
    SET 
      monthly_unit = m.monthly_unit,
      remark = m.remark,
      funnel = CASE 
        WHEN m.monthly_unit > 60 THEN 'HD'
        WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP'
        ELSE 'LD'
      END
    FROM flipkart_master_sellers m
    WHERE bc.asin = m.asin AND m.asin = ANY(asin_list);
    
    UPDATE flipkart_brand_checking_seller_3 bc
    SET 
      monthly_unit = m.monthly_unit,
      remark = m.remark,
      funnel = CASE 
        WHEN m.monthly_unit > 60 THEN 'HD'
        WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP'
        ELSE 'LD'
      END
    FROM flipkart_master_sellers m
    WHERE bc.asin = m.asin AND m.asin = ANY(asin_list);
    
    UPDATE flipkart_brand_checking_seller_4 bc
    SET 
      monthly_unit = m.monthly_unit,
      remark = m.remark,
      funnel = CASE 
        WHEN m.monthly_unit > 60 THEN 'HD'
        WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP'
        ELSE 'LD'
      END
    FROM flipkart_master_sellers m
    WHERE bc.asin = m.asin AND m.asin = ANY(asin_list);
    
    UPDATE flipkart_brand_checking_seller_5 bc
    SET 
      monthly_unit = m.monthly_unit,
      remark = m.remark,
      funnel = CASE 
        WHEN m.monthly_unit > 60 THEN 'HD'
        WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP'
        ELSE 'LD'
      END
    FROM flipkart_master_sellers m
    WHERE bc.asin = m.asin AND m.asin = ANY(asin_list);
    
    UPDATE flipkart_brand_checking_seller_6 bc
    SET 
      monthly_unit = m.monthly_unit,
      remark = m.remark,
      funnel = CASE 
        WHEN m.monthly_unit > 60 THEN 'HD'
        WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP'
        ELSE 'LD'
      END
    FROM flipkart_master_sellers m
    WHERE bc.asin = m.asin AND m.asin = ANY(asin_list);
    
    -- Auto-rebalance funnels for partial updates
    FOR seller_num IN 1..6 LOOP
      -- Delete from HD if product no longer HD
      EXECUTE format(
        'DELETE FROM flipkart_seller_%s_high_demand 
         WHERE asin = ANY($1) 
         AND asin NOT IN (
           SELECT asin FROM flipkart_brand_checking_seller_%s 
           WHERE asin = ANY($1) AND funnel = ''HD''
         )',
        seller_num, seller_num
      ) USING asin_list;
      
      -- Delete from DP if product no longer DP
      EXECUTE format(
        'DELETE FROM flipkart_seller_%s_dropshipping 
         WHERE asin = ANY($1) 
         AND asin NOT IN (
           SELECT asin FROM flipkart_brand_checking_seller_%s 
           WHERE asin = ANY($1) AND funnel = ''DP''
         )',
        seller_num, seller_num
      ) USING asin_list;
      
      -- Delete from LD if product no longer LD
      EXECUTE format(
        'DELETE FROM flipkart_seller_%s_low_demand 
         WHERE asin = ANY($1) 
         AND asin NOT IN (
           SELECT asin FROM flipkart_brand_checking_seller_%s 
           WHERE asin = ANY($1) AND funnel = ''LD''
         )',
        seller_num, seller_num
      ) USING asin_list;
      
      -- Insert/Update to HD
      EXECUTE format(
        'INSERT INTO flipkart_seller_%s_high_demand (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
         SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark
         FROM flipkart_brand_checking_seller_%s
         WHERE asin = ANY($1) AND funnel = ''HD''
         ON CONFLICT (asin) DO UPDATE SET
           monthly_unit = EXCLUDED.monthly_unit,
           remark = EXCLUDED.remark,
           product_name = EXCLUDED.product_name,
           brand = EXCLUDED.brand,
           link = EXCLUDED.link',
        seller_num, seller_num
      ) USING asin_list;
      
      -- Insert/Update to DP
      EXECUTE format(
        'INSERT INTO flipkart_seller_%s_dropshipping (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
         SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark
         FROM flipkart_brand_checking_seller_%s
         WHERE asin = ANY($1) AND funnel = ''DP''
         ON CONFLICT (asin) DO UPDATE SET
           monthly_unit = EXCLUDED.monthly_unit,
           remark = EXCLUDED.remark,
           product_name = EXCLUDED.product_name,
           brand = EXCLUDED.brand,
           link = EXCLUDED.link',
        seller_num, seller_num
      ) USING asin_list;
      
      -- Insert/Update to LD
      EXECUTE format(
        'INSERT INTO flipkart_seller_%s_low_demand (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
         SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark
         FROM flipkart_brand_checking_seller_%s
         WHERE asin = ANY($1) AND funnel = ''LD''
         ON CONFLICT (asin) DO UPDATE SET
           monthly_unit = EXCLUDED.monthly_unit,
           remark = EXCLUDED.remark,
           product_name = EXCLUDED.product_name,
           brand = EXCLUDED.brand,
           link = EXCLUDED.link',
        seller_num, seller_num
      ) USING asin_list;
    END LOOP;
    
    -- Re-enable triggers
    EXECUTE 'ALTER TABLE flipkart_master_sellers ENABLE TRIGGER ALL';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_1 ENABLE TRIGGER trg_flipkart_rebalance_1';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_2 ENABLE TRIGGER trg_flipkart_rebalance_2';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_3 ENABLE TRIGGER trg_flipkart_rebalance_3';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_4 ENABLE TRIGGER trg_flipkart_rebalance_4';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_5 ENABLE TRIGGER trg_flipkart_rebalance_5';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_6 ENABLE TRIGGER trg_flipkart_rebalance_6';
    
    RETURN json_build_object('success', true, 'updated_count', updated_count);
    
  -- ============================================
  -- HANDLE FULL INSERT (trigger-based, FAST)
  -- ============================================
  ELSE
    -- Insert to master (NO trigger disabling needed)
    INSERT INTO flipkart_master_sellers (
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
      NULLIF((elem->>'price')::text, '')::numeric, 
      NULLIF((elem->>'monthly_unit')::text, '')::numeric, 
      NULLIF((elem->>'monthly_sales')::text, '')::numeric, 
      NULLIF((elem->>'bsr')::text, '')::numeric, 
      NULLIF((elem->>'seller')::text, '')::numeric, 
      (elem->>'category')::text, 
      (elem->>'dimensions')::text, 
      NULLIF((elem->>'weight')::text, '')::numeric, 
      (elem->>'weight_unit')::text, 
      (elem->>'link')::text
    FROM jsonb_array_elements(batch_data) elem 
    ON CONFLICT (asin) DO NOTHING;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    
    -- Insert to brand checking (triggers will handle funnel distribution)
    INSERT INTO flipkart_brand_checking_seller_1 (
      source_id, tag, asin, link, product_name, brand, price, 
      monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
      weight, weight_unit, created_at, updated_at, remark, amz_link, funnel
    )
    SELECT 
      m.id, 'GA', m.asin, m.link, m.product_name, m.brand, m.price,
      m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions,
      m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark,
      'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new',
      CASE 
        WHEN m.monthly_unit > 60 THEN 'HD'
        WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP'
        ELSE 'LD'
      END
    FROM flipkart_master_sellers m 
    WHERE m.asin = ANY(asin_list)
    ON CONFLICT (asin) DO NOTHING;
    
    -- Repeat for sellers 2-6...
    INSERT INTO flipkart_brand_checking_seller_2 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
    SELECT m.id, 'RR', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark, 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new', CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
    FROM flipkart_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;
    
    INSERT INTO flipkart_brand_checking_seller_3 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
    SELECT m.id, 'UB', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark, 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new', CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
    FROM flipkart_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;
    
    INSERT INTO flipkart_brand_checking_seller_4 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
    SELECT m.id, 'VV', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark, 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new', CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
    FROM flipkart_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;
    
    INSERT INTO flipkart_brand_checking_seller_5 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
    SELECT m.id, 'DE', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark, 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new', CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
    FROM flipkart_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;
    
    INSERT INTO flipkart_brand_checking_seller_6 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, created_at, updated_at, remark, amz_link, funnel)
    SELECT m.id, 'CV', m.asin, m.link, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.created_at, m.updated_at, m.remark, 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemcondition=new', CASE WHEN m.monthly_unit > 60 THEN 'HD' WHEN m.monthly_unit BETWEEN 1 AND 60 THEN 'DP' ELSE 'LD' END
    FROM flipkart_master_sellers m WHERE m.asin = ANY(asin_list) ON CONFLICT (asin) DO NOTHING;
    
    RETURN json_build_object('success', true, 'inserted_count', inserted_count);
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
  
  BEGIN
    EXECUTE 'ALTER TABLE flipkart_master_sellers ENABLE TRIGGER ALL';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_1 ENABLE TRIGGER trg_flipkart_rebalance_1';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_2 ENABLE TRIGGER trg_flipkart_rebalance_2';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_3 ENABLE TRIGGER trg_flipkart_rebalance_3';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_4 ENABLE TRIGGER trg_flipkart_rebalance_4';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_5 ENABLE TRIGGER trg_flipkart_rebalance_5';
    EXECUTE 'ALTER TABLE flipkart_brand_checking_seller_6 ENABLE TRIGGER trg_flipkart_rebalance_6';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN json_build_object('success', false, 'error', error_message);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_insert_india_master_fast(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count int := 0;
BEGIN
  -- Disable user triggers for speed
  ALTER TABLE india_master_sellers DISABLE TRIGGER USER;
  
  WITH inserted AS (
    INSERT INTO india_master_sellers (
      asin, amz_link, product_name, remark, brand, price,
      monthly_unit, monthly_sales, bsr, seller, category,
      dimensions, weight, weight_unit, link, processing_status
    )
    SELECT 
      (elem->>'asin')::text,
      (elem->>'amz_link')::text,
      (elem->>'product_name')::text,
      COALESCE((elem->>'remark')::text, ''),  -- Clean remark, no markers
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
      (elem->>'link')::text,
      'pending_bc'  -- Mark for background processing
    FROM jsonb_array_elements(batch_data) elem
    ON CONFLICT (asin) DO UPDATE SET
      product_name = EXCLUDED.product_name,
      remark = EXCLUDED.remark,
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
      link = EXCLUDED.link,
      amz_link = EXCLUDED.amz_link,
      processing_status = 'pending_bc',  -- Re-queue for background
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted;

  -- Re-enable triggers
  ALTER TABLE india_master_sellers ENABLE TRIGGER USER;

  RETURN json_build_object('success', true, 'inserted_count', inserted_count);

EXCEPTION WHEN OTHERS THEN
  -- Always re-enable triggers even on error
  ALTER TABLE india_master_sellers ENABLE TRIGGER USER;
  RAISE;
END;
$function$;

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
 
  -- âœ… INSERT/UPDATE Master Table
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

CREATE OR REPLACE FUNCTION public.bulk_update_india_master_partial(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count int := 0;
BEGIN
  -- Create temp table for fast lookup
  CREATE TEMP TABLE IF NOT EXISTS temp_partial_updates (
    asin text PRIMARY KEY,
    remark text,
    monthly_unit numeric
  ) ON COMMIT DROP;

  -- Insert all updates into temp table (fast)
  INSERT INTO temp_partial_updates (asin, remark, monthly_unit)
  SELECT 
    (elem->>'asin')::text,
    (elem->>'remark')::text,
    (elem->>'monthly_unit')::numeric
  FROM jsonb_array_elements(batch_data) elem
  ON CONFLICT (asin) DO UPDATE SET
    remark = EXCLUDED.remark,
    monthly_unit = EXCLUDED.monthly_unit;

  -- Single UPDATE with JOIN (uses index, very fast)
  WITH updated AS (
    UPDATE india_master_sellers m
    SET 
      remark = COALESCE(t.remark, m.remark),
      monthly_unit = COALESCE(t.monthly_unit, m.monthly_unit),
      processing_status = 'pending_bc',
      updated_at = CURRENT_TIMESTAMP
    FROM temp_partial_updates t
    WHERE m.asin = t.asin
    RETURNING m.*
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  RETURN json_build_object('success', true, 'updated', updated_count);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.call_reset_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM reset_brand_progress_if_empty();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.distribute_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_table TEXT;
  funnel_tag TEXT;
  seller_id TEXT;
BEGIN
  -- Extract seller number (1, 2, 3, 4)
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'india_brand_checking_seller_(\d+)');
  
  -- BUSINESS RULES: Route based on monthly_unit
  IF NEW.monthly_unit > 60 THEN
    target_table := 'india_seller_' || seller_id || '_high_demand';
    funnel_tag := 'HD';
  ELSIF NEW.monthly_unit BETWEEN 1 AND 60 THEN
    target_table := 'india_seller_' || seller_id || '_dropshipping';
    funnel_tag := 'DP';
  ELSE  -- monthly_unit = 0 OR NULL
    target_table := 'india_seller_' || seller_id || '_low_demand';
    funnel_tag := 'LD';
  END IF;
  
  -- Insert into seller category table
  EXECUTE format(
    'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     ON CONFLICT (asin) DO NOTHING',
    target_table
  ) USING 
    NEW.asin, 
    NEW.product_name, 
    NEW.brand, 
    funnel_tag, 
    NEW.monthly_unit, 
    NEW.link, 
    NEW.amz_link,
    NEW.remark;
  
  RETURN NEW;
END;
$function$;

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

  -- Update master status: pending_bc â†’ pending_funnel
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

  -- âœ… NEW: Seller 5 (Dropy Ecom)
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

  -- âœ… NEW: Seller 6 (Costech Ventures)
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

CREATE OR REPLACE FUNCTION public.distribute_to_funnels_background()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  processed_count int := 0;
  asin_list text[];
BEGIN
  -- Find pending ASINs
  SELECT array_agg(asin) INTO asin_list
  FROM india_master_sellers
  WHERE processing_status = 'pending_funnel'
  LIMIT 1000;

  IF asin_list IS NULL OR array_length(asin_list, 1) = 0 THEN
    RETURN json_build_object('success', true, 'processed', 0, 'message', 'No pending items');
  END IF;

  -- Disable triggers
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

  -- Seller 1 funnels
  INSERT INTO india_seller_1_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) 
  SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark 
  FROM india_brand_checking_seller_1 
  WHERE asin = ANY(asin_list) AND monthly_unit > 60 
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  INSERT INTO india_seller_1_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) 
  SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark 
  FROM india_brand_checking_seller_1 
  WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  INSERT INTO india_seller_1_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) 
  SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark 
  FROM india_brand_checking_seller_1 
  WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) 
  ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  -- Seller 2 funnels
  INSERT INTO india_seller_2_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_2 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_2_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_2 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_2_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_2 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  -- Seller 3 funnels
  INSERT INTO india_seller_3_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_3 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_3_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_3 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_3_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_3 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  -- Seller 4 funnels
  INSERT INTO india_seller_4_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_4 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_4_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_4 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_4_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_4 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  -- Seller 5 funnels
  INSERT INTO india_seller_5_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_5 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_5_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_5 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_5_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_5 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  -- Seller 6 funnels
  INSERT INTO india_seller_6_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'HD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_6 WHERE asin = ANY(asin_list) AND monthly_unit > 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_6_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'DP', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_6 WHERE asin = ANY(asin_list) AND monthly_unit BETWEEN 1 AND 60 ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;
  INSERT INTO india_seller_6_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark) SELECT asin, product_name, brand, 'LD', monthly_unit, link, amz_link, remark FROM india_brand_checking_seller_6 WHERE asin = ANY(asin_list) AND (monthly_unit IS NULL OR monthly_unit <= 0) ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link, amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark;

  -- Mark as complete
  UPDATE india_master_sellers 
  SET processing_status = 'complete'
  WHERE asin = ANY(asin_list);

  -- Re-enable triggers
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

  processed_count := array_length(asin_list, 1);
  RETURN json_build_object('success', true, 'processed', processed_count);

EXCEPTION WHEN OTHERS THEN
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

CREATE OR REPLACE FUNCTION public.distribute_to_sellers_v2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.usa_brand_checking_seller_1 (
    source_id, tag, asin, link, product_name, brand, price,
    monthly_unit, monthly_sales, bsr, seller, category,
    dimensions, weight, weight_unit, created_at, updated_at
  )
  VALUES (
    NEW.id, 'S1', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr,
    NEW.seller, NEW.category, NEW.dimensions, NEW.weight,
    NEW.weight_unit, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO public.usa_brand_checking_seller_2 (
    source_id, tag, asin, link, product_name, brand, price,
    monthly_unit, monthly_sales, bsr, seller, category,
    dimensions, weight, weight_unit, created_at, updated_at
  )
  VALUES (
    NEW.id, 'S2', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr,
    NEW.seller, NEW.category, NEW.dimensions, NEW.weight,
    NEW.weight_unit, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO public.usa_brand_checking_seller_3 (
    source_id, tag, asin, link, product_name, brand, price,
    monthly_unit, monthly_sales, bsr, seller, category,
    dimensions, weight, weight_unit, created_at, updated_at
  )
  VALUES (
    NEW.id, 'S3', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr,
    NEW.seller, NEW.category, NEW.dimensions, NEW.weight,
    NEW.weight_unit, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_journey_limit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_journey_count integer;
  v_oldest_journey_id uuid;
BEGIN
  -- Count journeys for this ASIN
  SELECT COUNT(DISTINCT journey_number)
  INTO v_journey_count
  FROM usa_journey_history
  WHERE asin = NEW.asin;
  
  -- If we have 5 or more journeys, delete the oldest
  IF v_journey_count >= 5 THEN
    -- Get the oldest journey number
    SELECT id INTO v_oldest_journey_id
    FROM usa_journey_history
    WHERE asin = NEW.asin
    ORDER BY journey_number ASC
    LIMIT 1;
    
    -- Delete all records for the oldest journey
    DELETE FROM usa_journey_history
    WHERE asin = NEW.asin
    AND journey_number = (
      SELECT journey_number
      FROM usa_journey_history
      WHERE id = v_oldest_journey_id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_approve_product(p_asin text, p_seller_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    product_row RECORD;
    v_seller_tag TEXT;
    existing_tags TEXT;
    found_in_table TEXT;
BEGIN
    IF p_seller_id = 1 THEN v_seller_tag := 'GR';
    ELSIF p_seller_id = 2 THEN v_seller_tag := 'RR';
    ELSIF p_seller_id = 3 THEN v_seller_tag := 'UB';
    ELSIF p_seller_id = 4 THEN v_seller_tag := 'VV';
    ELSIF p_seller_id = 5 THEN v_seller_tag := 'DE';
    ELSIF p_seller_id = 6 THEN v_seller_tag := 'CV';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid seller_id');
    END IF;
    
    -- Find in HD
    EXECUTE format('SELECT * FROM flipkart_seller_%s_high_demand WHERE asin = $1', p_seller_id)
    INTO product_row USING p_asin;
    
    IF FOUND THEN
        found_in_table := format('flipkart_seller_%s_high_demand', p_seller_id);
    ELSE
        -- Find in LD
        EXECUTE format('SELECT * FROM flipkart_seller_%s_low_demand WHERE asin = $1', p_seller_id)
        INTO product_row USING p_asin;
        
        IF FOUND THEN
            found_in_table := format('flipkart_seller_%s_low_demand', p_seller_id);
        ELSE
            -- Find in DP
            EXECUTE format('SELECT * FROM flipkart_seller_%s_dropshipping WHERE asin = $1', p_seller_id)
            INTO product_row USING p_asin;
            
            IF FOUND THEN
                found_in_table := format('flipkart_seller_%s_dropshipping', p_seller_id);
            END IF;
        END IF;
    END IF;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Product not found in HD/LD/DP');
    END IF;
    
    -- Check if already approved
    SELECT seller_tag INTO existing_tags
    FROM flipkart_validation_main_file
    WHERE asin = p_asin;
    
    IF FOUND THEN
        IF existing_tags NOT LIKE '%' || v_seller_tag || '%' THEN
            UPDATE flipkart_validation_main_file
            SET seller_tag = existing_tags || ',' || v_seller_tag, updated_at = NOW()
            WHERE asin = p_asin;
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Already approved');
        END IF;
    ELSE
        INSERT INTO flipkart_validation_main_file (
            asin, product_name, brand, seller_tag, funnel, 
            monthly_unit, product_link, amz_link, flipkart_link
        )
        VALUES (
            product_row.asin, product_row.product_name, product_row.brand,
            v_seller_tag, product_row.funnel, product_row.monthly_unit,
            product_row.product_link, product_row.amz_link, product_row.product_link
        );
    END IF;
    
    -- DELETE from HD/LD/DP (trigger will auto-recalc progress)
    EXECUTE format('DELETE FROM %I WHERE asin = $1', found_in_table)
    USING p_asin;
    
    RETURN jsonb_build_object('success', true, 'message', 'Approved');
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_auto_distribute_to_funnels()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id text;
  target_table text;
BEGIN
  -- Extract seller ID from table name
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');
  
  -- Determine target funnel table
  target_table := 'flipkart_seller_' || seller_id || '_' ||
    CASE NEW.funnel
      WHEN 'HD' THEN 'high_demand'
      WHEN 'DP' THEN 'dropshipping'
      ELSE 'low_demand'
    END;
  
  -- Insert to funnel table
  EXECUTE format(
    'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (asin) DO UPDATE SET
       product_name = EXCLUDED.product_name,
       brand = EXCLUDED.brand,
       funnel = EXCLUDED.funnel,
       monthly_unit = EXCLUDED.monthly_unit,
       link = EXCLUDED.link,
       amz_link = EXCLUDED.amz_link,
       remark = EXCLUDED.remark',
    target_table
  )
  USING NEW.asin, NEW.product_name, NEW.brand, NEW.funnel, NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_distribute_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_table TEXT;
  funnel_tag TEXT;
  seller_id TEXT;
BEGIN
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'flipkart_brand_checking_seller_([0-9]+)');
  
  IF NEW.monthly_unit > 60 THEN
    target_table := 'flipkart_seller_' || seller_id || '_high_demand'; funnel_tag := 'HD';
  ELSIF NEW.monthly_unit BETWEEN 1 AND 60 THEN
    target_table := 'flipkart_seller_' || seller_id || '_dropshipping'; funnel_tag := 'DP';
  ELSE
    target_table := 'flipkart_seller_' || seller_id || '_low_demand'; funnel_tag := 'LD';
  END IF;

  EXECUTE format(
    'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (asin) DO NOTHING', target_table
  ) USING NEW.asin, NEW.product_name, NEW.brand, funnel_tag, NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_distribute_to_brand_checking_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  calculated_funnel text;
BEGIN
  -- Calculate funnel based on monthly_unit
  calculated_funnel := flipkart_get_funnel(NEW.monthly_unit);

  -- Distribute to ALL 6 sellers with calculated funnel
  INSERT INTO flipkart_brand_checking_seller_1 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'GA', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, NEW.amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO flipkart_brand_checking_seller_2 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'RR', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, NEW.amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO flipkart_brand_checking_seller_3 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'UB', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, NEW.amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO flipkart_brand_checking_seller_4 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'VV', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, NEW.amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO flipkart_brand_checking_seller_5 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'DE', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, NEW.amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO flipkart_brand_checking_seller_6 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'CV', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, NEW.amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_get_funnel(mu numeric)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF mu > 60 THEN
    RETURN 'HD';
  ELSIF mu BETWEEN 1 AND 60 THEN
    RETURN 'DP';
  ELSE
    RETURN 'LD';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_handle_brand_checking_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  sid INT;
BEGIN
  sid := split_part(TG_TABLE_NAME, '_', 5)::INT;
  PERFORM flipkart_recalc_brand_check_progress(sid);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_handle_not_approved_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  sid INT;
BEGIN
  sid := split_part(TG_TABLE_NAME, '_', 3)::INT;
  PERFORM flipkart_recalc_brand_check_progress(sid);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_handle_validation_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_tags TEXT[];
  tag TEXT;
  sid INT;
  raw_tags TEXT;
BEGIN
  raw_tags := COALESCE(NEW.seller_tag, OLD.seller_tag);
  
  IF raw_tags IS NULL THEN
    RETURN NULL;
  END IF;
  
  seller_tags := string_to_array(raw_tags, ',');
  
  FOREACH tag IN ARRAY seller_tags LOOP
    tag := trim(tag);
    
    IF tag = 'GR' THEN sid := 1;
    ELSIF tag = 'RR' THEN sid := 2;
    ELSIF tag = 'UB' THEN sid := 3;
    ELSIF tag = 'VV' THEN sid := 4;
    ELSIF tag = 'DE' THEN sid := 5;
    ELSIF tag = 'CV' THEN sid := 6;
    ELSE CONTINUE;
    END IF;
    
    PERFORM flipkart_recalc_brand_check_progress(sid);
  END LOOP;
  
  RETURN NULL;
END;
$function$;

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
  -- Since the error says new has no field link, we MUST use NEW.product_link.
  
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
    NEW.product_link, -- âœ… FIXED: Changed from NEW.link to NEW.product_link
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

CREATE OR REPLACE FUNCTION public.flipkart_rebalance_funnel_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  old_funnel text; new_funnel text; seller_id text; target_table text; old_table text;
BEGIN
  IF OLD.monthly_unit IS NOT DISTINCT FROM NEW.monthly_unit THEN RETURN NEW; END IF;
  
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');
  old_funnel := flipkart_get_funnel(OLD.monthly_unit);
  new_funnel := flipkart_get_funnel(NEW.monthly_unit);

  target_table := 'flipkart_seller_' || seller_id || '_' || CASE new_funnel WHEN 'HD' THEN 'high_demand' WHEN 'DP' THEN 'dropshipping' ELSE 'low_demand' END;

  IF old_funnel != new_funnel THEN
    old_table := 'flipkart_seller_' || seller_id || '_' || CASE old_funnel WHEN 'HD' THEN 'high_demand' WHEN 'DP' THEN 'dropshipping' ELSE 'low_demand' END;
    
    EXECUTE format('DELETE FROM %I WHERE asin = $1', old_table) USING NEW.asin;
    
    EXECUTE format(
      'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (asin) DO UPDATE SET 
       product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, funnel=EXCLUDED.funnel, 
       monthly_unit=EXCLUDED.monthly_unit, link=EXCLUDED.link, remark=EXCLUDED.remark', target_table
    ) USING NEW.asin, NEW.product_name, NEW.brand, new_funnel, NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark;
  ELSE
    EXECUTE format('UPDATE %I SET remark=$1, monthly_unit=$2, product_name=$3, brand=$4, link=$5 WHERE asin=$6', target_table)
    USING NEW.remark, NEW.monthly_unit, NEW.product_name, NEW.brand, NEW.link, NEW.asin;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flipkart_recalc_brand_check_progress(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    approved_cnt INT := 0;
    not_approved_cnt INT := 0;
    total_cnt INT := 0;
    v_seller_tag text;
BEGIN
    -- 1. Map Seller ID to Tag (Keep Flipkart's Tag Logic)
    IF p_seller_id = 1 THEN v_seller_tag := 'GR';
    ELSIF p_seller_id = 2 THEN v_seller_tag := 'RR';
    ELSIF p_seller_id = 3 THEN v_seller_tag := 'UB';
    ELSIF p_seller_id = 4 THEN v_seller_tag := 'VV';
    ELSIF p_seller_id = 5 THEN v_seller_tag := 'DE';
    ELSIF p_seller_id = 6 THEN v_seller_tag := 'CV';
    END IF;

    -- 2. APPROVED: Count from validation_main_file where seller_tag matches
    -- (Mirrors UK Logic)
    SELECT count(*) INTO approved_cnt 
    FROM public.flipkart_validation_main_file 
    WHERE seller_tag LIKE '%' || v_seller_tag || '%';

    -- 3. NOT APPROVED: Count from seller_X_not_approved
    -- (Mirrors UK Logic)
    EXECUTE format('SELECT count(*) FROM flipkart_seller_%s_not_approved', p_seller_id)
    INTO not_approved_cnt;

    -- 4. TOTAL: Count currently in Funnel (High Demand + Low Demand + Dropshipping)
    -- (Mirrors UK Logic - This was the major difference)
    EXECUTE format('
        SELECT 
            (SELECT count(*) FROM flipkart_seller_%s_high_demand) + 
            (SELECT count(*) FROM flipkart_seller_%s_low_demand) + 
            (SELECT count(*) FROM flipkart_seller_%s_dropshipping)
    ', p_seller_id, p_seller_id, p_seller_id)
    INTO total_cnt;

    -- 5. UPDATE the Dashboard Table
    UPDATE public.flipkart_brand_check_progress
    SET 
        approved = approved_cnt,
        not_approved = not_approved_cnt,
        total = total_cnt,
        updated_at = now()
    WHERE seller_id = p_seller_id;
    
    -- Safety: Insert row if it doesn't exist yet
    IF NOT FOUND THEN
        INSERT INTO public.flipkart_brand_check_progress 
        (seller_id, pending, approved, not_approved, rejected, total)
        VALUES (p_seller_id, 0, approved_cnt, not_approved_cnt, 0, total_cnt);
    END IF;
END;
$function$;

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

    -- 2. Smart Seller Routing (Handle 8 as count, etc.)
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
    -- We changed DO NOTHING to DO UPDATE SET...
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

CREATE OR REPLACE FUNCTION public.flipkart_sync_master_update_to_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE flipkart_brand_checking_seller_1 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, funnel = flipkart_get_funnel(NEW.monthly_unit) WHERE asin = NEW.asin;
  UPDATE flipkart_brand_checking_seller_2 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, funnel = flipkart_get_funnel(NEW.monthly_unit) WHERE asin = NEW.asin;
  UPDATE flipkart_brand_checking_seller_3 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, funnel = flipkart_get_funnel(NEW.monthly_unit) WHERE asin = NEW.asin;
  UPDATE flipkart_brand_checking_seller_4 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, funnel = flipkart_get_funnel(NEW.monthly_unit) WHERE asin = NEW.asin;
  UPDATE flipkart_brand_checking_seller_5 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, funnel = flipkart_get_funnel(NEW.monthly_unit) WHERE asin = NEW.asin;
  UPDATE flipkart_brand_checking_seller_6 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, funnel = flipkart_get_funnel(NEW.monthly_unit) WHERE asin = NEW.asin;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Generate Amazon India seller central link
  NEW.amz_link := 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemCondition=new';
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_flipkart_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Only generate if amz_link is empty (like India does)
  IF NEW.amz_link IS NULL OR NEW.amz_link = '' THEN
    NEW.amz_link := 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemcondition=new';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_uae_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Generate UAE Amazon Seller Central approval link (amazon.ae marketplace)
  NEW.amz_link := 
    'https://sellercentral.amazon.ae/hz/approvalrequest/restrictions/approve?asin=' 
    || NEW.asin 
    || '&itemcondition=new';
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_uk_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Generate UK Amazon Seller Central approval link (amazon.co.uk marketplace)
  NEW.amz_link := 
    'https://sellercentral.amazon.co.uk/hz/approvalrequest/restrictions/approve?asin=' 
    || NEW.asin 
    || '&itemcondition=new';
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_next_journey_number(p_asin text)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_max_journey integer;
BEGIN
  SELECT COALESCE(MAX(journey_number), 0)
  INTO v_max_journey
  FROM usa_journey_history
  WHERE asin = p_asin;
  
  RETURN v_max_journey + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inc_brand_check_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- ðŸ”’ DISABLED: approved comes ONLY from usa_validation_main_file
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.inc_brand_check_not_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- ðŸ”’ DISABLED: not_approved handled by recalc_brand_check_progress
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_brand_check_rejected(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update brand_check_progress
  set rejected = coalesce(rejected, 0) + 1
  where seller_id = p_seller_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.increment_not_approved(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE brand_check_progress
  SET not_approved = not_approved + 1,
      updated_at = now()
  WHERE seller_id = p_seller_id;
END;
$function$;

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

  -- âœ… FIXED: Added remark column (line 26) and NEW.remark value (line 30)
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

CREATE OR REPLACE FUNCTION public.india_distribute_to_brand_checking_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Seller 1 (GA)
  INSERT INTO public.india_brand_checking_seller_1 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark, amz_link
  )
  VALUES (
    NEW.id, 'GA', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark, NEW.amz_link
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 2 (RR)
  INSERT INTO public.india_brand_checking_seller_2 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark, amz_link
  )
  VALUES (
    NEW.id, 'RR', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark, NEW.amz_link
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 3 (UB)
  INSERT INTO public.india_brand_checking_seller_3 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark, amz_link
  )
  VALUES (
    NEW.id, 'UB', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark, NEW.amz_link
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 4 (VV)
  INSERT INTO public.india_brand_checking_seller_4 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark, amz_link
  )
  VALUES (
    NEW.id, 'VV', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark, NEW.amz_link
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 5 (DE)
  INSERT INTO public.india_brand_checking_seller_5 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark, amz_link
  )
  VALUES (
    NEW.id, 'DE', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark, NEW.amz_link
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 6 (CV)
  INSERT INTO public.india_brand_checking_seller_6 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark, amz_link
  )
  VALUES (
    NEW.id, 'CV', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark, NEW.amz_link
  )
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_generate_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.amz_link IS NULL OR NEW.amz_link = '' THEN
    NEW.amz_link := 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemcondition=new';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_get_funnel(mu numeric)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF mu > 60 THEN RETURN 'HD';
  ELSIF mu BETWEEN 1 AND 60 THEN RETURN 'DP';
  ELSE RETURN 'LD';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_rebalance_funnel_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  old_funnel text;
  new_funnel text;
  seller_id text;
  target_table text;
BEGIN
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');
  old_funnel := india_get_funnel(OLD.monthly_unit);
  new_funnel := india_get_funnel(NEW.monthly_unit);
  target_table := 'india_seller_' || seller_id || '_' ||
    CASE new_funnel WHEN 'HD' THEN 'high_demand' WHEN 'DP' THEN 'dropshipping' ELSE 'low_demand' END;

  IF old_funnel != new_funnel THEN
    EXECUTE format('DELETE FROM india_seller_%s_%s WHERE asin = $1', seller_id,
      CASE old_funnel WHEN 'HD' THEN 'high_demand' WHEN 'DP' THEN 'dropshipping' ELSE 'low_demand' END)
    USING NEW.asin;

    EXECUTE format(
      'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (asin) DO UPDATE SET
       product_name=EXCLUDED.product_name, brand=EXCLUDED.brand, funnel=EXCLUDED.funnel,
       monthly_unit=EXCLUDED.monthly_unit, product_link=EXCLUDED.product_link,
       amz_link=EXCLUDED.amz_link, remark=EXCLUDED.remark', target_table)
    USING NEW.asin, NEW.product_name, NEW.brand, new_funnel, NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark;
  ELSE
    EXECUTE format('UPDATE %I SET remark=$1, monthly_unit=$2, product_name=$3, brand=$4, product_link=$5, amz_link=$6 WHERE asin=$7', target_table)
    USING NEW.remark, NEW.monthly_unit, NEW.product_name, NEW.brand, NEW.link, NEW.amz_link, NEW.asin;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_recalc_brand_check_progress(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT := 0;
  not_approved_cnt INT := 0;
  total_cnt INT := 0;
BEGIN
  -- Count NOT APPROVED products
  EXECUTE format('SELECT COALESCE(COUNT(*), 0) FROM india_seller_%s_not_approved', p_seller_id)
  INTO not_approved_cnt;
  
  -- Count TOTAL products (HD + LD + DP)
  EXECUTE format('
    SELECT COALESCE((
      (SELECT COUNT(*) FROM india_seller_%s_high_demand) +
      (SELECT COUNT(*) FROM india_seller_%s_low_demand) +
      (SELECT COUNT(*) FROM india_seller_%s_dropshipping)
    ), 0)', p_seller_id, p_seller_id, p_seller_id)
  INTO total_cnt;
  
  -- For now, approved = total (adjust if you have validation logic)
  approved_cnt := total_cnt;
  
  -- Update or insert progress - CORRECTED column names
  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (p_seller_id, total_cnt, approved_cnt, not_approved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_sync_master_update_to_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE india_brand_checking_seller_1 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  UPDATE india_brand_checking_seller_2 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  UPDATE india_brand_checking_seller_3 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  UPDATE india_brand_checking_seller_4 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  UPDATE india_brand_checking_seller_5 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  UPDATE india_brand_checking_seller_6 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id INT;
BEGIN
  -- Extract seller number from table name
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)')::INT;
  
  -- Call the generic recalc function
  PERFORM india_recalc_brand_check_progress(seller_id);
  
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(2);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(3);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(4);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_5()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(5);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_6()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(6);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_seller1_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_seller5_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(5);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_seller6_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(6);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.india_trg_validation_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Recalc all sellers since seller_tag can contain multiple
  PERFORM india_recalc_brand_check_progress(1);
  PERFORM india_recalc_brand_check_progress(2);
  PERFORM india_recalc_brand_check_progress(3);
  PERFORM india_recalc_brand_check_progress(4);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_partial_updates_staging(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inserted_count int := 0;
BEGIN
  INSERT INTO india_master_partial_updates_staging (asin, remark, monthly_unit)
  SELECT 
    (elem->>'asin')::text,
    (elem->>'remark')::text,
    (elem->>'monthly_unit')::numeric
  FROM jsonb_array_elements(batch_data) elem
  WHERE (elem->>'asin')::text IS NOT NULL;
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  
  RETURN json_build_object('success', true, 'inserted', inserted_count);
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_partial_updates_staging(batch_limit integer DEFAULT 10)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  processed_count int := 0;
  failed_count int := 0;
BEGIN
  -- Update master table from staging (small batch)
  WITH pending_updates AS (
    SELECT id, asin, remark, monthly_unit
    FROM india_master_partial_updates_staging
    WHERE status = 'pending'
    ORDER BY created_at
    LIMIT batch_limit
    FOR UPDATE SKIP LOCKED
  ),
  updated_rows AS (
    UPDATE india_master_sellers m
    SET 
      remark = COALESCE(p.remark, m.remark),
      monthly_unit = COALESCE(p.monthly_unit, m.monthly_unit),
      processing_status = 'pending_bc',
      updated_at = CURRENT_TIMESTAMP
    FROM pending_updates p
    WHERE m.asin = p.asin
    RETURNING p.id
  )
  UPDATE india_master_partial_updates_staging s
  SET 
    status = 'completed',
    processed_at = CURRENT_TIMESTAMP
  FROM updated_rows u
  WHERE s.id = u.id;
  
  GET DIAGNOSTICS processed_count = ROW_COUNT;
  
  -- Mark ASINs that don't exist as failed
  UPDATE india_master_partial_updates_staging
  SET status = 'failed', processed_at = CURRENT_TIMESTAMP
  WHERE id IN (
    SELECT s.id
    FROM india_master_partial_updates_staging s
    LEFT JOIN india_master_sellers m ON s.asin = m.asin
    WHERE s.status = 'pending' AND m.asin IS NULL
    LIMIT batch_limit
  );
  
  GET DIAGNOSTICS failed_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true, 
    'processed', processed_count,
    'failed', failed_count,
    'remaining', (SELECT COUNT(*) FROM india_master_partial_updates_staging WHERE status = 'pending')
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rebalance_flipkart_funnels(asin_pattern text DEFAULT '%'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  seller_num int;
  moved_count int := 0;
  temp_count int;
  start_time timestamp := clock_timestamp();
  end_time timestamp;
BEGIN
  FOR seller_num IN 1..6 LOOP
    -- Delete from HD if no longer HD
    EXECUTE format('
      DELETE FROM flipkart_seller_%s_high_demand 
      WHERE asin LIKE $1 
      AND asin NOT IN (
        SELECT asin FROM flipkart_brand_checking_seller_%s 
        WHERE funnel = ''HD'' AND asin LIKE $1
      )',
      seller_num, seller_num
    ) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;
    
    -- Insert/Update HD
    EXECUTE format('
      INSERT INTO flipkart_seller_%s_high_demand (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
      SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark
      FROM flipkart_brand_checking_seller_%s 
      WHERE funnel = ''HD'' AND asin LIKE $1
      ON CONFLICT (asin) DO UPDATE SET 
        monthly_unit = EXCLUDED.monthly_unit, 
        remark = EXCLUDED.remark,
        product_name = EXCLUDED.product_name',
      seller_num, seller_num
    ) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;
    
    -- Delete from DP if no longer DP
    EXECUTE format('
      DELETE FROM flipkart_seller_%s_dropshipping 
      WHERE asin LIKE $1 
      AND asin NOT IN (
        SELECT asin FROM flipkart_brand_checking_seller_%s 
        WHERE funnel = ''DP'' AND asin LIKE $1
      )',
      seller_num, seller_num
    ) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;
    
    -- Insert/Update DP
    EXECUTE format('
      INSERT INTO flipkart_seller_%s_dropshipping (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
      SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark
      FROM flipkart_brand_checking_seller_%s 
      WHERE funnel = ''DP'' AND asin LIKE $1
      ON CONFLICT (asin) DO UPDATE SET 
        monthly_unit = EXCLUDED.monthly_unit, 
        remark = EXCLUDED.remark,
        product_name = EXCLUDED.product_name',
      seller_num, seller_num
    ) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;
    
    -- Delete from LD if no longer LD
    EXECUTE format('
      DELETE FROM flipkart_seller_%s_low_demand 
      WHERE asin LIKE $1 
      AND asin NOT IN (
        SELECT asin FROM flipkart_brand_checking_seller_%s 
        WHERE funnel = ''LD'' AND asin LIKE $1
      )',
      seller_num, seller_num
    ) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;
    
    -- Insert/Update LD
    EXECUTE format('
      INSERT INTO flipkart_seller_%s_low_demand (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
      SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark
      FROM flipkart_brand_checking_seller_%s 
      WHERE funnel = ''LD'' AND asin LIKE $1
      ON CONFLICT (asin) DO UPDATE SET 
        monthly_unit = EXCLUDED.monthly_unit, 
        remark = EXCLUDED.remark,
        product_name = EXCLUDED.product_name',
      seller_num, seller_num
    ) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;
  END LOOP;
  
  end_time := clock_timestamp();
  
  RETURN json_build_object(
    'success', true,
    'message', 'Funnel rebalancing completed successfully',
    'sellers_updated', 6,
    'total_operations', moved_count,
    'pattern', asin_pattern,
    'duration_seconds', EXTRACT(EPOCH FROM (end_time - start_time))
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_brand_check_progress(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_pending bigint;
    v_approved bigint;
    v_not_approved bigint;
    v_rejected bigint;
    v_seller_tag text;
    v_total bigint;
BEGIN
    -- 1. Identify Seller
    IF p_seller_id = 1 THEN v_seller_tag := 'GR';
    ELSIF p_seller_id = 2 THEN v_seller_tag := 'RR';
    ELSIF p_seller_id = 3 THEN v_seller_tag := 'UB'; -- UBeauty
    ELSIF p_seller_id = 4 THEN v_seller_tag := 'VV';
    END IF;

    -- 2. Count Approved (Shared)
    SELECT count(*) INTO v_approved 
    FROM public.usa_validation_main_file 
    WHERE seller_tag LIKE '%' || v_seller_tag || '%';

    -- 3. Count Pending (Dynamic)
    IF p_seller_id = 1 THEN
        SELECT count(*) INTO v_pending FROM public.usa_brand_checking_seller_1;
    ELSIF p_seller_id = 2 THEN
        SELECT count(*) INTO v_pending FROM public.usa_brand_checking_seller_2;
    ELSIF p_seller_id = 3 THEN
        SELECT count(*) INTO v_pending FROM public.usa_brand_checking_seller_3;
    ELSIF p_seller_id = 4 THEN
        SELECT count(*) INTO v_pending FROM public.usa_brand_checking_seller_4;
    ELSE
        v_pending := 0;
    END IF;

    -- 4. Count Not Approved (Dynamic)
    IF p_seller_id = 1 THEN
        SELECT count(*) INTO v_not_approved FROM public.usa_seller_1_not_approved;
    ELSIF p_seller_id = 2 THEN
        SELECT count(*) INTO v_not_approved FROM public.usa_seller_2_not_approved;
    ELSIF p_seller_id = 3 THEN
        SELECT count(*) INTO v_not_approved FROM public.usa_seller_3_not_approved;
    ELSIF p_seller_id = 4 THEN
        SELECT count(*) INTO v_not_approved FROM public.usa_seller_4_not_approved;
    ELSE
        v_not_approved := 0;
    END IF;

    -- 5. Count Rejected (Dynamic)
    IF p_seller_id = 1 THEN
        SELECT count(*) INTO v_rejected FROM public.usa_seller_1_reject;
    ELSIF p_seller_id = 2 THEN
        SELECT count(*) INTO v_rejected FROM public.usa_seller_2_reject;
    ELSIF p_seller_id = 3 THEN
        SELECT count(*) INTO v_rejected FROM public.usa_seller_3_reject;
    ELSIF p_seller_id = 4 THEN
        SELECT count(*) INTO v_rejected FROM public.usa_seller_4_reject;
    ELSE
        v_rejected := 0;
    END IF;

    -- 6. Calculate Total (Prevents Frontend Crash)
    v_total := v_pending + v_approved + v_not_approved + v_rejected;

    -- 7. Update Stats
    UPDATE public.brand_check_progress
    SET 
        pending = v_pending,
        approved = v_approved,
        not_approved = v_not_approved,
        rejected = v_rejected,
        total = v_total,
        updated_at = now()
    WHERE seller_id = p_seller_id;
    
    -- Insert if missing
    IF NOT FOUND THEN
        INSERT INTO public.brand_check_progress (seller_id, pending, approved, not_approved, rejected, total)
        VALUES (p_seller_id, v_pending, v_approved, v_not_approved, v_rejected, v_total);
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_brand_check_progress_for_seller(integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_brand_progress()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Do nothing - disabled
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_brand_progress(integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_brand_progress_generic(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Do nothing - disabled to prevent high_demand affecting dashboard
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_all_sellers_from_validation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check which sellers are affected and update only those
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Update all sellers mentioned in the seller_tag
    IF NEW.seller_tag LIKE '%GR%' THEN
      PERFORM refresh_india_progress_seller_1();
    END IF;
    IF NEW.seller_tag LIKE '%RR%' THEN
      PERFORM refresh_india_progress_seller_2();
    END IF;
    IF NEW.seller_tag LIKE '%UB%' THEN
      PERFORM refresh_india_progress_seller_3();
    END IF;
    IF NEW.seller_tag LIKE '%VV%' THEN
      PERFORM refresh_india_progress_seller_4();
    END IF;
    IF NEW.seller_tag LIKE '%DE%' THEN
      PERFORM refresh_india_progress_seller_5();
    END IF;
    IF NEW.seller_tag LIKE '%CV%' THEN
      PERFORM refresh_india_progress_seller_6();
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update all sellers mentioned in the old seller_tag
    IF OLD.seller_tag LIKE '%GR%' THEN
      PERFORM refresh_india_progress_seller_1();
    END IF;
    IF OLD.seller_tag LIKE '%RR%' THEN
      PERFORM refresh_india_progress_seller_2();
    END IF;
    IF OLD.seller_tag LIKE '%UB%' THEN
      PERFORM refresh_india_progress_seller_3();
    END IF;
    IF OLD.seller_tag LIKE '%VV%' THEN
      PERFORM refresh_india_progress_seller_4();
    END IF;
    IF OLD.seller_tag LIKE '%DE%' THEN
      PERFORM refresh_india_progress_seller_5();
    END IF;
    IF OLD.seller_tag LIKE '%CV%' THEN
      PERFORM refresh_india_progress_seller_6();
    END IF;
  END IF;
  
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_india_brand_check_progress()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_record RECORD;
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
  seller_codes TEXT[] := ARRAY['GR', 'RR', 'UB', 'VV', 'DE', 'CV'];  -- âœ… FIXED: GA â†’ GR
BEGIN
  -- Loop through all 6 sellers
  FOR i IN 1..6 LOOP
    -- âœ… APPROVED = Products with this seller tag (including multi-seller)
    SELECT COUNT(*) INTO approved_cnt
    FROM india_validation_main_file
    WHERE seller_tag LIKE '%' || seller_codes[i] || '%';  -- âœ… FIXED: Now matches multi-seller tags

    -- âœ… NOT APPROVED = Products in not_approved table
    EXECUTE format('SELECT COUNT(*) FROM india_seller_%s_not_approved', i)
    INTO notapproved_cnt;

    -- âœ… TOTAL = Only pending products (HD + LD + DS)
    EXECUTE format(
      'SELECT (SELECT COUNT(*) FROM india_seller_%s_high_demand) + 
              (SELECT COUNT(*) FROM india_seller_%s_low_demand) + 
              (SELECT COUNT(*) FROM india_seller_%s_dropshipping)',
      i, i, i
    )
    INTO total_cnt;

    -- âœ… UPDATE progress table (UPSERT)
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

CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_1()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
BEGIN
  -- Total = count from brand checking table
  SELECT COUNT(*) INTO total_cnt FROM india_brand_checking_seller_1;
  
  -- Approved = count from validation_main_file (after clicking approve)
  SELECT COUNT(*) INTO approved_cnt
  FROM india_validation_main_file
  WHERE seller_tag LIKE '%GR%';

  -- Not approved count
  SELECT COUNT(*) INTO notapproved_cnt FROM india_seller_1_not_approved;

  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (1, total_cnt, approved_cnt, notapproved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_2()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
BEGIN
  SELECT COUNT(*) INTO total_cnt FROM india_brand_checking_seller_2;
  SELECT COUNT(*) INTO approved_cnt FROM india_validation_main_file WHERE seller_tag LIKE '%RR%';
  SELECT COUNT(*) INTO notapproved_cnt FROM india_seller_2_not_approved;

  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (2, total_cnt, approved_cnt, notapproved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_3()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
BEGIN
  SELECT COUNT(*) INTO total_cnt FROM india_brand_checking_seller_3;
  SELECT COUNT(*) INTO approved_cnt FROM india_validation_main_file WHERE seller_tag LIKE '%UB%';
  SELECT COUNT(*) INTO notapproved_cnt FROM india_seller_3_not_approved;

  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (3, total_cnt, approved_cnt, notapproved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_4()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
BEGIN
  SELECT COUNT(*) INTO total_cnt FROM india_brand_checking_seller_4;
  SELECT COUNT(*) INTO approved_cnt FROM india_validation_main_file WHERE seller_tag LIKE '%VV%';
  SELECT COUNT(*) INTO notapproved_cnt FROM india_seller_4_not_approved;

  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (4, total_cnt, approved_cnt, notapproved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_5()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
BEGIN
  SELECT COUNT(*) INTO total_cnt FROM india_brand_checking_seller_5;
  SELECT COUNT(*) INTO approved_cnt FROM india_validation_main_file WHERE seller_tag LIKE '%DE%';
  SELECT COUNT(*) INTO notapproved_cnt FROM india_seller_5_not_approved;

  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (5, total_cnt, approved_cnt, notapproved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_6()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT;
  notapproved_cnt INT;
  total_cnt INT;
BEGIN
  SELECT COUNT(*) INTO total_cnt FROM india_brand_checking_seller_6;
  SELECT COUNT(*) INTO approved_cnt FROM india_validation_main_file WHERE seller_tag LIKE '%CV%';
  SELECT COUNT(*) INTO notapproved_cnt FROM india_seller_6_not_approved;

  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (6, total_cnt, approved_cnt, notapproved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_brand_progress_if_empty()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_progress_if_empty()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE brand_check_progress
  SET approved = 0,
      not_approved = 0,
      updated_at = now()
  WHERE total = 0;
END;
$function$;

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
  -- FIX: Changed from IS FOUND to IS NOT NULL
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

CREATE OR REPLACE FUNCTION public.sync_brand_check_total(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE brand_check_progress
  SET total =
    CASE p_seller_id
      WHEN 1 THEN
        (SELECT count(*) FROM usa_seller_1_high_demand) +
        (SELECT count(*) FROM usa_seller_1_low_demand) +
        (SELECT count(*) FROM usa_seller_1_dropshipping) +
        (SELECT count(*) FROM usa_seller_1_not_approved)
      WHEN 2 THEN
        (SELECT count(*) FROM usa_seller_2_high_demand) +
        (SELECT count(*) FROM usa_seller_2_low_demand) +
        (SELECT count(*) FROM usa_seller_2_dropshipping) +
        (SELECT count(*) FROM usa_seller_2_not_approved)
      WHEN 3 THEN
        (SELECT count(*) FROM usa_seller_3_high_demand) +
        (SELECT count(*) FROM usa_seller_3_low_demand) +
        (SELECT count(*) FROM usa_seller_3_dropshipping) +
        (SELECT count(*) FROM usa_seller_3_not_approved)
      WHEN 4 THEN
        (SELECT count(*) FROM usa_seller_4_high_demand) +
        (SELECT count(*) FROM usa_seller_4_low_demand) +
        (SELECT count(*) FROM usa_seller_4_dropshipping) +
        (SELECT count(*) FROM usa_seller_4_not_approved)
    END,
    updated_at = now()
  WHERE seller_id = p_seller_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_usa_admin_validation_origin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Sync origin and boolean columns
  IF NEW.origin IS NOT NULL THEN
    NEW.origin_india := (NEW.origin IN ('India', 'Both'));
    NEW.origin_china := (NEW.origin IN ('China', 'Both'));
  ELSIF NEW.origin_india IS NOT NULL OR NEW.origin_china IS NOT NULL THEN
    NEW.origin := CASE
      WHEN NEW.origin_india = true AND NEW.origin_china = true THEN 'Both'
      WHEN NEW.origin_china = true THEN 'China'
      WHEN NEW.origin_india = true THEN 'India'
      ELSE 'India'
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_usa_purchases_origin()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Sync origin and boolean columns
  IF NEW.origin IS NOT NULL THEN
    NEW.origin_india := (NEW.origin IN ('India', 'Both'));
    NEW.origin_china := (NEW.origin IN ('China', 'Both'));
  ELSIF NEW.origin_india IS NOT NULL OR NEW.origin_china IS NOT NULL THEN
    NEW.origin := CASE
      WHEN NEW.origin_india = true AND NEW.origin_china = true THEN 'Both'
      WHEN NEW.origin_china = true THEN 'China'
      WHEN NEW.origin_india = true THEN 'India'
      ELSE 'India'
    END;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_brand_check_router()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id INT;
BEGIN
  -- Extract seller_id from table name: usa_seller_2_low_demand â†’ 2
  seller_id := split_part(TG_TABLE_NAME, '_', 3)::INT;

  PERFORM recalc_brand_check_progress(seller_id);

  RETURN NULL;
END;
$function$;

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

  -- âœ… ONLY correct function
  PERFORM recalc_brand_check_progress(sid);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_handle_not_approved_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  sid INT;
BEGIN
  -- extract seller_id from table name: usa_seller_{id}_not_approved
  sid := split_part(TG_TABLE_NAME, '_', 3)::INT;

  PERFORM recalc_brand_check_progress(sid);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_handle_validation_approval()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  sid INT;
BEGIN
  -- Extract seller_id from seller_tag
  IF COALESCE(NEW.seller_tag, OLD.seller_tag) ILIKE '%GR%' THEN
    sid := 1;
  ELSIF COALESCE(NEW.seller_tag, OLD.seller_tag) ILIKE '%RR%' THEN
    sid := 2;
  ELSIF COALESCE(NEW.seller_tag, OLD.seller_tag) ILIKE '%UB%' THEN
    sid := 3;
  ELSIF COALESCE(NEW.seller_tag, OLD.seller_tag) ILIKE '%VV%' THEN
    sid := 4;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Call correct recalc function
  PERFORM recalc_brand_check_progress(sid);

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_inc_na_s2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(2);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_inc_na_s3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(3);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_inc_na_s4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(4);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_inc_not_approved_s1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(1);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_progress_seller_1();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_progress_seller_2();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_progress_seller_3();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_progress_seller_4();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_5()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_progress_seller_5();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_6()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_progress_seller_6();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalc_from_table()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Do nothing - disabled to prevent high_demand affecting dashboard
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_india_progress()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_brand_check_progress();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_india_progress_seller()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_brand_check_progress();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_refresh_india_progress_validation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Refresh progress for the specific seller
  PERFORM refresh_india_brand_check_progress();
  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_bulk_update_master_partial(p_table text, p_asins text[], p_remarks text[], p_monthly_units numeric[])
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  updated_count integer;
BEGIN
  EXECUTE format(
    'UPDATE %I t
     SET
       remark = v.remark,
       monthly_unit = v.monthly_unit,
       updated_at = now()
     FROM (
       SELECT
         unnest($1) AS asin,
         unnest($2) AS remark,
         unnest($3) AS monthly_unit
     ) v
     WHERE t.asin = v.asin',
    p_table
  )
  USING p_asins, p_remarks, p_monthly_units;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_distribute_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_table TEXT;
  funnel_tag TEXT;
  seller_id TEXT;
BEGIN
  -- Extract seller number (1, 2, 3, 4) from table name
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'uae_brand_checking_seller_([0-9]+)');

  -- BUSINESS RULES: Distribute based on monthly_unit
  IF NEW.monthly_unit > 60 THEN
    -- HIGH DEMAND
    target_table := 'uae_seller_' || seller_id || '_high_demand';
    funnel_tag := 'HD';

  ELSIF NEW.monthly_unit BETWEEN 1 AND 60 THEN
    -- DROPSHIPPING
    target_table := 'uae_seller_' || seller_id || '_dropshipping';
    funnel_tag := 'DP';

  ELSE
    -- LOW DEMAND (monthly_unit <= 0 OR NULL)
    target_table := 'uae_seller_' || seller_id || '_low_demand';
    funnel_tag := 'LD';
  END IF;

  -- Insert into appropriate seller funnel table
  EXECUTE format(
    'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (asin) DO NOTHING',
    target_table
  )
  USING 
    NEW.asin, 
    NEW.product_name, 
    NEW.brand, 
    funnel_tag, 
    NEW.monthly_unit, 
    NEW.link, 
    NEW.amz_link, 
    NEW.remark;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_distribute_to_brand_checking_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Seller 1 (S1)
  INSERT INTO public.uae_brand_checking_seller_1 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S1', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 2 (S2)
  INSERT INTO public.uae_brand_checking_seller_2 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S2', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 3 (S3)
  INSERT INTO public.uae_brand_checking_seller_3 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S3', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 4 (S4)
  INSERT INTO public.uae_brand_checking_seller_4 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S4', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_get_funnel(mu numeric)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF mu > 60 THEN
    RETURN 'HD';
  ELSIF mu BETWEEN 1 AND 60 THEN
    RETURN 'DP';
  ELSE
    RETURN 'LD';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_rebalance_funnel_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  old_funnel text;
  new_funnel text;
  seller_id text;
BEGIN
  IF OLD.monthly_unit IS NOT DISTINCT FROM NEW.monthly_unit THEN
    RETURN NEW;
  END IF;

  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');

  old_funnel := uae_get_funnel(OLD.monthly_unit);
  new_funnel := uae_get_funnel(NEW.monthly_unit);

  IF old_funnel = new_funnel THEN
    RETURN NEW;
  END IF;

  -- DELETE from old funnel
  EXECUTE format(
    'DELETE FROM uae_seller_%s_%s WHERE asin = $1',
    seller_id,
    CASE old_funnel
      WHEN 'HD' THEN 'high_demand'
      WHEN 'DP' THEN 'dropshipping'
      ELSE 'low_demand'
    END
  )
  USING NEW.asin;

  -- INSERT into new funnel
  EXECUTE format(
    'INSERT INTO uae_seller_%s_%s
     (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (asin) DO NOTHING',
    seller_id,
    CASE new_funnel
      WHEN 'HD' THEN 'high_demand'
      WHEN 'DP' THEN 'dropshipping'
      ELSE 'low_demand'
    END
  )
  USING
    NEW.asin,
    NEW.product_name,
    NEW.brand,
    new_funnel,
    NEW.monthly_unit,
    NEW.link,
    NEW.amz_link,
    NEW.remark;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_recalc_brand_check_progress(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT := 0;
  not_approved_cnt INT := 0;
  total_cnt INT := 0;
BEGIN
  -- APPROVED: Count from validation_main_file where seller_tag matches
  SELECT COUNT(*) INTO approved_cnt
  FROM uae_validation_main_file
  WHERE seller_tag IS NOT NULL
    AND (
      (p_seller_id = 1 AND seller_tag ILIKE '%GR%') OR
      (p_seller_id = 2 AND seller_tag ILIKE '%RR%') OR
      (p_seller_id = 3 AND seller_tag ILIKE '%UB%') OR
      (p_seller_id = 4 AND seller_tag ILIKE '%VV%')
    );

  -- NOT APPROVED: Count from seller_X_not_approved
  EXECUTE format('SELECT COUNT(*) FROM uae_seller_%s_not_approved', p_seller_id)
  INTO not_approved_cnt;

  -- TOTAL: Count from high_demand + low_demand + dropshipping
  EXECUTE format('
    SELECT 
      (SELECT COUNT(*) FROM uae_seller_%s_high_demand) +
      (SELECT COUNT(*) FROM uae_seller_%s_low_demand) +
      (SELECT COUNT(*) FROM uae_seller_%s_dropshipping)
  ', p_seller_id, p_seller_id, p_seller_id)
  INTO total_cnt;

  -- UPDATE dashboard table
  UPDATE uae_brand_check_progress
  SET 
    approved = approved_cnt,
    not_approved = not_approved_cnt,
    total = total_cnt,
    updated_at = NOW()
  WHERE seller_id = p_seller_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_sync_master_update_to_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Seller 1
  UPDATE uae_brand_checking_seller_1
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  -- Seller 2
  UPDATE uae_brand_checking_seller_2
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  -- Seller 3
  UPDATE uae_brand_checking_seller_3
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  -- Seller 4
  UPDATE uae_brand_checking_seller_4
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(2);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(3);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(4);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uae_trg_validation_approval()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check NEW value (INSERT or UPDATE)
  IF NEW.seller_tag IS NOT NULL THEN
    IF NEW.seller_tag ILIKE '%GR%' THEN
      PERFORM uae_recalc_brand_check_progress(1);
    END IF;
    
    IF NEW.seller_tag ILIKE '%RR%' THEN
      PERFORM uae_recalc_brand_check_progress(2);
    END IF;
    
    IF NEW.seller_tag ILIKE '%UB%' THEN
      PERFORM uae_recalc_brand_check_progress(3);
    END IF;
    
    IF NEW.seller_tag ILIKE '%VV%' THEN
      PERFORM uae_recalc_brand_check_progress(4);
    END IF;
  END IF;
  
  -- Check OLD value (UPDATE - removed tag or DELETE)
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    IF OLD.seller_tag IS NOT NULL THEN
      IF OLD.seller_tag ILIKE '%GR%' THEN
        PERFORM uae_recalc_brand_check_progress(1);
      END IF;
      
      IF OLD.seller_tag ILIKE '%RR%' THEN
        PERFORM uae_recalc_brand_check_progress(2);
      END IF;
      
      IF OLD.seller_tag ILIKE '%UB%' THEN
        PERFORM uae_recalc_brand_check_progress(3);
      END IF;
      
      IF OLD.seller_tag ILIKE '%VV%' THEN
        PERFORM uae_recalc_brand_check_progress(4);
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_distribute_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_table TEXT;
  funnel_tag TEXT;
  seller_id TEXT;
BEGIN
  -- Extract seller number (1, 2, 3, 4) from table name
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'uk_brand_checking_seller_([0-9]+)');

  -- BUSINESS RULES: Distribute based on monthly_unit
  IF NEW.monthly_unit > 60 THEN
    -- HIGH DEMAND
    target_table := 'uk_seller_' || seller_id || '_high_demand';
    funnel_tag := 'HD';

  ELSIF NEW.monthly_unit BETWEEN 1 AND 60 THEN
    -- DROPSHIPPING
    target_table := 'uk_seller_' || seller_id || '_dropshipping';
    funnel_tag := 'DP';

  ELSE
    -- LOW DEMAND (monthly_unit <= 0 OR NULL)
    target_table := 'uk_seller_' || seller_id || '_low_demand';
    funnel_tag := 'LD';
  END IF;

  -- Insert into appropriate seller funnel table
  EXECUTE format(
    'INSERT INTO %I (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (asin) DO NOTHING',
    target_table
  )
  USING 
    NEW.asin, 
    NEW.product_name, 
    NEW.brand, 
    funnel_tag, 
    NEW.monthly_unit, 
    NEW.link, 
    NEW.amz_link, 
    NEW.remark;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_distribute_to_brand_checking_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Seller 1 (S1)
  INSERT INTO public.uk_brand_checking_seller_1 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S1', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 2 (S2)
  INSERT INTO public.uk_brand_checking_seller_2 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S2', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 3 (S3)
  INSERT INTO public.uk_brand_checking_seller_3 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S3', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 4 (S4)
  INSERT INTO public.uk_brand_checking_seller_4 (
    source_id, tag, asin, link, product_name, brand, price, 
    monthly_unit, monthly_sales, bsr, seller, category, dimensions, 
    weight, weight_unit, created_at, updated_at, remark
  )
  VALUES (
    NEW.id, 'S4', NEW.asin, NEW.link, NEW.product_name, NEW.brand,
    NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller,
    NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit,
    NEW.created_at, NEW.updated_at, NEW.remark
  )
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_get_funnel(mu numeric)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF mu > 60 THEN
    RETURN 'HD';
  ELSIF mu BETWEEN 1 AND 60 THEN
    RETURN 'DP';
  ELSE
    RETURN 'LD';
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_rebalance_funnel_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  old_funnel text;
  new_funnel text;
  seller_id text;
  target_table text;
BEGIN
  -- Extract seller number
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');

  -- Determine funnels
  old_funnel := uk_get_funnel(OLD.monthly_unit);
  new_funnel := uk_get_funnel(NEW.monthly_unit);

  -- Target table name
  target_table := 'uk_seller_' || seller_id || '_' ||
    CASE new_funnel
      WHEN 'HD' THEN 'high_demand'
      WHEN 'DP' THEN 'dropshipping'
      ELSE 'low_demand'
    END;

  -- Case 1: Funnel changed (move product)
  IF old_funnel != new_funnel THEN
    -- Delete from old funnel
    EXECUTE format(
      'DELETE FROM uk_seller_%s_%s WHERE asin = $1',
      seller_id,
      CASE old_funnel
        WHEN 'HD' THEN 'high_demand'
        WHEN 'DP' THEN 'dropshipping'
        ELSE 'low_demand'
      END
    )
    USING NEW.asin;

    -- Insert to new funnel
    EXECUTE format(
      'INSERT INTO %I
       (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (asin) DO UPDATE SET
         product_name = EXCLUDED.product_name,
         brand = EXCLUDED.brand,
         funnel = EXCLUDED.funnel,
         monthly_unit = EXCLUDED.monthly_unit,
         product_link = EXCLUDED.product_link,
         amz_link = EXCLUDED.amz_link,
         remark = EXCLUDED.remark',
      target_table
    )
    USING
      NEW.asin,
      NEW.product_name,
      NEW.brand,
      new_funnel,
      NEW.monthly_unit,
      NEW.link,
      NEW.amz_link,
      NEW.remark;

  -- Case 2: Same funnel, just update fields
  ELSE
    EXECUTE format(
      'UPDATE %I SET
         remark = $1,
         monthly_unit = $2,
         product_name = $3,
         brand = $4,
         product_link = $5,
         amz_link = $6
       WHERE asin = $7',
      target_table
    )
    USING
      NEW.remark,
      NEW.monthly_unit,
      NEW.product_name,
      NEW.brand,
      NEW.link,
      NEW.amz_link,
      NEW.asin;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_recalc_brand_check_progress(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT := 0;
  not_approved_cnt INT := 0;
  total_cnt INT := 0;
BEGIN
  -- APPROVED: Count from validation_main_file where seller_tag matches
  SELECT COUNT(*) INTO approved_cnt
  FROM uk_validation_main_file
  WHERE seller_tag IS NOT NULL
    AND (
      (p_seller_id = 1 AND seller_tag ILIKE '%GR%') OR
      (p_seller_id = 2 AND seller_tag ILIKE '%RR%') OR
      (p_seller_id = 3 AND seller_tag ILIKE '%UB%') OR
      (p_seller_id = 4 AND seller_tag ILIKE '%VV%')
    );

  -- NOT APPROVED: Count from seller_X_not_approved
  EXECUTE format('SELECT COUNT(*) FROM uk_seller_%s_not_approved', p_seller_id)
  INTO not_approved_cnt;

  -- TOTAL: Count from high_demand + low_demand + dropshipping
  EXECUTE format('
    SELECT 
      (SELECT COUNT(*) FROM uk_seller_%s_high_demand) +
      (SELECT COUNT(*) FROM uk_seller_%s_low_demand) +
      (SELECT COUNT(*) FROM uk_seller_%s_dropshipping)
  ', p_seller_id, p_seller_id, p_seller_id)
  INTO total_cnt;

  -- UPDATE dashboard table
  UPDATE uk_brand_check_progress
  SET 
    approved = approved_cnt,
    not_approved = not_approved_cnt,
    total = total_cnt,
    updated_at = NOW()
  WHERE seller_id = p_seller_id;

END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_sync_master_update_to_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Seller 1
  UPDATE uk_brand_checking_seller_1
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  -- Seller 2
  UPDATE uk_brand_checking_seller_2
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  -- Seller 3
  UPDATE uk_brand_checking_seller_3
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  -- Seller 4
  UPDATE uk_brand_checking_seller_4
  SET
    remark = NEW.remark,
    monthly_unit = NEW.monthly_unit,
    updated_at = now()
  WHERE asin = NEW.asin;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(2);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(3);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(4);
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.uk_trg_validation_approval()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Check NEW value (INSERT or UPDATE)
  IF NEW.seller_tag IS NOT NULL THEN
    IF NEW.seller_tag ILIKE '%GR%' THEN
      PERFORM uk_recalc_brand_check_progress(1);
    END IF;
    
    IF NEW.seller_tag ILIKE '%RR%' THEN
      PERFORM uk_recalc_brand_check_progress(2);
    END IF;
    
    IF NEW.seller_tag ILIKE '%UB%' THEN
      PERFORM uk_recalc_brand_check_progress(3);
    END IF;
    
    IF NEW.seller_tag ILIKE '%VV%' THEN
      PERFORM uk_recalc_brand_check_progress(4);
    END IF;
  END IF;
  
  -- Check OLD value (UPDATE - removed tag or DELETE)
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    IF OLD.seller_tag IS NOT NULL THEN
      IF OLD.seller_tag ILIKE '%GR%' THEN
        PERFORM uk_recalc_brand_check_progress(1);
      END IF;
      
      IF OLD.seller_tag ILIKE '%RR%' THEN
        PERFORM uk_recalc_brand_check_progress(2);
      END IF;
      
      IF OLD.seller_tag ILIKE '%UB%' THEN
        PERFORM uk_recalc_brand_check_progress(3);
      END IF;
      
      IF OLD.seller_tag ILIKE '%VV%' THEN
        PERFORM uk_recalc_brand_check_progress(4);
      END IF;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_admin_constants_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_brand_check_progress(integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_low_demand_remark_batch(seller_id integer, batch_limit integer DEFAULT 1000)
 RETURNS TABLE(rows_updated integer, message text)
 LANGUAGE plpgsql
AS $function$
DECLARE
    table_name TEXT;
    brand_check_table TEXT;
    updated INT;
BEGIN
    -- Build table names
    table_name := 'india_seller_' || seller_id || '_low_demand';
    brand_check_table := 'india_brand_checking_seller_' || seller_id;
    
    -- Execute dynamic update
    EXECUTE format('
        WITH batch AS (
            SELECT id 
            FROM %I 
            WHERE remark IS NULL 
            ORDER BY id 
            LIMIT $1
        )
        UPDATE %I AS ld
        SET remark = bc.remark
        FROM %I AS bc, batch
        WHERE ld.id = batch.id
        AND ld.asin = bc.asin
    ', table_name, table_name, brand_check_table)
    USING batch_limit;
    
    GET DIAGNOSTICS updated = ROW_COUNT;
    
    RETURN QUERY SELECT updated, 'Seller ' || seller_id || ': Updated ' || updated || ' rows';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_velvet_vista_counts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE listing_error_progress
  SET 
    total_pending = (SELECT count(*) FROM usa_listing_error_seller_4_pending),
    listed = (SELECT count(*) FROM usa_listing_error_seller_4_listed), -- Remove if table doesn't exist yet
    updated_at = now()
  WHERE seller_id = 4;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_vv_pending_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE listing_error_progress
  SET 
    total_pending = (SELECT count(*) FROM usa_listing_error_seller_4_pending),
    updated_at = now()
  WHERE seller_id = 4;
  RETURN NULL;
END;
$function$;

