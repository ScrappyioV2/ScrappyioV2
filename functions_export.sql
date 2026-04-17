CREATE OR REPLACE FUNCTION public.approve_to_validation(p_asin text, p_product_name text, p_brand text, p_seller_code text, p_funnel text, p_india_link text, p_amz_link text, p_remark text, p_sku text DEFAULT NULL::text, p_category text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE 
  existing TEXT;
  v_category TEXT;
BEGIN
  -- If category not passed, fetch from master
  v_category := p_category;
  IF v_category IS NULL OR v_category = '' THEN
    SELECT category INTO v_category FROM india_master_sellers WHERE asin = p_asin;
  END IF;

  SELECT seller_tag INTO existing FROM india_validation_main_file WHERE asin=p_asin;
  IF FOUND THEN
    IF existing NOT LIKE '%'||p_seller_code||'%' THEN
      UPDATE india_validation_main_file SET seller_tag=existing||','||p_seller_code WHERE asin=p_asin;
    END IF;
  ELSE
    INSERT INTO india_validation_main_file (asin,product_name,brand,seller_tag,funnel,india_link,amz_link,remark,sku,amazon_category)
    VALUES (p_asin,p_product_name,p_brand,p_seller_code,p_funnel,p_india_link,p_amz_link,p_remark,p_sku,v_category);
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.auto_insert_listing_error()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE sid INT; ex INT;
BEGIN
  IF NEW.admin_status<>'confirmed' THEN RETURN NEW; END IF;
  sid:=CASE NEW.seller_tag WHEN 'GR' THEN 1 WHEN 'RR' THEN 2 WHEN 'UB' THEN 3 WHEN 'VV' THEN 4 ELSE NULL END;
  IF sid IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO ex FROM listing_errors WHERE marketplace='usa' AND seller_id=sid AND asin=NEW.asin AND error_status!='movement_history';
  IF ex>0 THEN RETURN NEW; END IF;
  INSERT INTO listing_errors (marketplace,seller_id,error_status,asin,product_name,selling_price,seller_link)
  VALUES ('usa',sid,'pending',NEW.asin,NEW.product_name,NEW.admin_target_price,NEW.seller_link);
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.auto_populate_usa_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW.usa_link IS NULL AND NEW.asin IS NOT NULL THEN
        NEW.usa_link := 'https://www.amazon.com/dp/' || NEW.asin || '?th=1&psc=1';
    END IF;
    RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_insert_flipkart_master_with_distribution(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE ic INT:=0; uc INT:=0; al TEXT[]; ip BOOLEAN; s INT; tags TEXT[]:=ARRAY['GR','RR','UB','VV','DE','CV'];
BEGIN
  IF jsonb_array_length(batch_data)>500 THEN RETURN json_build_object('success',false,'error','Batch too large'); END IF;
  SELECT array_agg((e->>'asin')::text) INTO al FROM jsonb_array_elements(batch_data) e;
  SELECT (e->>'product_name') IS NULL INTO ip FROM jsonb_array_elements(batch_data) e LIMIT 1;

  IF ip THEN
    UPDATE flipkart_master_sellers m SET monthly_unit=NULLIF((e->>'monthly_unit')::text,'')::numeric,remark=(e->>'remark')::text
    FROM jsonb_array_elements(batch_data) e WHERE m.asin=(e->>'asin')::text;
    GET DIAGNOSTICS uc=ROW_COUNT;
    UPDATE brand_checking bc SET monthly_unit=m.monthly_unit,remark=m.remark,funnel=unified_get_funnel(m.monthly_unit)
    FROM flipkart_master_sellers m WHERE bc.marketplace='flipkart' AND bc.asin=m.asin AND m.asin=ANY(al);
    UPDATE seller_products sp SET product_status=funnel_to_product_status(unified_get_funnel(m.monthly_unit)),funnel=unified_get_funnel(m.monthly_unit),monthly_unit=m.monthly_unit,remark=m.remark
    FROM flipkart_master_sellers m WHERE sp.marketplace='flipkart' AND sp.asin=m.asin AND m.asin=ANY(al) AND sp.product_status IN ('high_demand','dropshipping','low_demand');
    RETURN json_build_object('success',true,'updated_count',uc);
  ELSE
    INSERT INTO flipkart_master_sellers (asin,amz_link,product_name,remark,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,link)
    SELECT (e->>'asin')::text,(e->>'amz_link')::text,(e->>'product_name')::text,(e->>'remark')::text,(e->>'brand')::text,
      NULLIF((e->>'price')::text,'')::numeric,NULLIF((e->>'monthly_unit')::text,'')::numeric,NULLIF((e->>'monthly_sales')::text,'')::numeric,
      NULLIF((e->>'bsr')::text,'')::numeric,NULLIF((e->>'seller')::text,'')::numeric,(e->>'category')::text,(e->>'dimensions')::text,
      NULLIF((e->>'weight')::text,'')::numeric,(e->>'weight_unit')::text,(e->>'link')::text
    FROM jsonb_array_elements(batch_data) e ON CONFLICT (asin) DO NOTHING;
    GET DIAGNOSTICS ic=ROW_COUNT;
    FOR s IN 1..6 LOOP
      INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel)
      SELECT 'flipkart',s,m.id,tags[s],m.asin,m.link,m.product_name,m.brand,m.price,m.monthly_unit,m.monthly_sales,m.bsr,m.seller,m.category,m.dimensions,m.weight,m.weight_unit,m.remark,
        'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='||m.asin||'&itemcondition=new',unified_get_funnel(m.monthly_unit)
      FROM flipkart_master_sellers m WHERE m.asin=ANY(al) ON CONFLICT (marketplace,seller_id,asin) DO NOTHING;
      INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,product_status)
      SELECT 'flipkart',s,bc.asin,bc.product_name,bc.brand,bc.funnel,bc.monthly_unit,bc.link,bc.amz_link,bc.remark,funnel_to_product_status(bc.funnel)
      FROM brand_checking bc WHERE bc.marketplace='flipkart' AND bc.seller_id=s AND bc.asin=ANY(al)
      ON CONFLICT (marketplace,seller_id,asin) WHERE product_status!='movement_history' DO NOTHING;
    END LOOP;
    RETURN json_build_object('success',true,'inserted_count',ic);
  END IF;
EXCEPTION WHEN OTHERS THEN RETURN json_build_object('success',false,'error',SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_insert_india_master_fast(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ic INT:=0;
BEGIN
  ALTER TABLE india_master_sellers DISABLE TRIGGER USER;
  WITH ins AS (INSERT INTO india_master_sellers (asin,amz_link,product_name,remark,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,link,processing_status)
    SELECT (e->>'asin')::text,(e->>'amz_link')::text,(e->>'product_name')::text,COALESCE((e->>'remark')::text,''),(e->>'brand')::text,(e->>'price')::numeric,
      (e->>'monthly_unit')::numeric,(e->>'monthly_sales')::numeric,(e->>'bsr')::numeric,(e->>'seller')::numeric,(e->>'category')::text,
      (e->>'dimensions')::text,(e->>'weight')::numeric,(e->>'weight_unit')::text,(e->>'link')::text,'pending_bc'
    FROM jsonb_array_elements(batch_data) e ON CONFLICT (asin) DO UPDATE SET product_name=EXCLUDED.product_name,remark=EXCLUDED.remark,brand=EXCLUDED.brand,price=EXCLUDED.price,
      monthly_unit=EXCLUDED.monthly_unit,monthly_sales=EXCLUDED.monthly_sales,bsr=EXCLUDED.bsr,seller=EXCLUDED.seller,category=EXCLUDED.category,dimensions=EXCLUDED.dimensions,
      weight=EXCLUDED.weight,weight_unit=EXCLUDED.weight_unit,link=EXCLUDED.link,amz_link=EXCLUDED.amz_link,processing_status='pending_bc',updated_at=CURRENT_TIMESTAMP RETURNING *)
  SELECT COUNT(*) INTO ic FROM ins;
  ALTER TABLE india_master_sellers ENABLE TRIGGER USER;
  RETURN json_build_object('success',true,'inserted_count',ic);
EXCEPTION WHEN OTHERS THEN ALTER TABLE india_master_sellers ENABLE TRIGGER USER; RAISE;
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_insert_india_master_only(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  inserted_count int := 0;
BEGIN
  INSERT INTO india_master_sellers (
    asin, product_name, brand, price, monthly_unit, monthly_sales,
    bsr, seller, category, dimensions, weight, weight_unit,
    link, amz_link, remark, funnel
  )
  SELECT
    (rec->>'asin')::text,
    (rec->>'product_name')::text,
    (rec->>'brand')::text,
    (rec->>'price')::numeric,
    COALESCE((rec->>'monthly_unit')::numeric, 0),
    (rec->>'monthly_sales')::numeric,
    (rec->>'bsr')::numeric,
    (rec->>'seller')::numeric,
    (rec->>'category')::text,
    (rec->>'dimensions')::text,
    (rec->>'weight')::numeric,
    (rec->>'weight_unit')::text,
    (rec->>'link')::text,
    (rec->>'amz_link')::text,
    (rec->>'remark')::text,
    CASE WHEN COALESCE((rec->>'monthly_unit')::numeric, 0) >= 5 THEN 'RS' ELSE 'DP' END
  FROM jsonb_array_elements(batch_data) AS rec
  ON CONFLICT (asin) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN jsonb_build_object('inserted_count', inserted_count);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_insert_india_master_with_distribution(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE ic INT:=0; al TEXT[]; s INT; tags TEXT[]:=ARRAY['GR','RR','UB','VV','DE','CV','MV','KL'];
BEGIN
  SELECT array_agg((e->>'asin')::text) INTO al FROM jsonb_array_elements(batch_data) e;
  ALTER TABLE india_master_sellers DISABLE TRIGGER USER;
  INSERT INTO india_master_sellers (asin,amz_link,product_name,remark,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,link,sku)
  SELECT (e->>'asin')::text,(e->>'amz_link')::text,(e->>'product_name')::text,(e->>'remark')::text,(e->>'brand')::text,(e->>'price')::numeric,
    (e->>'monthly_unit')::numeric,(e->>'monthly_sales')::numeric,(e->>'bsr')::numeric,(e->>'seller')::numeric,
    (e->>'category')::text,(e->>'dimensions')::text,(e->>'weight')::numeric,(e->>'weight_unit')::text,(e->>'link')::text,(e->>'sku')::text
  FROM jsonb_array_elements(batch_data) e
  ON CONFLICT (asin) DO UPDATE SET amz_link=COALESCE(EXCLUDED.amz_link,india_master_sellers.amz_link),product_name=COALESCE(EXCLUDED.product_name,india_master_sellers.product_name),
    remark=COALESCE(EXCLUDED.remark,india_master_sellers.remark),brand=COALESCE(EXCLUDED.brand,india_master_sellers.brand),price=COALESCE(EXCLUDED.price,india_master_sellers.price),
    monthly_unit=COALESCE(EXCLUDED.monthly_unit,india_master_sellers.monthly_unit),monthly_sales=COALESCE(EXCLUDED.monthly_sales,india_master_sellers.monthly_sales),
    bsr=COALESCE(EXCLUDED.bsr,india_master_sellers.bsr),seller=COALESCE(EXCLUDED.seller,india_master_sellers.seller),category=COALESCE(EXCLUDED.category,india_master_sellers.category),
    dimensions=COALESCE(EXCLUDED.dimensions,india_master_sellers.dimensions),weight=COALESCE(EXCLUDED.weight,india_master_sellers.weight),
    weight_unit=COALESCE(EXCLUDED.weight_unit,india_master_sellers.weight_unit),link=COALESCE(EXCLUDED.link,india_master_sellers.link),
    sku=COALESCE(EXCLUDED.sku,india_master_sellers.sku),updated_at=CURRENT_TIMESTAMP;
  GET DIAGNOSTICS ic=ROW_COUNT;
  ALTER TABLE india_master_sellers ENABLE TRIGGER USER;
  FOR s IN 1..8 LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel,sku)
    SELECT 'india',s,m.id,tags[s],m.asin,m.link,m.product_name,m.brand,m.price,m.monthly_unit,m.monthly_sales,m.bsr,m.seller,m.category,m.dimensions,m.weight,m.weight_unit,m.remark,
      'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='||m.asin||'&itemcondition=new',unified_get_funnel(m.monthly_unit, 'india', m.bsr),m.sku
    FROM india_master_sellers m WHERE m.asin=ANY(al)
    ON CONFLICT (marketplace,seller_id,asin) DO UPDATE SET product_name=EXCLUDED.product_name,brand=EXCLUDED.brand,price=EXCLUDED.price,monthly_unit=EXCLUDED.monthly_unit,
      monthly_sales=EXCLUDED.monthly_sales,bsr=EXCLUDED.bsr,seller=EXCLUDED.seller,category=EXCLUDED.category,dimensions=EXCLUDED.dimensions,weight=EXCLUDED.weight,
      weight_unit=EXCLUDED.weight_unit,remark=EXCLUDED.remark,funnel=EXCLUDED.funnel,sku=EXCLUDED.sku,updated_at=CURRENT_TIMESTAMP;
    INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,sku,product_status)
    SELECT 'india',s,bc.asin,bc.product_name,bc.brand,bc.funnel,bc.monthly_unit,bc.link,bc.amz_link,bc.remark,bc.sku,funnel_to_product_status(bc.funnel)
    FROM brand_checking bc WHERE bc.marketplace='india' AND bc.seller_id=s AND bc.asin=ANY(al)
    ON CONFLICT (marketplace,seller_id,asin) WHERE product_status!='movement_history' DO UPDATE SET
      product_name=EXCLUDED.product_name,brand=EXCLUDED.brand,monthly_unit=EXCLUDED.monthly_unit,product_link=EXCLUDED.product_link,
      amz_link=EXCLUDED.amz_link,remark=EXCLUDED.remark,funnel=EXCLUDED.funnel,sku=EXCLUDED.sku,product_status=EXCLUDED.product_status,updated_at=CURRENT_TIMESTAMP;
  END LOOP;
  RETURN json_build_object('success',true,'inserted_count',ic);
EXCEPTION WHEN OTHERS THEN ALTER TABLE india_master_sellers ENABLE TRIGGER USER; RAISE;
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_insert_uae_master_with_distribution(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_inserted INT := 0;
  v_queued   INT := 0;
BEGIN
  INSERT INTO uae_master_sellers (
    asin, product_name, brand, price, monthly_unit, monthly_sales,
    bsr, seller, category, dimensions, weight, weight_unit,
    remark, link, amz_link
  )
  SELECT
    r->>'asin', r->>'product_name', r->>'brand',
    NULLIF(r->>'price','')::numeric,
    NULLIF(r->>'monthly_unit','')::numeric,
    NULLIF(r->>'monthly_sales','')::numeric,
    NULLIF(r->>'bsr','')::numeric,
    NULLIF(r->>'seller','')::numeric,
    r->>'category', r->>'dimensions',
    NULLIF(r->>'weight','')::numeric,
    r->>'weight_unit', r->>'remark', r->>'link', r->>'amz_link'
  FROM jsonb_array_elements(batch_data) AS r
  ON CONFLICT (asin) DO UPDATE SET
    product_name = COALESCE(EXCLUDED.product_name, uae_master_sellers.product_name),
    brand = COALESCE(EXCLUDED.brand, uae_master_sellers.brand),
    price = COALESCE(EXCLUDED.price, uae_master_sellers.price),
    monthly_unit = COALESCE(EXCLUDED.monthly_unit, uae_master_sellers.monthly_unit),
    monthly_sales = COALESCE(EXCLUDED.monthly_sales, uae_master_sellers.monthly_sales),
    bsr = COALESCE(EXCLUDED.bsr, uae_master_sellers.bsr),
    seller = COALESCE(EXCLUDED.seller, uae_master_sellers.seller),
    category = COALESCE(EXCLUDED.category, uae_master_sellers.category),
    dimensions = COALESCE(EXCLUDED.dimensions, uae_master_sellers.dimensions),
    weight = COALESCE(EXCLUDED.weight, uae_master_sellers.weight),
    weight_unit = COALESCE(EXCLUDED.weight_unit, uae_master_sellers.weight_unit),
    remark = COALESCE(EXCLUDED.remark, uae_master_sellers.remark),
    link = COALESCE(EXCLUDED.link, uae_master_sellers.link),
    amz_link = COALESCE(EXCLUDED.amz_link, uae_master_sellers.amz_link),
    updated_at = NOW();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO uae_distribution_queue (asin)
  SELECT r->>'asin' FROM jsonb_array_elements(batch_data) AS r
  WHERE r->>'asin' IS NOT NULL
  ON CONFLICT (asin) DO NOTHING;

  GET DIAGNOSTICS v_queued = ROW_COUNT;

  RETURN jsonb_build_object('inserted', v_inserted, 'queued', v_queued);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_insert_uk_master_with_distribution(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_inserted INT := 0;
  v_queued   INT := 0;
BEGIN
  -- Insert into master (upsert)
  INSERT INTO uk_master_sellers (
    asin, product_name, brand, price, monthly_unit, monthly_sales,
    bsr, seller, category, dimensions, weight, weight_unit,
    remark, link, amz_link
  )
  SELECT
    r->>'asin', r->>'product_name', r->>'brand',
    NULLIF(r->>'price','')::numeric,
    NULLIF(r->>'monthly_unit','')::numeric,
    NULLIF(r->>'monthly_sales','')::numeric,
    NULLIF(r->>'bsr','')::numeric,
    NULLIF(r->>'seller','')::numeric,
    r->>'category', r->>'dimensions',
    NULLIF(r->>'weight','')::numeric,
    r->>'weight_unit', r->>'remark', r->>'link', r->>'amz_link'
  FROM jsonb_array_elements(batch_data) AS r
  ON CONFLICT (asin) DO UPDATE SET
    product_name = COALESCE(EXCLUDED.product_name, uk_master_sellers.product_name),
    brand = COALESCE(EXCLUDED.brand, uk_master_sellers.brand),
    price = COALESCE(EXCLUDED.price, uk_master_sellers.price),
    monthly_unit = COALESCE(EXCLUDED.monthly_unit, uk_master_sellers.monthly_unit),
    monthly_sales = COALESCE(EXCLUDED.monthly_sales, uk_master_sellers.monthly_sales),
    bsr = COALESCE(EXCLUDED.bsr, uk_master_sellers.bsr),
    seller = COALESCE(EXCLUDED.seller, uk_master_sellers.seller),
    category = COALESCE(EXCLUDED.category, uk_master_sellers.category),
    dimensions = COALESCE(EXCLUDED.dimensions, uk_master_sellers.dimensions),
    weight = COALESCE(EXCLUDED.weight, uk_master_sellers.weight),
    weight_unit = COALESCE(EXCLUDED.weight_unit, uk_master_sellers.weight_unit),
    remark = COALESCE(EXCLUDED.remark, uk_master_sellers.remark),
    link = COALESCE(EXCLUDED.link, uk_master_sellers.link),
    amz_link = COALESCE(EXCLUDED.amz_link, uk_master_sellers.amz_link),
    updated_at = NOW();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Queue for distribution
  INSERT INTO uk_distribution_queue (asin)
  SELECT r->>'asin' FROM jsonb_array_elements(batch_data) AS r
  WHERE r->>'asin' IS NOT NULL
  ON CONFLICT (asin) DO NOTHING;

  GET DIAGNOSTICS v_queued = ROW_COUNT;

  RETURN jsonb_build_object('inserted', v_inserted, 'queued', v_queued);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_insert_usa_master_with_distribution(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_inserted_count INTEGER := 0;
BEGIN
    IF batch_data IS NULL OR jsonb_array_length(batch_data) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No data provided');
    END IF;

    INSERT INTO usa_master_sellers (
        asin, product_name, brand, price, monthly_unit, monthly_sales,
        bsr, seller, category, dimensions, weight, weight_unit,
        link, amz_link, remark, created_at, updated_at
    )
    SELECT
        (record->>'asin')::TEXT,
        (record->>'product_name')::TEXT,
        (record->>'brand')::TEXT,
        (record->>'price')::NUMERIC,
        COALESCE((record->>'monthly_unit')::INTEGER, 0),
        (record->>'monthly_sales')::NUMERIC,
        (record->>'bsr')::NUMERIC,
        (record->>'seller')::NUMERIC,
        (record->>'category')::TEXT,
        (record->>'dimensions')::TEXT,
        (record->>'weight')::NUMERIC,
        (record->>'weight_unit')::TEXT,
        (record->>'link')::TEXT,
        (record->>'amz_link')::TEXT,
        (record->>'remark')::TEXT,
        NOW(), NOW()
    FROM jsonb_array_elements(batch_data) AS record
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
        link = EXCLUDED.link,
        amz_link = EXCLUDED.amz_link,
        remark = EXCLUDED.remark,
        updated_at = NOW();

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    INSERT INTO usa_distribution_queue (asin, source)
    SELECT DISTINCT
        (record->>'asin')::TEXT,
        'full_upload'
    FROM jsonb_array_elements(batch_data) AS record
    WHERE (record->>'asin') IS NOT NULL
    ON CONFLICT (asin) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'inserted_to_master', v_inserted_count,
        'message', format(
          '%s records uploaded. Queued for background distribution.',
          v_inserted_count
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_flipkart_asin_remark_monthly_unit(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    IF batch_data IS NULL OR jsonb_array_length(batch_data) = 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No data provided');
    END IF;

    WITH updates AS (
        SELECT 
            (record->>'asin')::TEXT as asin,
            (record->>'remark')::TEXT as remark,
            COALESCE((record->>'monthly_unit')::INTEGER, 0) as monthly_unit
        FROM jsonb_array_elements(batch_data) AS record
    )
    UPDATE flipkart_master_sellers m
    SET 
        remark = u.remark,
        monthly_unit = u.monthly_unit,
        updated_at = NOW()
    FROM updates u
    WHERE m.asin = u.asin;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'updated_count', v_updated_count,
        'message', format('%s records updated. Distribution starting in background...', v_updated_count)
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_flipkart_asin_remark_monthly_unit_batched(batch_data jsonb, batch_size integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET session_replication_role TO 'replica'
AS $function$
DECLARE
  v_start_time TIMESTAMP;
  v_updated_count INTEGER := 0;
  v_batch_count INTEGER := 0;
  v_total_records INTEGER;
  v_offset INTEGER := 0;
  v_current_batch jsonb;
  v_batch_updated INTEGER;
BEGIN
  v_start_time := clock_timestamp();
  v_total_records := jsonb_array_length(batch_data);
  
  IF v_total_records = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'No data provided'
    );
  END IF;
  
  RAISE NOTICE 'Starting batched update: % records (triggers disabled)', v_total_records;
  
  -- ✅ PROCESS IN BATCHES
  LOOP
    EXIT WHEN v_offset >= v_total_records;
    
    -- Get current batch
    v_current_batch := (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(batch_data) WITH ORDINALITY AS t(elem, ord)
        WHERE ord > v_offset AND ord <= v_offset + batch_size
      ) sub
    );
    
    EXIT WHEN v_current_batch IS NULL;
    
    -- Update master table for this batch
    WITH updates AS (
      SELECT 
        (record->>'asin')::TEXT as asin,
        (record->>'remark')::TEXT as remark,
        COALESCE((record->>'monthly_unit')::INTEGER, 0) as monthly_unit
      FROM jsonb_array_elements(v_current_batch) AS record
    )
    UPDATE flipkart_master_sellers m
    SET 
      remark = u.remark,
      monthly_unit = u.monthly_unit,
      updated_at = NOW()
    FROM updates u
    WHERE m.asin = u.asin;
    
    GET DIAGNOSTICS v_batch_updated = ROW_COUNT;
    v_updated_count := v_updated_count + v_batch_updated;
    v_batch_count := v_batch_count + 1;
    v_offset := v_offset + batch_size;
    
    RAISE NOTICE 'Batch %: Updated % records (total: %/%)', 
      v_batch_count, v_batch_updated, v_updated_count, v_total_records;
    
    PERFORM pg_sleep(0.05);
  END LOOP;
  
  -- ✅ SYNC TO ALL 24 TABLES
  RAISE NOTICE 'Starting distribution to 24 tables...';
  
  WITH updated_asins AS (
    SELECT (record->>'asin')::TEXT as asin
    FROM jsonb_array_elements(batch_data) AS record
  ),
  asin_batches AS (
    SELECT asin, ROW_NUMBER() OVER () as rn
    FROM updated_asins
  )
  SELECT COUNT(*) INTO v_batch_count
  FROM (
    SELECT DISTINCT FLOOR((rn - 1) / 500) as batch_num
    FROM asin_batches
  ) sub;
  
  -- Distribute to all 24 tables in batches
  FOR i IN 0..(v_batch_count - 1) LOOP
    FOR seller_num IN 1..6 LOOP
      -- Brand checking
      EXECUTE format('
        WITH updated_asins AS (
          SELECT (record->>''asin'')::TEXT as asin,
                 ROW_NUMBER() OVER () as rn
          FROM jsonb_array_elements($1) AS record
        ),
        batch_asins AS (
          SELECT asin FROM updated_asins
          WHERE rn > $2 AND rn <= $3
        )
        UPDATE flipkart_brand_checking_seller_%s bc
        SET 
          remark = m.remark,
          monthly_unit = m.monthly_unit,
          funnel = CASE 
            WHEN m.monthly_unit > 60 THEN ''high_demand''
            WHEN m.monthly_unit >= 1 AND m.monthly_unit <= 60 THEN ''dropshipping''
            ELSE ''low_demand''
          END,
          updated_at = NOW()
        FROM flipkart_master_sellers m
        JOIN batch_asins ba ON ba.asin = m.asin
        WHERE bc.asin = m.asin
      ', seller_num)
      USING batch_data, i * 500, (i + 1) * 500;
      
      -- High demand
      EXECUTE format('
        WITH updated_asins AS (
          SELECT (record->>''asin'')::TEXT as asin,
                 ROW_NUMBER() OVER () as rn
          FROM jsonb_array_elements($1) AS record
        ),
        batch_asins AS (
          SELECT asin FROM updated_asins
          WHERE rn > $2 AND rn <= $3
        )
        UPDATE flipkart_seller_%s_high_demand f
        SET 
          remark = m.remark,
          monthly_unit = m.monthly_unit,
          updated_at = NOW()
        FROM flipkart_master_sellers m
        JOIN batch_asins ba ON ba.asin = m.asin
        WHERE f.asin = m.asin AND m.monthly_unit > 60
      ', seller_num)
      USING batch_data, i * 500, (i + 1) * 500;
      
      -- Dropshipping
      EXECUTE format('
        WITH updated_asins AS (
          SELECT (record->>''asin'')::TEXT as asin,
                 ROW_NUMBER() OVER () as rn
          FROM jsonb_array_elements($1) AS record
        ),
        batch_asins AS (
          SELECT asin FROM updated_asins
          WHERE rn > $2 AND rn <= $3
        )
        UPDATE flipkart_seller_%s_dropshipping f
        SET 
          remark = m.remark,
          monthly_unit = m.monthly_unit,
          updated_at = NOW()
        FROM flipkart_master_sellers m
        JOIN batch_asins ba ON ba.asin = m.asin
        WHERE f.asin = m.asin AND m.monthly_unit >= 1 AND m.monthly_unit <= 60
      ', seller_num)
      USING batch_data, i * 500, (i + 1) * 500;
      
      -- Low demand
      EXECUTE format('
        WITH updated_asins AS (
          SELECT (record->>''asin'')::TEXT as asin,
                 ROW_NUMBER() OVER () as rn
          FROM jsonb_array_elements($1) AS record
        ),
        batch_asins AS (
          SELECT asin FROM updated_asins
          WHERE rn > $2 AND rn <= $3
        )
        UPDATE flipkart_seller_%s_low_demand f
        SET 
          remark = m.remark,
          monthly_unit = m.monthly_unit,
          updated_at = NOW()
        FROM flipkart_master_sellers m
        JOIN batch_asins ba ON ba.asin = m.asin
        WHERE f.asin = m.asin AND m.monthly_unit < 1
      ', seller_num)
      USING batch_data, i * 500, (i + 1) * 500;
    END LOOP;
    
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE NOTICE 'Completed: % records updated and distributed', v_updated_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated_count,
    'duration_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)),
    'message', format('✅ %s records updated and synced to all 24 tables', v_updated_count)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', SQLERRM
    );
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_india_asin_remark_monthly_unit_batched(batchdata jsonb, batchsize integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_start TIMESTAMP:=clock_timestamp(); v_updated INT:=0; v_moved INT:=0; v_offset INT:=0; v_total INT; v_batch jsonb; v_rc INT;
BEGIN
  v_total:=jsonb_array_length(batchdata);
  IF v_total=0 THEN RETURN jsonb_build_object('success',false,'message','No data'); END IF;
  DROP TABLE IF EXISTS _tmp_india_bulk_asins;
  CREATE TEMP TABLE _tmp_india_bulk_asins (asin TEXT PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO _tmp_india_bulk_asins SELECT COALESCE(r->>'asin',r->>'ASIN') FROM jsonb_array_elements(batchdata) r;
  LOOP EXIT WHEN v_offset>=v_total;
    v_batch:=(SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(batchdata) WITH ORDINALITY AS t(elem,ord) WHERE ord>v_offset AND ord<=v_offset+batchsize) sub);
    EXIT WHEN v_batch IS NULL;
    WITH u AS (SELECT COALESCE(r->>'asin',r->>'ASIN')::TEXT as asin, COALESCE(r->>'remark',r->>'Remark')::TEXT as remark,
      COALESCE((r->>'monthly_unit')::NUMERIC,(r->>'monthlyunit')::NUMERIC,(r->>'Monthly Units Sold')::NUMERIC,0) as monthly_unit FROM jsonb_array_elements(v_batch) r)
    UPDATE india_master_sellers m SET remark=u.remark, monthly_unit=u.monthly_unit,
      funnel=CASE WHEN u.monthly_unit>=5 THEN 'RS' WHEN COALESCE(m.bsr,999999)<40000 THEN 'RS' ELSE 'DP' END, updated_at=NOW()
    FROM u WHERE m.asin=u.asin;
    GET DIAGNOSTICS v_rc=ROW_COUNT; v_updated:=v_updated+v_rc; v_offset:=v_offset+batchsize;
  END LOOP;
  UPDATE brand_checking bc SET remark=m.remark, monthly_unit=m.monthly_unit, funnel=unified_get_funnel(m.monthly_unit, 'india', m.bsr), updated_at=NOW()
  FROM india_master_sellers m JOIN _tmp_india_bulk_asins t ON t.asin=m.asin WHERE bc.marketplace='india' AND bc.asin=m.asin;
  UPDATE seller_products sp SET product_status=funnel_to_product_status(unified_get_funnel(m.monthly_unit, 'india', m.bsr)), funnel=unified_get_funnel(m.monthly_unit, 'india', m.bsr),
    remark=m.remark, monthly_unit=m.monthly_unit, updated_at=NOW()
  FROM india_master_sellers m JOIN _tmp_india_bulk_asins t ON t.asin=m.asin
  WHERE sp.marketplace='india' AND sp.asin=m.asin AND sp.product_status IN ('high_demand','dropshipping','low_demand');
  GET DIAGNOSTICS v_rc=ROW_COUNT; v_moved:=v_rc;
  FOR s IN 1..8 LOOP PERFORM unified_recalc_progress('india', s); END LOOP;
  RETURN jsonb_build_object('success',true,'updatedcount',v_updated,'movedcount',v_moved,'durationseconds',EXTRACT(EPOCH FROM clock_timestamp()-v_start));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_india_asin_remark_monthlyunit_batched(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_updated INT := 0;
  v_updated_asins TEXT[];
  v_start_time TIMESTAMP := clock_timestamp();
BEGIN
  DROP TABLE IF EXISTS tmp_india_partial;
  CREATE TEMP TABLE tmp_india_partial AS
  SELECT
    COALESCE(r->>'asin', r->>'ASIN')::TEXT AS asin,
    NULLIF(COALESCE(r->>'remark', r->>'Remark'), '')::TEXT AS new_remark,
    COALESCE(
      (r->>'monthly_unit')::NUMERIC,
      (r->>'monthlyunitssold')::NUMERIC,
      (r->>'Monthly Units Sold')::NUMERIC
    ) AS new_monthly_unit
  FROM jsonb_array_elements(batch_data) AS r;

  CREATE INDEX ON tmp_india_partial(asin);

  -- STEP 1: Update master + recalculate funnel
  WITH updated AS (
    UPDATE india_master_sellers m
    SET
      remark = COALESCE(t.new_remark, m.remark),
      monthly_unit = COALESCE(t.new_monthly_unit, m.monthly_unit),
      funnel = CASE
        WHEN COALESCE(t.new_monthly_unit, m.monthly_unit) >= 5 THEN 'RS'
        ELSE 'DP'
      END,
      updated_at = NOW()
    FROM tmp_india_partial t
    WHERE m.asin = t.asin
    RETURNING m.asin
  )
  SELECT ARRAY_AGG(asin), COUNT(*) INTO v_updated_asins, v_updated FROM updated;

  IF v_updated_asins IS NULL OR array_length(v_updated_asins, 1) = 0 THEN
    DROP TABLE IF EXISTS tmp_india_partial;
    RETURN jsonb_build_object('success', true, 'updated_count', 0, 'message', 'No matching ASINs found');
  END IF;

  -- STEP 2: Sync brand checking (correct table names with underscores)
  UPDATE india_brand_checking_seller_1 bc
  SET remark = m.remark, monthly_unit = m.monthly_unit, updated_at = NOW()
  FROM india_master_sellers m JOIN tmp_india_partial t ON t.asin = m.asin
  WHERE bc.asin = m.asin;

  UPDATE india_brand_checking_seller_2 bc
  SET remark = m.remark, monthly_unit = m.monthly_unit, updated_at = NOW()
  FROM india_master_sellers m JOIN tmp_india_partial t ON t.asin = m.asin
  WHERE bc.asin = m.asin;

  UPDATE india_brand_checking_seller_3 bc
  SET remark = m.remark, monthly_unit = m.monthly_unit, updated_at = NOW()
  FROM india_master_sellers m JOIN tmp_india_partial t ON t.asin = m.asin
  WHERE bc.asin = m.asin;

  UPDATE india_brand_checking_seller_4 bc
  SET remark = m.remark, monthly_unit = m.monthly_unit, updated_at = NOW()
  FROM india_master_sellers m JOIN tmp_india_partial t ON t.asin = m.asin
  WHERE bc.asin = m.asin;

  UPDATE india_brand_checking_seller_5 bc
  SET remark = m.remark, monthly_unit = m.monthly_unit, updated_at = NOW()
  FROM india_master_sellers m JOIN tmp_india_partial t ON t.asin = m.asin
  WHERE bc.asin = m.asin;

  UPDATE india_brand_checking_seller_6 bc
  SET remark = m.remark, monthly_unit = m.monthly_unit, updated_at = NOW()
  FROM india_master_sellers m JOIN tmp_india_partial t ON t.asin = m.asin
  WHERE bc.asin = m.asin;

  -- STEP 3: Update india_demand_sorting (single table, RS/DP funnel swap)
  UPDATE india_demand_sorting ds
  SET
    monthly_unit = m.monthly_unit,
    remark = m.remark,
    funnel = m.funnel,
    product_name = m.product_name,
    brand = m.brand,
    price = m.price,
    link = m.link,
    amz_link = 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemCondition=new',
    updated_at = NOW()
  FROM india_master_sellers m
  WHERE ds.asin = m.asin
    AND m.asin = ANY(v_updated_asins);

  DROP TABLE IF EXISTS tmp_india_partial;

  RETURN jsonb_build_object(
    'success', true,
    'updated_count', v_updated,
    'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - v_start_time),
    'message', format('%s products updated. Funnel recalculated (RS/DP).', v_updated)
  );

EXCEPTION WHEN OTHERS THEN
  DROP TABLE IF EXISTS tmp_india_partial;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_india_master_partial(batch_data jsonb)
 RETURNS json
 LANGUAGE plpgsql
AS $function$
DECLARE
  updated_count int := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS temp_partial_updates (
    asin text PRIMARY KEY,
    remark text,
    monthly_unit numeric,
    sku text
  ) ON COMMIT DROP;

  INSERT INTO temp_partial_updates (asin, remark, monthly_unit, sku)
  SELECT
    (elem->>'asin')::text,
    (elem->>'remark')::text,
    (elem->>'monthly_unit')::numeric,
    (elem->>'sku')::text
  FROM jsonb_array_elements(batch_data) elem
  ON CONFLICT (asin) DO UPDATE SET
    remark = EXCLUDED.remark,
    monthly_unit = EXCLUDED.monthly_unit,
    sku = EXCLUDED.sku;

  WITH updated AS (
    UPDATE india_master_sellers m SET
      remark = COALESCE(t.remark, m.remark),
      monthly_unit = COALESCE(t.monthly_unit, m.monthly_unit),
      sku = COALESCE(t.sku, m.sku),
      updated_at = CURRENT_TIMESTAMP
    FROM temp_partial_updates t
    WHERE m.asin = t.asin
    RETURNING m.*
  )
  SELECT COUNT(*) INTO updated_count FROM updated;

  -- Queue updated ASINs for funnel re-distribution
  INSERT INTO india_distribution_queue (asin, source)
  SELECT asin, 'partial_update'
  FROM temp_partial_updates
  WHERE asin IS NOT NULL
  ON CONFLICT (asin) DO UPDATE SET source = 'partial_update';

  RETURN json_build_object('success', true, 'updated', updated_count);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_india_sku_batched(batchdata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  _input_count INT;
  _effective_asin_count INT;
  _duplicate_asin_count INT;
  _empty_sku_row_count INT;
  _updated_count INT := 0;
  _rc INT;
BEGIN
  CREATE TEMP TABLE tmp_sku_raw (asin text, sku text) ON COMMIT DROP;
  INSERT INTO tmp_sku_raw SELECT (i->>'asin')::text, (i->>'sku')::text FROM jsonb_array_elements(batchdata) i;
  UPDATE tmp_sku_raw SET asin=TRIM(REPLACE(asin,'?','')), sku=TRIM(REPLACE(sku,'?','')) WHERE true;
  SELECT COUNT(*) INTO _input_count FROM tmp_sku_raw;

  SELECT COUNT(*) INTO _empty_sku_row_count FROM tmp_sku_raw WHERE asin IS NULL OR asin='' OR sku IS NULL OR sku='';

  CREATE TEMP TABLE tmp_sku AS SELECT DISTINCT asin, sku FROM tmp_sku_raw WHERE asin<>'' AND sku<>'';
  CREATE TEMP TABLE tmp_dups AS SELECT asin FROM tmp_sku_raw WHERE asin<>'' GROUP BY asin HAVING COUNT(*)>1;
  SELECT COUNT(*) INTO _duplicate_asin_count FROM tmp_dups;
  DELETE FROM tmp_sku u USING tmp_dups d WHERE u.asin=d.asin;
  SELECT COUNT(*) INTO _effective_asin_count FROM tmp_sku;

  -- Update unified tables (with WHERE clause for safeupdate)
  UPDATE brand_checking t SET sku=u.sku FROM tmp_sku u WHERE t.marketplace='india' AND t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  UPDATE seller_products t SET sku=u.sku FROM tmp_sku u WHERE t.marketplace='india' AND t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  UPDATE listing_errors t SET sku=u.sku FROM tmp_sku u WHERE t.marketplace='india' AND t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  UPDATE tracking_ops t SET sku=u.sku FROM tmp_sku u WHERE t.marketplace='india' AND t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  -- Non-unified tables
  UPDATE india_admin_validation t SET sku=u.sku FROM tmp_sku u WHERE t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  UPDATE india_validation_main_file t SET sku=u.sku FROM tmp_sku u WHERE t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  UPDATE india_purchases t SET sku=u.sku FROM tmp_sku u WHERE t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  UPDATE india_box_checking t SET sku=u.sku FROM tmp_sku u WHERE t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  UPDATE india_inbound_tracking t SET sku=u.sku FROM tmp_sku u WHERE t.asin=u.asin;
  GET DIAGNOSTICS _rc=ROW_COUNT; _updated_count:=_updated_count+_rc;

  RETURN jsonb_build_object(
    'input_count', _input_count,
    'effective_asin_count', _effective_asin_count,
    'duplicate_asin_count', _duplicate_asin_count,
    'empty_sku_row_count', _empty_sku_row_count,
    'updated_count', _updated_count
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_uae_asin_remark_monthly_unit_batched(batchdata jsonb, batchsize integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated INT := 0;
BEGIN
  SET LOCAL session_replication_role = replica;

  -- 1. Bulk update master table
  UPDATE uae_master_sellers m
  SET
    remark = COALESCE(b.new_remark, m.remark),
    monthly_unit = COALESCE(b.new_monthly_unit, m.monthly_unit),
    updated_at = NOW()
  FROM (
    SELECT (r->>'asin')::TEXT AS asin,
           NULLIF(r->>'remark', '')::TEXT AS new_remark,
           (r->>'monthly_unit')::NUMERIC AS new_monthly_unit
    FROM jsonb_array_elements(batchdata) AS r
  ) b WHERE m.asin = b.asin;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- 2. Update all 4 brand checking tables
  UPDATE uae_brand_checking_seller_1 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_brand_checking_seller_2 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_brand_checking_seller_3 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_brand_checking_seller_4 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  -- 3. Update all 12 funnel sub-tables
  UPDATE uae_seller_1_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_1_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_1_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  UPDATE uae_seller_2_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_2_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_2_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  UPDATE uae_seller_3_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_3_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_3_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  UPDATE uae_seller_4_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_4_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uae_seller_4_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  SET LOCAL session_replication_role = DEFAULT;

  RETURN jsonb_build_object('updatedcount', v_updated, 'skippedcount', jsonb_array_length(batchdata) - v_updated);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_uk_asin_remark_monthly_unit(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_count INT := 0;
  redistributed_count INT := 0;
  error_msg TEXT;
BEGIN
  RAISE NOTICE 'Partial update called with % items', jsonb_array_length(batch_data);
  
  -- ============================================
  -- STEP 1: Update Master Table
  -- ============================================
  BEGIN
    WITH updates AS (
      UPDATE uk_master_sellers m
      SET 
        remark = COALESCE((item->>'remark')::TEXT, m.remark),
        monthly_unit = COALESCE((item->>'monthly_unit')::NUMERIC, m.monthly_unit),
        updated_at = NOW()
      FROM jsonb_array_elements(batch_data) AS item
      WHERE m.asin = (item->>'asin')::TEXT
      RETURNING m.asin
    )
    SELECT COUNT(*) INTO updated_count FROM updates;
    
    RAISE NOTICE 'Updated % records in master table', updated_count;
    
  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    RAISE WARNING 'Master update failed: %', error_msg;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Master update failed: ' || error_msg,
      'updated_count', 0
    );
  END;
  
  -- ============================================
  -- STEP 2: Update Brand Checking Tables
  -- ============================================
  BEGIN
    -- Seller 1
    UPDATE uk_brand_checking_seller_1 bc
    SET 
      remark = COALESCE((item->>'remark')::TEXT, bc.remark),
      monthly_unit = COALESCE((item->>'monthly_unit')::NUMERIC, bc.monthly_unit),
      updated_at = NOW()
    FROM jsonb_array_elements(batch_data) AS item
    WHERE bc.asin = (item->>'asin')::TEXT;
    
    -- Seller 2
    UPDATE uk_brand_checking_seller_2 bc
    SET 
      remark = COALESCE((item->>'remark')::TEXT, bc.remark),
      monthly_unit = COALESCE((item->>'monthly_unit')::NUMERIC, bc.monthly_unit),
      updated_at = NOW()
    FROM jsonb_array_elements(batch_data) AS item
    WHERE bc.asin = (item->>'asin')::TEXT;
    
    -- Seller 3
    UPDATE uk_brand_checking_seller_3 bc
    SET 
      remark = COALESCE((item->>'remark')::TEXT, bc.remark),
      monthly_unit = COALESCE((item->>'monthly_unit')::NUMERIC, bc.monthly_unit),
      updated_at = NOW()
    FROM jsonb_array_elements(batch_data) AS item
    WHERE bc.asin = (item->>'asin')::TEXT;
    
    -- Seller 4
    UPDATE uk_brand_checking_seller_4 bc
    SET 
      remark = COALESCE((item->>'remark')::TEXT, bc.remark),
      monthly_unit = COALESCE((item->>'monthly_unit')::NUMERIC, bc.monthly_unit),
      updated_at = NOW()
    FROM jsonb_array_elements(batch_data) AS item
    WHERE bc.asin = (item->>'asin')::TEXT;
    
    RAISE NOTICE 'Updated brand checking tables';
    
  EXCEPTION WHEN OTHERS THEN
    error_msg := SQLERRM;
    RAISE WARNING 'Brand checking update failed: %', error_msg;
  END;
  
  -- ============================================
  -- STEP 3: Redistribute to Correct Funnels
  -- ============================================
  BEGIN
    -- Create temp table
    CREATE TEMP TABLE IF NOT EXISTS temp_update_asins_uk AS
    SELECT (item->>'asin')::TEXT AS asin
    FROM jsonb_array_elements(batch_data) AS item;
    
    -- SELLER 1 REDISTRIBUTION
    DELETE FROM uk_seller_1_high_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_1_dropshipping WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_1_low_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    
    INSERT INTO uk_seller_1_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'HD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_1 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit > 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark, updated_at = NOW();
    
    INSERT INTO uk_seller_1_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'DP', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_1 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit BETWEEN 1 AND 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark, updated_at = NOW();
    
    INSERT INTO uk_seller_1_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'LD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_1 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND (bc.monthly_unit <= 0 OR bc.monthly_unit IS NULL)
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark, updated_at = NOW();
    
    -- SELLER 2 REDISTRIBUTION
    DELETE FROM uk_seller_2_high_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_2_dropshipping WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_2_low_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    
    INSERT INTO uk_seller_2_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'HD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_2 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit > 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    INSERT INTO uk_seller_2_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'DP', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_2 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit BETWEEN 1 AND 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    INSERT INTO uk_seller_2_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'LD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_2 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND (bc.monthly_unit <= 0 OR bc.monthly_unit IS NULL)
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    -- SELLER 3 REDISTRIBUTION
    DELETE FROM uk_seller_3_high_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_3_dropshipping WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_3_low_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    
    INSERT INTO uk_seller_3_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'HD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_3 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit > 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    INSERT INTO uk_seller_3_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'DP', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_3 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit BETWEEN 1 AND 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    INSERT INTO uk_seller_3_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'LD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_3 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND (bc.monthly_unit <= 0 OR bc.monthly_unit IS NULL)
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    -- SELLER 4 REDISTRIBUTION
    DELETE FROM uk_seller_4_high_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_4_dropshipping WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    DELETE FROM uk_seller_4_low_demand WHERE asin IN (SELECT asin FROM temp_update_asins_uk);
    
    INSERT INTO uk_seller_4_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'HD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_4 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit > 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    INSERT INTO uk_seller_4_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'DP', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_4 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND bc.monthly_unit BETWEEN 1 AND 60
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    INSERT INTO uk_seller_4_low_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT bc.asin, bc.product_name, bc.brand, 'LD', bc.monthly_unit, bc.link, bc.amz_link, bc.remark
    FROM uk_brand_checking_seller_4 bc
    WHERE bc.asin IN (SELECT asin FROM temp_update_asins_uk) AND (bc.monthly_unit <= 0 OR bc.monthly_unit IS NULL)
    ON CONFLICT (asin) DO UPDATE SET monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark;
    
    GET DIAGNOSTICS redistributed_count = ROW_COUNT;
    
    DROP TABLE IF EXISTS temp_update_asins_uk;
    
    RAISE NOTICE 'Redistributed products to correct funnels';
    
  EXCEPTION WHEN OTHERS THEN
    DROP TABLE IF EXISTS temp_update_asins_uk;
    error_msg := SQLERRM;
    RAISE WARNING 'Funnel redistribution failed: %', error_msg;
  END;
  
  RETURN jsonb_build_object(
    'success', true,
    'updated_count', updated_count,
    'redistributed_count', redistributed_count,
    'message', format('Successfully updated %s products', updated_count)
  );
  
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_uk_asin_remark_monthly_unit_batched(batchdata jsonb, batchsize integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated INT := 0;
BEGIN
  SET LOCAL session_replication_role = replica;

  -- 1. Bulk update master table
  UPDATE uk_master_sellers m
  SET
    remark = COALESCE(b.new_remark, m.remark),
    monthly_unit = COALESCE(b.new_monthly_unit, m.monthly_unit),
    updated_at = NOW()
  FROM (
    SELECT (r->>'asin')::TEXT AS asin,
           NULLIF(r->>'remark', '')::TEXT AS new_remark,
           (r->>'monthly_unit')::NUMERIC AS new_monthly_unit
    FROM jsonb_array_elements(batchdata) AS r
  ) b WHERE m.asin = b.asin;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- 2. Update all 4 brand checking tables
  UPDATE uk_brand_checking_seller_1 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_brand_checking_seller_2 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_brand_checking_seller_3 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_brand_checking_seller_4 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  -- 3. Update all 12 funnel sub-tables
  UPDATE uk_seller_1_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_1_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_1_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  UPDATE uk_seller_2_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_2_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_2_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  UPDATE uk_seller_3_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_3_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_3_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  UPDATE uk_seller_4_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_4_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE uk_seller_4_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  SET LOCAL session_replication_role = DEFAULT;

  RETURN jsonb_build_object('updatedcount', v_updated, 'skippedcount', jsonb_array_length(batchdata) - v_updated);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulk_update_usa_asin_remark_monthly_unit_batched(batchdata jsonb, batchsize integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_updated INT := 0;
BEGIN
  SET LOCAL session_replication_role = replica;

  UPDATE usa_master_sellers m
  SET remark = COALESCE(b.new_remark, m.remark), monthly_unit = COALESCE(b.new_monthly_unit, m.monthly_unit), updated_at = NOW()
  FROM (SELECT (r->>'asin')::TEXT AS asin, NULLIF(r->>'remark','')::TEXT AS new_remark, (r->>'monthly_unit')::NUMERIC AS new_monthly_unit FROM jsonb_array_elements(batchdata) AS r) b WHERE m.asin = b.asin;
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  UPDATE usa_brand_checking_seller_1 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_brand_checking_seller_2 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_brand_checking_seller_3 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_brand_checking_seller_4 t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit), updated_at = NOW() FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  UPDATE usa_seller_1_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_1_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_1_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_2_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_2_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_2_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_3_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_3_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_3_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_4_high_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_4_dropshipping t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;
  UPDATE usa_seller_4_low_demand t SET remark = COALESCE(b.nr, t.remark), monthly_unit = COALESCE(b.mu, t.monthly_unit) FROM (SELECT (r->>'asin')::TEXT a, NULLIF(r->>'remark','')::TEXT nr, (r->>'monthly_unit')::NUMERIC mu FROM jsonb_array_elements(batchdata) r) b WHERE t.asin = b.a;

  SET LOCAL session_replication_role = DEFAULT;

  RETURN jsonb_build_object('updatedcount', v_updated, 'skippedcount', jsonb_array_length(batchdata) - v_updated);
END;
$function$


CREATE OR REPLACE FUNCTION public.bulkupdateflipkartasinremarkmonthlyunitbatched(batchdata jsonb, batchsize integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_start TIMESTAMP:=clock_timestamp(); v_updated INT:=0; v_moved INT:=0; v_offset INT:=0; v_total INT; v_batch jsonb; v_rc INT;
BEGIN
  v_total:=jsonb_array_length(batchdata);
  IF v_total=0 THEN RETURN jsonb_build_object('success',false,'message','No data'); END IF;
  DROP TABLE IF EXISTS _tmp_bulk_asins;
  CREATE TEMP TABLE _tmp_bulk_asins (asin TEXT PRIMARY KEY) ON COMMIT DROP;
  INSERT INTO _tmp_bulk_asins SELECT COALESCE(r->>'asin',r->>'ASIN') FROM jsonb_array_elements(batchdata) r;
  LOOP EXIT WHEN v_offset>=v_total;
    v_batch:=(SELECT jsonb_agg(elem) FROM (SELECT elem FROM jsonb_array_elements(batchdata) WITH ORDINALITY AS t(elem,ord) WHERE ord>v_offset AND ord<=v_offset+batchsize) sub);
    EXIT WHEN v_batch IS NULL;
    WITH u AS (SELECT COALESCE(r->>'asin',r->>'ASIN')::TEXT as asin, COALESCE(r->>'remark',r->>'Remark')::TEXT as remark,
      COALESCE((r->>'monthly_unit')::NUMERIC,(r->>'monthlyunit')::NUMERIC,(r->>'Monthly Units Sold')::NUMERIC,0) as monthly_unit FROM jsonb_array_elements(v_batch) r)
    UPDATE flipkart_master_sellers m SET remark=u.remark, monthly_unit=u.monthly_unit,
      funnel=unified_get_funnel(u.monthly_unit), updated_at=NOW()
    FROM u WHERE m.asin=u.asin;
    GET DIAGNOSTICS v_rc=ROW_COUNT; v_updated:=v_updated+v_rc; v_offset:=v_offset+batchsize;
  END LOOP;
  UPDATE brand_checking bc SET remark=m.remark, monthly_unit=m.monthly_unit, funnel=unified_get_funnel(m.monthly_unit), updated_at=NOW()
  FROM flipkart_master_sellers m JOIN _tmp_bulk_asins t ON t.asin=m.asin WHERE bc.marketplace='flipkart' AND bc.asin=m.asin;
  UPDATE seller_products sp SET product_status=funnel_to_product_status(unified_get_funnel(m.monthly_unit)), funnel=unified_get_funnel(m.monthly_unit),
    remark=m.remark, monthly_unit=m.monthly_unit, updated_at=NOW()
  FROM flipkart_master_sellers m JOIN _tmp_bulk_asins t ON t.asin=m.asin
  WHERE sp.marketplace='flipkart' AND sp.asin=m.asin AND sp.product_status IN ('high_demand','dropshipping','low_demand');
  GET DIAGNOSTICS v_rc=ROW_COUNT; v_moved:=v_rc;
  RETURN jsonb_build_object('success',true,'updatedcount',v_updated,'movedcount',v_moved,'durationseconds',EXTRACT(EPOCH FROM clock_timestamp()-v_start));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.call_reset_after_change()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM reset_brand_progress_if_empty();
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.create_broadcast_conversation(p_admin_id uuid, p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_conversation_id UUID;
  v_user RECORD;
BEGIN
  -- Create the broadcast conversation
  INSERT INTO chat_conversations (type, name, created_by)
  VALUES ('broadcast', p_name, p_admin_id)
  RETURNING id INTO v_conversation_id;

  -- Add ALL active users as participants
  FOR v_user IN SELECT user_id FROM user_roles WHERE is_active = TRUE LOOP
    INSERT INTO chat_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_user.user_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN v_conversation_id;
END;
$function$


CREATE OR REPLACE FUNCTION public.debug_delete_india_b0tst()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_deleted int;
BEGIN
  DELETE FROM public.india_master_sellers
  WHERE asin LIKE 'B0TST%';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.debug_insert_india_bc1_test_row()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.india_brand_checking_seller_1 (
    asin, product_name, funnel
  )
  VALUES (
    '0230600514',
    'TEST ROW',
    'DP'
  )
  ON CONFLICT (asin) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'asin', '0230600514'
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_india_catchup()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_start   TIMESTAMP := clock_timestamp();
  v_count   INTEGER := 0;
  v_rs      INTEGER := 0;
  v_dp      INTEGER := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_undist_india;
  CREATE TEMP TABLE tmp_undist_india AS
  SELECT fm.asin
  FROM india_master_sellers fm
  WHERE NOT EXISTS (
    SELECT 1 FROM india_brand_checking_seller_1 bc WHERE bc.asin = fm.asin
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    DROP TABLE IF EXISTS tmp_undist_india;
    RETURN jsonb_build_object('success', true, 'processed', 0,
      'message', 'No undistributed records found');
  END IF;

  FOR i IN 1..6 LOOP
    -- Brand checking
    EXECUTE format($sql$
      INSERT INTO india_brand_checking_seller_%s
        (asin, product_name, brand, price, monthly_unit, monthly_sales,
         bsr, seller, category, dimensions, weight, weight_unit,
         link, amz_link, remark, funnel, created_at, updated_at)
      SELECT fm.asin, fm.product_name, fm.brand, fm.price, fm.monthly_unit,
             fm.monthly_sales, fm.bsr, fm.seller, fm.category, fm.dimensions,
             fm.weight, fm.weight_unit, fm.link,
             'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='
               || fm.asin || '&itemCondition=new',
             fm.remark,
             CASE WHEN COALESCE(fm.monthly_unit, 0) >= 5 THEN 'RS' ELSE 'DP' END,
             fm.created_at, NOW()
      FROM india_master_sellers fm
      JOIN tmp_undist_india ua ON fm.asin = ua.asin
      ON CONFLICT (asin) DO UPDATE SET
        monthly_unit = EXCLUDED.monthly_unit, funnel = EXCLUDED.funnel,
        remark = EXCLUDED.remark, updated_at = NOW()
    $sql$, i);

    -- RS → high_demand
    EXECUTE format($sql$
      INSERT INTO india_seller_%s_high_demand
        (asin, product_name, brand, monthly_unit, product_link, amz_link, remark,
         created_at, updated_at)
      SELECT fm.asin, fm.product_name, fm.brand, fm.monthly_unit, fm.link,
             'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='
               || fm.asin || '&itemCondition=new',
             fm.remark, fm.created_at, NOW()
      FROM india_master_sellers fm
      JOIN tmp_undist_india ua ON fm.asin = ua.asin
      WHERE COALESCE(fm.monthly_unit, 0) >= 5
      ON CONFLICT (asin) DO UPDATE SET
        monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark,
        updated_at = NOW()
    $sql$, i);

    -- DP → dropshipping
    EXECUTE format($sql$
      INSERT INTO india_seller_%s_dropshipping
        (asin, product_name, brand, monthly_unit, product_link, amz_link, remark,
         created_at, updated_at)
      SELECT fm.asin, fm.product_name, fm.brand, fm.monthly_unit, fm.link,
             'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='
               || fm.asin || '&itemCondition=new',
             fm.remark, fm.created_at, NOW()
      FROM india_master_sellers fm
      JOIN tmp_undist_india ua ON fm.asin = ua.asin
      WHERE COALESCE(fm.monthly_unit, 0) < 5
      ON CONFLICT (asin) DO UPDATE SET
        monthly_unit = EXCLUDED.monthly_unit, remark = EXCLUDED.remark,
        updated_at = NOW()
    $sql$, i);
  END LOOP;

  SELECT COUNT(*) INTO v_rs  FROM india_seller_1_high_demand   WHERE updated_at > v_start;
  SELECT COUNT(*) INTO v_dp  FROM india_seller_1_dropshipping  WHERE updated_at > v_start;

  DROP TABLE IF EXISTS tmp_undist_india;

  RETURN jsonb_build_object(
    'success', true, 'processed', v_count,
    'restock', v_rs, 'dropshipping', v_dp,
    'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - v_start),
    'message', format('Catchup: %s distributed (%s RS, %s DP)', v_count, v_rs, v_dp)
  );
EXCEPTION WHEN OTHERS THEN
  DROP TABLE IF EXISTS tmp_undist_india;
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_india_chunked(chunk_offset integer, chunk_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_inserted INT := 0; v_start TIMESTAMP := clock_timestamp(); s INT; tags TEXT[] := ARRAY['GR','RR','UB','VV','DE','CV','MV','KL'];
BEGIN
  PERFORM set_config('app.bulk_distributing', 'true', true);
  DROP TABLE IF EXISTS tmp_india_chunk;
  CREATE TEMP TABLE tmp_india_chunk AS
  SELECT m.id, m.asin, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions,
    m.weight, m.weight_unit, m.remark, m.link, m.sku,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || m.asin || '&itemCondition=new' AS amz_link,
    unified_get_funnel(m.monthly_unit, 'india', m.bsr) AS funnel
  FROM india_master_sellers m JOIN india_distribution_queue q ON q.asin = m.asin
  ORDER BY m.asin OFFSET chunk_offset LIMIT chunk_limit;
  CREATE INDEX ON tmp_india_chunk (asin);
  SELECT COUNT(*) INTO v_inserted FROM tmp_india_chunk;
  IF v_inserted = 0 THEN RETURN jsonb_build_object('success', true, 'inserted', 0, 'message', 'No queued records'); END IF;
  FOR s IN 1..8 LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel,sku)
    SELECT 'india',s,t.id,tags[s],t.asin,t.link,t.product_name,t.brand,t.price,t.monthly_unit,t.monthly_sales,t.bsr,t.seller,t.category,t.dimensions,t.weight,t.weight_unit,t.remark,t.amz_link,t.funnel,t.sku
    FROM tmp_india_chunk t
    ON CONFLICT (marketplace,seller_id,asin) DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,sku=EXCLUDED.sku,updated_at=NOW();
    INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,sku,product_status)
    SELECT 'india',s,t.asin,t.product_name,t.brand,t.funnel,t.monthly_unit,t.link,t.amz_link,t.remark,t.sku,funnel_to_product_status(t.funnel)
    FROM tmp_india_chunk t
    ON CONFLICT (marketplace,seller_id,asin) WHERE product_status != 'movement_history' DO UPDATE SET
      remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,sku=EXCLUDED.sku,product_status=EXCLUDED.product_status,updated_at=NOW();
  END LOOP;
  FOR s IN 1..8 LOOP PERFORM unified_recalc_progress('india', s); END LOOP;
  DELETE FROM india_distribution_queue q USING tmp_india_chunk t WHERE q.asin = t.asin;
  DROP TABLE IF EXISTS tmp_india_chunk;
  PERFORM set_config('app.bulk_distributing', 'false', true);
  RETURN jsonb_build_object('success', true, 'inserted', v_inserted, 'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - v_start), 'message', format('Chunk: %s records distributed', v_inserted));
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.bulk_distributing', 'false', true);
  DROP TABLE IF EXISTS tmp_india_chunk;
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_india_from_queue_chunk(p_limit integer DEFAULT 5000)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_processed int := 0;
  v_start     timestamp := clock_timestamp();
BEGIN
  -- take a locked chunk from the queue
  CREATE TEMP TABLE tmp_india_queue_chunk AS
  SELECT asin
  FROM india_distribution_queue
  ORDER BY asin
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;

  IF NOT EXISTS (SELECT 1 FROM tmp_india_queue_chunk) THEN
    RETURN jsonb_build_object(
      'success', true,
      'processed', 0,
      'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - v_start)
    );
  END IF;

  WITH enriched AS (
    SELECT m.*
    FROM tmp_india_queue_chunk q
    JOIN india_master_sellers m USING (asin)
    WHERE m.seller BETWEEN 1 AND 6
  ),
  ins1 AS (
    INSERT INTO india_brand_checking_seller_1 (
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, seller, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      created_at, updated_at
    )
    SELECT
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, 1, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      NOW(), NOW()
    FROM enriched
    WHERE seller = 1
    ON CONFLICT (asin) DO UPDATE SET
      link          = EXCLUDED.link,
      product_name  = EXCLUDED.product_name,
      brand         = EXCLUDED.brand,
      price         = EXCLUDED.price,
      monthly_unit  = EXCLUDED.monthly_unit,
      monthly_sales = EXCLUDED.monthly_sales,
      bsr           = EXCLUDED.bsr,
      seller        = EXCLUDED.seller,
      category      = EXCLUDED.category,
      dimensions    = EXCLUDED.dimensions,
      weight        = EXCLUDED.weight,
      weight_unit   = EXCLUDED.weight_unit,
      funnel        = EXCLUDED.funnel,
      amz_link      = EXCLUDED.amz_link,
      remark        = EXCLUDED.remark,
      sku           = EXCLUDED.sku,
      updated_at    = NOW()
    RETURNING 1
  ),
  ins2 AS (
    INSERT INTO india_brand_checking_seller_2 (
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, seller, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      created_at, updated_at
    )
    SELECT
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, 2, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      NOW(), NOW()
    FROM enriched
    WHERE seller = 2
    ON CONFLICT (asin) DO UPDATE SET
      link          = EXCLUDED.link,
      product_name  = EXCLUDED.product_name,
      brand         = EXCLUDED.brand,
      price         = EXCLUDED.price,
      monthly_unit  = EXCLUDED.monthly_unit,
      monthly_sales = EXCLUDED.monthly_sales,
      bsr           = EXCLUDED.bsr,
      seller        = EXCLUDED.seller,
      category      = EXCLUDED.category,
      dimensions    = EXCLUDED.dimensions,
      weight        = EXCLUDED.weight,
      weight_unit   = EXCLUDED.weight_unit,
      funnel        = EXCLUDED.funnel,
      amz_link      = EXCLUDED.amz_link,
      remark        = EXCLUDED.remark,
      sku           = EXCLUDED.sku,
      updated_at    = NOW()
    RETURNING 1
  ),
  ins3 AS (
    INSERT INTO india_brand_checking_seller_3 (
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, seller, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      created_at, updated_at
    )
    SELECT
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, 3, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      NOW(), NOW()
    FROM enriched
    WHERE seller = 3
    ON CONFLICT (asin) DO UPDATE SET
      link          = EXCLUDED.link,
      product_name  = EXCLUDED.product_name,
      brand         = EXCLUDED.brand,
      price         = EXCLUDED.price,
      monthly_unit  = EXCLUDED.monthly_unit,
      monthly_sales = EXCLUDED.monthly_sales,
      bsr           = EXCLUDED.bsr,
      seller        = EXCLUDED.seller,
      category      = EXCLUDED.category,
      dimensions    = EXCLUDED.dimensions,
      weight        = EXCLUDED.weight,
      weight_unit   = EXCLUDED.weight_unit,
      funnel        = EXCLUDED.funnel,
      amz_link      = EXCLUDED.amz_link,
      remark        = EXCLUDED.remark,
      sku           = EXCLUDED.sku,
      updated_at    = NOW()
    RETURNING 1
  ),
  ins4 AS (
    INSERT INTO india_brand_checking_seller_4 (
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, seller, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      created_at, updated_at
    )
    SELECT
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, 4, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      NOW(), NOW()
    FROM enriched
    WHERE seller = 4
    ON CONFLICT (asin) DO UPDATE SET
      link          = EXCLUDED.link,
      product_name  = EXCLUDED.product_name,
      brand         = EXCLUDED.brand,
      price         = EXCLUDED.price,
      monthly_unit  = EXCLUDED.monthly_unit,
      monthly_sales = EXCLUDED.monthly_sales,
      bsr           = EXCLUDED.bsr,
      seller        = EXCLUDED.seller,
      category      = EXCLUDED.category,
      dimensions    = EXCLUDED.dimensions,
      weight        = EXCLUDED.weight,
      weight_unit   = EXCLUDED.weight_unit,
      funnel        = EXCLUDED.funnel,
      amz_link      = EXCLUDED.amz_link,
      remark        = EXCLUDED.remark,
      sku           = EXCLUDED.sku,
      updated_at    = NOW()
    RETURNING 1
  ),
  ins5 AS (
    INSERT INTO india_brand_checking_seller_5 (
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, seller, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      created_at, updated_at
    )
    SELECT
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, 5, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      NOW(), NOW()
    FROM enriched
    WHERE seller = 5
    ON CONFLICT (asin) DO UPDATE SET
      link          = EXCLUDED.link,
      product_name  = EXCLUDED.product_name,
      brand         = EXCLUDED.brand,
      price         = EXCLUDED.price,
      monthly_unit  = EXCLUDED.monthly_unit,
      monthly_sales = EXCLUDED.monthly_sales,
      bsr           = EXCLUDED.bsr,
      seller        = EXCLUDED.seller,
      category      = EXCLUDED.category,
      dimensions    = EXCLUDED.dimensions,
      weight        = EXCLUDED.weight,
      weight_unit   = EXCLUDED.weight_unit,
      funnel        = EXCLUDED.funnel,
      amz_link      = EXCLUDED.amz_link,
      remark        = EXCLUDED.remark,
      sku           = EXCLUDED.sku,
      updated_at    = NOW()
    RETURNING 1
  ),
  ins6 AS (
    INSERT INTO india_brand_checking_seller_6 (
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, seller, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      created_at, updated_at
    )
    SELECT
      asin, link, product_name, brand, price, monthly_unit,
      monthly_sales, bsr, 6, category, dimensions, weight,
      weight_unit, funnel, amz_link, remark, sku,
      NOW(), NOW()
    FROM enriched
    WHERE seller = 6
    ON CONFLICT (asin) DO UPDATE SET
      link          = EXCLUDED.link,
      product_name  = EXCLUDED.product_name,
      brand         = EXCLUDED.brand,
      price         = EXCLUDED.price,
      monthly_unit  = EXCLUDED.monthly_unit,
      monthly_sales = EXCLUDED.monthly_sales,
      bsr           = EXCLUDED.bsr,
      seller        = EXCLUDED.seller,
      category      = EXCLUDED.category,
      dimensions    = EXCLUDED.dimensions,
      weight        = EXCLUDED.weight,
      weight_unit   = EXCLUDED.weight_unit,
      funnel        = EXCLUDED.funnel,
      amz_link      = EXCLUDED.amz_link,
      remark        = EXCLUDED.remark,
      sku           = EXCLUDED.sku,
      updated_at    = NOW()
    RETURNING 1
  )
  SELECT
    COALESCE((SELECT COUNT(*) FROM ins1), 0) +
    COALESCE((SELECT COUNT(*) FROM ins2), 0) +
    COALESCE((SELECT COUNT(*) FROM ins3), 0) +
    COALESCE((SELECT COUNT(*) FROM ins4), 0) +
    COALESCE((SELECT COUNT(*) FROM ins5), 0) +
    COALESCE((SELECT COUNT(*) FROM ins6), 0)
  INTO v_processed;

  DELETE FROM india_distribution_queue q
  USING tmp_india_queue_chunk t
  WHERE q.asin = t.asin;

  DROP TABLE tmp_india_queue_chunk;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_processed,
    'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - v_start)
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_to_brand_checking_background()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE al TEXT[]; s INT; tags TEXT[]:=ARRAY['GR','RR','UB','VV','DE','CV','MV','KL'];
BEGIN
  SELECT array_agg(asin) INTO al FROM india_master_sellers WHERE processing_status='pending_bc' LIMIT 1000;
  IF al IS NULL OR array_length(al,1)=0 THEN RETURN json_build_object('success',true,'processed',0,'message','No pending items'); END IF;
  FOR s IN 1..8 LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link)
    SELECT 'india',s,m.id,tags[s],m.asin,m.link,m.product_name,m.brand,m.price,m.monthly_unit,m.monthly_sales,m.bsr,m.seller,m.category,m.dimensions,m.weight,m.weight_unit,m.remark,
      'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='||m.asin||'&itemcondition=new'
    FROM india_master_sellers m WHERE m.asin=ANY(al) ON CONFLICT (marketplace,seller_id,asin) DO NOTHING;
  END LOOP;
  UPDATE india_master_sellers SET processing_status='pending_funnel' WHERE asin=ANY(al);
  RETURN json_build_object('success',true,'processed',array_length(al,1));
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_to_funnels_background()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE al TEXT[]; s INT;
BEGIN
  SELECT array_agg(asin) INTO al FROM india_master_sellers WHERE processing_status='pending_funnel' LIMIT 1000;
  IF al IS NULL OR array_length(al,1)=0 THEN RETURN json_build_object('success',true,'processed',0,'message','No pending items'); END IF;
  FOR s IN 1..8 LOOP
    INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,product_status)
    SELECT 'india',s,bc.asin,bc.product_name,bc.brand,unified_get_funnel(bc.monthly_unit),bc.monthly_unit,bc.link,bc.amz_link,bc.remark,funnel_to_product_status(unified_get_funnel(bc.monthly_unit))
    FROM brand_checking bc WHERE bc.marketplace='india' AND bc.seller_id=s AND bc.asin=ANY(al)
    ON CONFLICT (marketplace,seller_id,asin) WHERE product_status!='movement_history' DO UPDATE SET
      product_name=EXCLUDED.product_name,brand=EXCLUDED.brand,monthly_unit=EXCLUDED.monthly_unit,product_link=EXCLUDED.product_link,amz_link=EXCLUDED.amz_link,remark=EXCLUDED.remark;
  END LOOP;
  UPDATE india_master_sellers SET processing_status='complete' WHERE asin=ANY(al);
  RETURN json_build_object('success',true,'processed',array_length(al,1));
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_uae_chunked(chunk_offset integer, chunk_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_inserted INT:=0; s INT; tags TEXT[]:=ARRAY['GR','RR','UB','VV']; v_start TIMESTAMP:=clock_timestamp();
BEGIN
  DROP TABLE IF EXISTS _tmp_uae_dist_chunk;
  CREATE TEMP TABLE _tmp_uae_dist_chunk AS
  SELECT m.id AS source_id, m.asin, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales,
    m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.remark, m.link,
    'https://sellercentral.amazon.ae/hz/approvalrequest/restrictions/approve?asin='||m.asin||'&itemCondition=new' AS amz_link,
    unified_get_funnel(m.monthly_unit) AS funnel
  FROM uae_master_sellers m JOIN uae_distribution_queue q ON q.asin=m.asin
  ORDER BY m.asin OFFSET chunk_offset LIMIT chunk_limit;
  CREATE INDEX ON _tmp_uae_dist_chunk(asin);
  SELECT COUNT(*) INTO v_inserted FROM _tmp_uae_dist_chunk;
  IF v_inserted=0 THEN RETURN jsonb_build_object('success',true,'inserted',0,'message','No queued records'); END IF;
  FOR s IN 1..4 LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel)
    SELECT 'uae',s,t.source_id,tags[s],t.asin,t.link,t.product_name,t.brand,t.price,t.monthly_unit,t.monthly_sales,t.bsr,t.seller,t.category,t.dimensions,t.weight,t.weight_unit,t.remark,t.amz_link,t.funnel
    FROM _tmp_uae_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,updated_at=NOW();
    INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,product_status)
    SELECT 'uae',s,t.asin,t.product_name,t.brand,t.funnel,t.monthly_unit,t.link,t.amz_link,t.remark,funnel_to_product_status(t.funnel)
    FROM _tmp_uae_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) WHERE product_status!='movement_history' DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,product_status=EXCLUDED.product_status,updated_at=NOW();
  END LOOP;
  DELETE FROM uae_distribution_queue q USING _tmp_uae_dist_chunk t WHERE q.asin=t.asin;
  DROP TABLE IF EXISTS _tmp_uae_dist_chunk;
  RETURN jsonb_build_object('success',true,'inserted',v_inserted,'durationseconds',EXTRACT(EPOCH FROM clock_timestamp()-v_start));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_uk_chunked(chunk_offset integer, chunk_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE v_inserted INT:=0; s INT; tags TEXT[]:=ARRAY['GR','RR','UB','VV']; v_start TIMESTAMP:=clock_timestamp();
BEGIN
  DROP TABLE IF EXISTS _tmp_uk_dist_chunk;
  CREATE TEMP TABLE _tmp_uk_dist_chunk AS
  SELECT m.id AS source_id, m.asin, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales,
    m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.remark, m.link,
    'https://sellercentral.amazon.co.uk/hz/approvalrequest/restrictions/approve?asin='||m.asin||'&itemCondition=new' AS amz_link,
    unified_get_funnel(m.monthly_unit) AS funnel
  FROM uk_master_sellers m JOIN uk_distribution_queue q ON q.asin=m.asin
  ORDER BY m.asin OFFSET chunk_offset LIMIT chunk_limit;
  CREATE INDEX ON _tmp_uk_dist_chunk(asin);
  SELECT COUNT(*) INTO v_inserted FROM _tmp_uk_dist_chunk;
  IF v_inserted=0 THEN RETURN jsonb_build_object('success',true,'inserted',0,'message','No queued records'); END IF;
  FOR s IN 1..4 LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel)
    SELECT 'uk',s,t.source_id,tags[s],t.asin,t.link,t.product_name,t.brand,t.price,t.monthly_unit,t.monthly_sales,t.bsr,t.seller,t.category,t.dimensions,t.weight,t.weight_unit,t.remark,t.amz_link,t.funnel
    FROM _tmp_uk_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,updated_at=NOW();
    INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,product_status)
    SELECT 'uk',s,t.asin,t.product_name,t.brand,t.funnel,t.monthly_unit,t.link,t.amz_link,t.remark,funnel_to_product_status(t.funnel)
    FROM _tmp_uk_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) WHERE product_status!='movement_history' DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,product_status=EXCLUDED.product_status,updated_at=NOW();
  END LOOP;
  DELETE FROM uk_distribution_queue q USING _tmp_uk_dist_chunk t WHERE q.asin=t.asin;
  DROP TABLE IF EXISTS _tmp_uk_dist_chunk;
  RETURN jsonb_build_object('success',true,'inserted',v_inserted,'durationseconds',EXTRACT(EPOCH FROM clock_timestamp()-v_start));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.distribute_usa_chunked(chunk_offset integer, chunk_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE v_inserted INT:=0; s INT; tags TEXT[]:=ARRAY['GR','RR','UB','VV']; v_start TIMESTAMP:=clock_timestamp();
BEGIN
  DROP TABLE IF EXISTS _tmp_usa_dist_chunk;
  CREATE TEMP TABLE _tmp_usa_dist_chunk AS
  SELECT m.id AS source_id, m.asin, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales,
    m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.remark, m.link,
    'https://sellercentral.amazon.com/hz/approvalrequest/restrictions/approve?asin='||m.asin||'&itemCondition=new' AS amz_link,
    unified_get_funnel(m.monthly_unit) AS funnel
  FROM usa_master_sellers m JOIN usa_distribution_queue q ON q.asin=m.asin
  ORDER BY m.asin OFFSET chunk_offset LIMIT chunk_limit;
  CREATE INDEX ON _tmp_usa_dist_chunk(asin);
  SELECT COUNT(*) INTO v_inserted FROM _tmp_usa_dist_chunk;
  IF v_inserted=0 THEN RETURN jsonb_build_object('success',true,'inserted',0,'message','No queued records'); END IF;
  FOR s IN 1..4 LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel)
    SELECT 'usa',s,t.source_id,tags[s],t.asin,t.link,t.product_name,t.brand,t.price,t.monthly_unit,t.monthly_sales,t.bsr,t.seller,t.category,t.dimensions,t.weight,t.weight_unit,t.remark,t.amz_link,t.funnel
    FROM _tmp_usa_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,updated_at=NOW();
    INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,product_status)
    SELECT 'usa',s,t.asin,t.product_name,t.brand,t.funnel,t.monthly_unit,t.link,t.amz_link,t.remark,funnel_to_product_status(t.funnel)
    FROM _tmp_usa_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) WHERE product_status!='movement_history' DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,product_status=EXCLUDED.product_status,updated_at=NOW();
  END LOOP;
  DELETE FROM usa_distribution_queue q USING _tmp_usa_dist_chunk t WHERE q.asin=t.asin;
  DROP TABLE IF EXISTS _tmp_usa_dist_chunk;
  RETURN jsonb_build_object('success',true,'inserted',v_inserted,'durationseconds',EXTRACT(EPOCH FROM clock_timestamp()-v_start));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.distributeflipkartchunked(chunk_offset integer, chunk_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_inserted INT:=0; s INT; tags TEXT[]:=ARRAY['GR','RR','UB','VV','DE','CV']; v_start TIMESTAMP:=clock_timestamp();
BEGIN
  DROP TABLE IF EXISTS _tmp_dist_chunk;
  CREATE TEMP TABLE _tmp_dist_chunk AS
  SELECT m.id AS source_id, m.asin, m.product_name, m.brand, m.price, m.monthly_unit, m.monthly_sales,
    m.bsr, m.seller, m.category, m.dimensions, m.weight, m.weight_unit, m.remark, m.link,
    'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='||m.asin||'&itemCondition=new' AS amz_link,
    unified_get_funnel(m.monthly_unit) AS funnel
  FROM flipkart_master_sellers m JOIN flipkart_distribution_queue q ON q.asin=m.asin
  ORDER BY m.asin OFFSET chunk_offset LIMIT chunk_limit;
  CREATE INDEX ON _tmp_dist_chunk(asin);
  SELECT COUNT(*) INTO v_inserted FROM _tmp_dist_chunk;
  IF v_inserted=0 THEN RETURN jsonb_build_object('success',true,'inserted',0,'message','No queued records'); END IF;
  FOR s IN 1..6 LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel)
    SELECT 'flipkart',s,t.source_id,tags[s],t.asin,t.link,t.product_name,t.brand,t.price,t.monthly_unit,t.monthly_sales,t.bsr,t.seller,t.category,t.dimensions,t.weight,t.weight_unit,t.remark,t.amz_link,t.funnel
    FROM _tmp_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,updated_at=NOW();
    INSERT INTO seller_products (marketplace,seller_id,asin,product_name,brand,funnel,monthly_unit,product_link,amz_link,remark,product_status)
    SELECT 'flipkart',s,t.asin,t.product_name,t.brand,t.funnel,t.monthly_unit,t.link,t.amz_link,t.remark,funnel_to_product_status(t.funnel)
    FROM _tmp_dist_chunk t ON CONFLICT(marketplace,seller_id,asin) WHERE product_status!='movement_history' DO UPDATE SET remark=EXCLUDED.remark,monthly_unit=EXCLUDED.monthly_unit,funnel=EXCLUDED.funnel,product_status=EXCLUDED.product_status,updated_at=NOW();
  END LOOP;
  DELETE FROM flipkart_distribution_queue q USING _tmp_dist_chunk t WHERE q.asin=t.asin;
  DROP TABLE IF EXISTS _tmp_dist_chunk;
  RETURN jsonb_build_object('success',true,'inserted',v_inserted,'durationseconds',EXTRACT(EPOCH FROM clock_timestamp()-v_start));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'message',SQLERRM);
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.flipkart_approve_product(p_asin text, p_seller_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE pr RECORD; v_tag TEXT; existing TEXT;
BEGIN
  v_tag := seller_id_to_tag(p_seller_id);
  IF v_tag IS NULL THEN RETURN jsonb_build_object('success',false,'error','Invalid seller_id'); END IF;
  
  SELECT * INTO pr FROM seller_products 
  WHERE marketplace='flipkart' AND seller_id=p_seller_id AND asin=p_asin 
  AND product_status IN ('high_demand','dropshipping','low_demand');
  
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','Product not found'); END IF;
  
  SELECT seller_tag INTO existing FROM flipkart_validation_main_file WHERE asin=p_asin;
  IF FOUND THEN
    IF existing NOT LIKE '%'||v_tag||'%' THEN 
      UPDATE flipkart_validation_main_file SET seller_tag=existing||','||v_tag, updated_at=NOW() WHERE asin=p_asin;
    ELSE 
      RETURN jsonb_build_object('success',false,'error','Already approved'); 
    END IF;
  ELSE
    INSERT INTO flipkart_validation_main_file (asin,product_name,brand,seller_tag,funnel,monthly_unit,product_link,amz_link,flipkart_link)
    VALUES (pr.asin,pr.product_name,pr.brand,v_tag,pr.funnel,pr.monthly_unit,pr.product_link,pr.amz_link,pr.product_link);
  END IF;
  
  DELETE FROM seller_products WHERE marketplace='flipkart' AND seller_id=p_seller_id AND asin=p_asin 
  AND product_status IN ('high_demand','dropshipping','low_demand');
  
  RETURN jsonb_build_object('success',true,'message','Approved');
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.flipkart_distribute_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_table TEXT;
  funnel_tag TEXT;
  seller_id TEXT;
  other_tables TEXT[];
BEGIN
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'flipkart_brand_checking_seller_([0-9]+)');
  
  -- Determine correct funnel
  IF NEW.monthly_unit > 60 THEN
    target_table := 'flipkart_seller_' || seller_id || '_high_demand'; 
    funnel_tag := 'HD';
    other_tables := ARRAY[
      'flipkart_seller_' || seller_id || '_dropshipping',
      'flipkart_seller_' || seller_id || '_low_demand'
    ];
  ELSIF NEW.monthly_unit BETWEEN 1 AND 60 THEN
    target_table := 'flipkart_seller_' || seller_id || '_dropshipping'; 
    funnel_tag := 'DP';
    other_tables := ARRAY[
      'flipkart_seller_' || seller_id || '_high_demand',
      'flipkart_seller_' || seller_id || '_low_demand'
    ];
  ELSE
    target_table := 'flipkart_seller_' || seller_id || '_low_demand'; 
    funnel_tag := 'LD';
    other_tables := ARRAY[
      'flipkart_seller_' || seller_id || '_high_demand',
      'flipkart_seller_' || seller_id || '_dropshipping'
    ];
  END IF;

  -- ✅ DELETE from wrong tables first
  EXECUTE format('DELETE FROM %I WHERE asin = $1', other_tables[1]) USING NEW.asin;
  EXECUTE format('DELETE FROM %I WHERE asin = $1', other_tables[2]) USING NEW.asin;

  -- ✅ Insert/Update in correct table
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
  ) USING NEW.asin, NEW.product_name, NEW.brand, funnel_tag, NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark;
  
  RETURN NEW;
END;
$function$


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
$function$


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
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.flipkart_move_checking_to_brand_checking()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO brand_checking (marketplace, seller_id, source_id, tag, asin, link, product_name, brand,
    price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link)
  VALUES ('flipkart', NEW.seller_id, NEW.id, seller_id_to_tag(NEW.seller_id), NEW.asin,
    NEW.product_link, NEW.product_name, NEW.brand, NEW.target_price, 0, 0, 0,
    NEW.seller_company, NULL, NULL, NEW.product_weight, 'kg', NULL, NEW.inr_purchase_link)
  ON CONFLICT (marketplace, seller_id, asin) DO NOTHING;
  RETURN NEW;
END;
$function$


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
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.flipkart_sync_master_update_to_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO flipkart_distribution_queue (asin, source)
  VALUES (NEW.asin, 'trigger_update')
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.funnel_to_product_status(f text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN CASE WHEN f IN ('RS','HD') THEN 'high_demand' WHEN f = 'DP' THEN 'dropshipping' ELSE 'low_demand' END;
END;
$function$


CREATE OR REPLACE FUNCTION public.generate_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Generate Amazon India seller central link
  NEW.amz_link := 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemCondition=new';
  RETURN NEW;
END;
$function$


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
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.generic_distribute_to_brand_checking()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE s INT; tags TEXT[]; cnt INT; p_mkt TEXT;
BEGIN
  p_mkt := CASE WHEN TG_TABLE_NAME LIKE 'india%' THEN 'india' WHEN TG_TABLE_NAME LIKE 'flipkart%' THEN 'flipkart'
    WHEN TG_TABLE_NAME LIKE 'uae%' THEN 'uae' WHEN TG_TABLE_NAME LIKE 'uk%' THEN 'uk' ELSE 'usa' END;
  cnt := marketplace_seller_count(p_mkt); tags := marketplace_tags(p_mkt);
  FOR s IN 1..cnt LOOP
    INSERT INTO brand_checking (marketplace,seller_id,source_id,tag,asin,link,product_name,brand,price,monthly_unit,monthly_sales,bsr,seller,category,dimensions,weight,weight_unit,remark,amz_link,funnel)
    VALUES (p_mkt,s,NEW.id,tags[s],NEW.asin,NEW.link,NEW.product_name,NEW.brand,NEW.price,NEW.monthly_unit,NEW.monthly_sales,NEW.bsr,NEW.seller,NEW.category,NEW.dimensions,NEW.weight,NEW.weight_unit,NEW.remark,
      NEW.amz_link,unified_get_funnel(NEW.monthly_unit, p_mkt, NEW.bsr))
    ON CONFLICT (marketplace,seller_id,asin) DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.generic_sync_master_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE p_mkt TEXT;
BEGIN
  p_mkt := CASE WHEN TG_TABLE_NAME LIKE 'india%' THEN 'india' WHEN TG_TABLE_NAME LIKE 'flipkart%' THEN 'flipkart'
    WHEN TG_TABLE_NAME LIKE 'uae%' THEN 'uae' WHEN TG_TABLE_NAME LIKE 'uk%' THEN 'uk' ELSE 'usa' END;
  UPDATE brand_checking SET remark=NEW.remark, monthly_unit=NEW.monthly_unit,
    funnel=unified_get_funnel(NEW.monthly_unit, p_mkt, NEW.bsr), updated_at=now()
  WHERE marketplace=p_mkt AND asin=NEW.asin;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.generic_validation_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE raw TEXT; tag TEXT; sid INT; cnt INT; p_mkt TEXT;
BEGIN
  p_mkt := CASE WHEN TG_TABLE_NAME LIKE 'india%' THEN 'india' WHEN TG_TABLE_NAME LIKE 'flipkart%' THEN 'flipkart'
    WHEN TG_TABLE_NAME LIKE 'uae%' THEN 'uae' WHEN TG_TABLE_NAME LIKE 'uk%' THEN 'uk' ELSE 'usa' END;
  raw := COALESCE(CASE WHEN TG_OP='DELETE' THEN OLD.seller_tag ELSE NEW.seller_tag END,
                  CASE WHEN TG_OP='UPDATE' THEN OLD.seller_tag ELSE NULL END);
  IF raw IS NULL THEN RETURN NULL; END IF;
  cnt := marketplace_seller_count(p_mkt);
  FOREACH tag IN ARRAY string_to_array(raw, ',') LOOP
    tag := trim(tag);
    FOR sid IN 1..cnt LOOP
      IF seller_id_to_tag(sid)=tag THEN PERFORM unified_recalc_progress(p_mkt, sid); EXIT; END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_my_conversation_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT conversation_id FROM chat_participants WHERE user_id = auth.uid()
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.get_or_create_dm(p_user1 uuid, p_user2 uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Find existing DM between these two users
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM chat_participants cp1
  JOIN chat_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN chat_conversations cc ON cc.id = cp1.conversation_id
  WHERE cp1.user_id = p_user1
    AND cp2.user_id = p_user2
    AND cc.type = 'dm'
  LIMIT 1;

  -- If no DM exists, create one
  IF v_conversation_id IS NULL THEN
    INSERT INTO chat_conversations (type, created_by)
    VALUES ('dm', p_user1)
    RETURNING id INTO v_conversation_id;

    INSERT INTO chat_participants (conversation_id, user_id)
    VALUES (v_conversation_id, p_user1), (v_conversation_id, p_user2);
  END IF;

  RETURN v_conversation_id;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_unread_counts(p_user_id uuid)
 RETURNS TABLE(conversation_id uuid, unread_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cp.conversation_id,
    COUNT(cm.id) AS unread_count
  FROM chat_participants cp
  LEFT JOIN chat_messages cm ON cm.conversation_id = cp.conversation_id
    AND cm.created_at > cp.last_read_at
    AND cm.sender_id != p_user_id
    AND cm.is_deleted = FALSE
  GROUP BY cp.conversation_id;
END;
$function$


CREATE OR REPLACE FUNCTION public.get_validation_stats()
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
  SELECT json_build_object(
    'total', COUNT(*),
    'passed', COUNT(*) FILTER (WHERE judgement = 'PASS'),
    'failed', COUNT(*) FILTER (WHERE judgement = 'FAIL'),
    'pending', COUNT(*) FILTER (WHERE judgement IS NULL OR judgement = 'PENDING'),
    'rejected', COUNT(*) FILTER (WHERE judgement = 'REJECT'),
    'reworking', COUNT(*) FILTER (WHERE judgement = 'REWORKING'),
    'india_link_nf', COUNT(*) FILTER (WHERE judgement = 'INDIA_LINK_NF'),
    'usa_link_nf', COUNT(*) FILTER (WHERE judgement = 'USA_LINK_NF')
  )
  FROM india_validation_main_file;
$function$


CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.inc_brand_check_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 🔒 DISABLED: approved comes ONLY from usa_validation_main_file
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.inc_brand_check_not_approved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- 🔒 DISABLED: not_approved handled by recalc_brand_check_progress
  RETURN NEW;
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.increment_daily_summary(p_user_id uuid, p_email text, p_full_name text DEFAULT NULL::text, p_count integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO user_daily_summary (user_id, summary_date, total_actions)
  VALUES (p_user_id, CURRENT_DATE, p_count)
  ON CONFLICT (user_id, summary_date)
  DO UPDATE SET total_actions = user_daily_summary.total_actions + p_count;
END;
$function$


CREATE OR REPLACE FUNCTION public.increment_daily_summary(p_user_id uuid, p_email text, p_full_name text DEFAULT NULL::text, p_marketplace text DEFAULT ''::text, p_page text DEFAULT ''::text, p_action text DEFAULT 'move'::text, p_count integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_col text;
  v_today date := CURRENT_DATE;
BEGIN
  -- Determine which action column to increment
  v_col := CASE p_action
    WHEN 'approve' THEN 'approved_count'
    WHEN 'confirm' THEN 'approved_count'
    WHEN 'not_approve' THEN 'not_approved_count'
    WHEN 'reject' THEN 'rejected_count'
    WHEN 'pass' THEN 'passed_count'
    WHEN 'fail' THEN 'failed_count'
    ELSE 'moved_count'
  END;

  -- Upsert summary row
  INSERT INTO user_daily_summary (user_id, email, full_name, summary_date, marketplace, page, total_actions)
  VALUES (p_user_id, p_email, p_full_name, v_today, p_marketplace, p_page, p_count)
  ON CONFLICT (user_id, summary_date, marketplace, page)
  DO UPDATE SET
    total_actions = user_daily_summary.total_actions + p_count,
    updated_at = now();

  -- Increment the specific action column
  EXECUTE format(
    'UPDATE user_daily_summary SET %I = %I + $1 WHERE user_id = $2 AND summary_date = $3 AND marketplace = $4 AND page = $5',
    v_col, v_col
  ) USING p_count, p_user_id, v_today, p_marketplace, p_page;
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.india_approve_product(p_asin text, p_seller_id integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  product_row    RECORD;
  found_in_table text;
  v_seller_tag   text;
  existing_tags  text;
BEGIN
  v_seller_tag := CASE p_seller_id
    WHEN 1 THEN 'GR' WHEN 2 THEN 'RR' WHEN 3 THEN 'UB'
    WHEN 4 THEN 'VV' WHEN 5 THEN 'DE' WHEN 6 THEN 'CV'
  END;

  -- Look in high_demand first
  EXECUTE format(
    'SELECT * FROM india_seller_%s_high_demand WHERE asin = $1', p_seller_id
  ) INTO product_row USING p_asin;

  IF product_row IS NOT NULL THEN
    found_in_table := format('india_seller_%s_high_demand', p_seller_id);
  ELSE
    -- Then dropshipping
    EXECUTE format(
      'SELECT * FROM india_seller_%s_dropshipping WHERE asin = $1', p_seller_id
    ) INTO product_row USING p_asin;
    IF product_row IS NOT NULL THEN
      found_in_table := format('india_seller_%s_dropshipping', p_seller_id);
    END IF;
  END IF;

  IF product_row IS NULL THEN
    RETURN jsonb_build_object('success', false,
      'error', 'Product not found in any funnel table');
  END IF;

  -- Check validation table
  SELECT seller_tag INTO existing_tags
  FROM india_validation_main_file WHERE asin = p_asin;

  IF existing_tags IS NOT NULL THEN
    IF existing_tags LIKE '%' || v_seller_tag || '%' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already approved');
    ELSE
      UPDATE india_validation_main_file
      SET seller_tag = existing_tags || ',' || v_seller_tag,
          updated_at = NOW()
      WHERE asin = p_asin;
    END IF;
  ELSE
    INSERT INTO india_validation_main_file (
      asin, product_name, brand, seller_tag, funnel, monthly_unit,
      product_link, amz_link
    ) VALUES (
      product_row.asin, product_row.product_name, product_row.brand,
      v_seller_tag, product_row.funnel, product_row.monthly_unit,
      product_row.product_link, product_row.amz_link
    );
  END IF;

  -- Delete from funnel table → triggers auto-recalc progress
  EXECUTE format('DELETE FROM %I WHERE asin = $1', found_in_table)
    USING p_asin;

  RETURN jsonb_build_object('success', true, 'message', 'Approved');
END;
$function$


CREATE OR REPLACE FUNCTION public.india_auto_distribute_to_funnels()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id    text;
  target_table text;
  fun          text;
BEGIN
  -- Skip if called during bulk distribution
  IF current_setting('app.bulk_distributing', true) = 'true' THEN
    RETURN NEW;
  END IF;

  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');
  fun := NEW.funnel;

  target_table := 'india_seller_' || seller_id || '_' ||
    CASE fun
      WHEN 'RS' THEN 'high_demand'
      ELSE 'dropshipping'
    END;

  EXECUTE format(
    'INSERT INTO %I (asin, product_name, brand, funnel, remark, monthly_unit, product_link, amz_link, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
     ON CONFLICT (asin) DO UPDATE SET
       product_name = EXCLUDED.product_name,
       brand        = EXCLUDED.brand,
       funnel       = EXCLUDED.funnel,
       remark       = EXCLUDED.remark,
       monthly_unit = EXCLUDED.monthly_unit,
       product_link = EXCLUDED.product_link,
       amz_link     = EXCLUDED.amz_link,
       updated_at   = NOW()',
    target_table
  )
  USING
    NEW.asin,
    NEW.product_name,
    NEW.brand,
    NEW.funnel,
    NEW.remark,
    NEW.monthly_unit,
    NEW.link,
    NEW.amz_link;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_distribute_all()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_start_time TIMESTAMP;
  v_processed_count INTEGER := 0;
  v_asins TEXT[];
BEGIN
  v_start_time := clock_timestamp();

  SELECT ARRAY_AGG(asin) INTO v_asins
  FROM india_master_sellers
  WHERE created_at > NOW() - INTERVAL '10 minutes'
     OR updated_at > NOW() - INTERVAL '10 minutes';

  IF v_asins IS NULL OR array_length(v_asins, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'processed', 0, 'message', 'No recent records to distribute');
  END IF;

  v_processed_count := array_length(v_asins, 1);

  FOR seller_num IN 1..8 LOOP
    EXECUTE format('DELETE FROM india_seller_%s_high_demand WHERE asin = ANY($1)', seller_num) USING v_asins;
    EXECUTE format('DELETE FROM india_seller_%s_dropshipping WHERE asin = ANY($1)', seller_num) USING v_asins;
    EXECUTE format('DELETE FROM india_seller_%s_low_demand WHERE asin = ANY($1)', seller_num) USING v_asins;
  END LOOP;

  FOR seller_num IN 1..8 LOOP
    EXECUTE format('
      INSERT INTO india_brand_checking_seller_%s (
        asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller,
        category, dimensions, weight, weight_unit, link, amz_link, funnel
      )
      SELECT m.asin, m.product_name, m.remark, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller,
        m.category, m.dimensions, m.weight, m.weight_unit, m.link, m.amz_link,
        CASE WHEN m.monthly_unit > 60 THEN ''high_demand'' WHEN m.monthly_unit >= 1 AND m.monthly_unit <= 60 THEN ''dropshipping'' ELSE ''low_demand'' END
      FROM india_master_sellers m WHERE m.asin = ANY($1)
      ON CONFLICT (asin) DO UPDATE SET
        product_name=EXCLUDED.product_name, remark=EXCLUDED.remark, brand=EXCLUDED.brand, price=EXCLUDED.price,
        monthly_unit=EXCLUDED.monthly_unit, monthly_sales=EXCLUDED.monthly_sales, bsr=EXCLUDED.bsr, seller=EXCLUDED.seller,
        category=EXCLUDED.category, dimensions=EXCLUDED.dimensions, weight=EXCLUDED.weight, weight_unit=EXCLUDED.weight_unit,
        link=EXCLUDED.link, amz_link=EXCLUDED.amz_link, funnel=EXCLUDED.funnel, updated_at=NOW()
    ', seller_num) USING v_asins;
  END LOOP;

  FOR seller_num IN 1..8 LOOP
    EXECUTE format('INSERT INTO india_seller_%s_high_demand (asin, product_name, remark, brand, monthly_unit, product_link, amz_link, funnel)
      SELECT m.asin, m.product_name, m.remark, m.brand, m.monthly_unit, m.link, m.amz_link, ''high_demand''
      FROM india_master_sellers m WHERE m.asin = ANY($1) AND m.monthly_unit > 60', seller_num) USING v_asins;

    EXECUTE format('INSERT INTO india_seller_%s_dropshipping (asin, product_name, remark, brand, monthly_unit, product_link, amz_link, funnel)
      SELECT m.asin, m.product_name, m.remark, m.brand, m.monthly_unit, m.link, m.amz_link, ''dropshipping''
      FROM india_master_sellers m WHERE m.asin = ANY($1) AND m.monthly_unit >= 1 AND m.monthly_unit <= 60', seller_num) USING v_asins;

    EXECUTE format('INSERT INTO india_seller_%s_low_demand (asin, product_name, remark, brand, monthly_unit, product_link, amz_link, funnel)
      SELECT m.asin, m.product_name, m.remark, m.brand, m.monthly_unit, m.link, m.amz_link, ''low_demand''
      FROM india_master_sellers m WHERE m.asin = ANY($1) AND m.monthly_unit < 1', seller_num) USING v_asins;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_processed_count,
    'time_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)),
    'message', format('Distributed %s records to all tables', v_processed_count));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM, 'detail', SQLSTATE);
END;
$function$


CREATE OR REPLACE FUNCTION public.india_distribute_all_full()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_start_time TIMESTAMP;
  v_processed_count INTEGER := 0;
  v_asins TEXT[];
  seller_num INT;
BEGIN
  v_start_time := clock_timestamp();

  SELECT ARRAY_AGG(asin) INTO v_asins FROM india_master_sellers;

  IF v_asins IS NULL OR array_length(v_asins, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'processed', 0, 'message', 'No records in india_master_sellers');
  END IF;

  v_processed_count := array_length(v_asins, 1);

  FOR seller_num IN 1..8 LOOP
    EXECUTE format('DELETE FROM india_seller_%s_high_demand WHERE asin = ANY($1)', seller_num) USING v_asins;
    EXECUTE format('DELETE FROM india_seller_%s_dropshipping WHERE asin = ANY($1)', seller_num) USING v_asins;
    EXECUTE format('DELETE FROM india_seller_%s_low_demand WHERE asin = ANY($1)', seller_num) USING v_asins;
  END LOOP;

  FOR seller_num IN 1..8 LOOP
    EXECUTE format('
      INSERT INTO india_brand_checking_seller_%s (
        asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller,
        category, dimensions, weight, weight_unit, link, amz_link, funnel
      )
      SELECT m.asin, m.product_name, m.remark, m.brand, m.price, m.monthly_unit, m.monthly_sales, m.bsr, m.seller,
        m.category, m.dimensions, m.weight, m.weight_unit, m.link, m.amz_link,
        CASE WHEN m.monthly_unit > 60 THEN ''high_demand'' WHEN m.monthly_unit >= 1 AND m.monthly_unit <= 60 THEN ''dropshipping'' ELSE ''low_demand'' END
      FROM india_master_sellers m WHERE m.asin = ANY($1)
      ON CONFLICT (asin) DO UPDATE SET
        product_name=EXCLUDED.product_name, remark=EXCLUDED.remark, brand=EXCLUDED.brand, price=EXCLUDED.price,
        monthly_unit=EXCLUDED.monthly_unit, monthly_sales=EXCLUDED.monthly_sales, bsr=EXCLUDED.bsr, seller=EXCLUDED.seller,
        category=EXCLUDED.category, dimensions=EXCLUDED.dimensions, weight=EXCLUDED.weight, weight_unit=EXCLUDED.weight_unit,
        link=EXCLUDED.link, amz_link=EXCLUDED.amz_link, funnel=EXCLUDED.funnel, updated_at=NOW()
    ', seller_num) USING v_asins;
  END LOOP;

  FOR seller_num IN 1..8 LOOP
    EXECUTE format('INSERT INTO india_seller_%s_high_demand (asin, product_name, remark, brand, monthly_unit, product_link, amz_link, funnel)
      SELECT m.asin, m.product_name, m.remark, m.brand, m.monthly_unit, m.link, m.amz_link, ''high_demand''
      FROM india_master_sellers m WHERE m.asin = ANY($1) AND m.monthly_unit > 60', seller_num) USING v_asins;

    EXECUTE format('INSERT INTO india_seller_%s_dropshipping (asin, product_name, remark, brand, monthly_unit, product_link, amz_link, funnel)
      SELECT m.asin, m.product_name, m.remark, m.brand, m.monthly_unit, m.link, m.amz_link, ''dropshipping''
      FROM india_master_sellers m WHERE m.asin = ANY($1) AND m.monthly_unit >= 1 AND m.monthly_unit <= 60', seller_num) USING v_asins;

    EXECUTE format('INSERT INTO india_seller_%s_low_demand (asin, product_name, remark, brand, monthly_unit, product_link, amz_link, funnel)
      SELECT m.asin, m.product_name, m.remark, m.brand, m.monthly_unit, m.link, m.amz_link, ''low_demand''
      FROM india_master_sellers m WHERE m.asin = ANY($1) AND m.monthly_unit < 1', seller_num) USING v_asins;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'processed', v_processed_count,
    'time_seconds', EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)),
    'message', format('FULL distribute %s records to all tables', v_processed_count));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM, 'detail', SQLSTATE);
END;
$function$


CREATE OR REPLACE FUNCTION public.india_distribute_one_batch(batch_size integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  batch_count int := 0;
  remaining int := 0;
BEGIN
  CREATE TEMP TABLE _batch ON COMMIT DROP AS
  SELECT m.*
  FROM india_master_sellers m
  LEFT JOIN india_brand_checking_seller_1 bc ON bc.asin = m.asin
  WHERE bc.asin IS NULL
  LIMIT batch_size;

  SELECT count(*) INTO batch_count FROM _batch;

  IF batch_count = 0 THEN
    DROP TABLE IF EXISTS _batch;
    RETURN jsonb_build_object('distributed', 0, 'remaining', 0);
  END IF;

  -- Brand checking sellers 1-8
  INSERT INTO india_brand_checking_seller_1 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_2 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_3 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_4 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_5 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_6 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_7 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_8 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch ON CONFLICT (asin) DO NOTHING;

  -- High demand (RS funnel) sellers 1-8
  INSERT INTO india_seller_1_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_2_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_3_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_4_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_5_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_6_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_7_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_8_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS' ON CONFLICT (asin) DO NOTHING;

  -- Dropshipping (DP funnel) sellers 1-8
  INSERT INTO india_seller_1_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_2_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_3_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_4_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_5_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_6_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_7_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_seller_8_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
  SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP' ON CONFLICT (asin) DO NOTHING;

  DROP TABLE _batch;

  SELECT count(*) INTO remaining
  FROM india_master_sellers m
  LEFT JOIN india_brand_checking_seller_1 bc ON bc.asin = m.asin
  WHERE bc.asin IS NULL;

  RETURN jsonb_build_object('distributed', batch_count, 'remaining', remaining);
END;
$function$


CREATE OR REPLACE FUNCTION public.india_distribute_to_all_tables_batched()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  processed int := 0;
  batch_count int;
  t_start timestamptz := clock_timestamp();
BEGIN

  -- Loop until no more missing records
  LOOP
    -- Find records in master NOT yet in brand_checking_seller_1
    CREATE TEMP TABLE _batch ON COMMIT DROP AS
    SELECT m.*
    FROM india_master_sellers m
    LEFT JOIN india_brand_checking_seller_1 bc ON bc.asin = m.asin
    WHERE bc.asin IS NULL
    LIMIT 5000;

    GET DIAGNOSTICS batch_count = ROW_COUNT;

    IF batch_count = 0 THEN
      DROP TABLE IF EXISTS _batch;
      EXIT;
    END IF;

    processed := processed + batch_count;

    INSERT INTO india_brand_checking_seller_1 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_brand_checking_seller_2 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_brand_checking_seller_3 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_brand_checking_seller_4 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_brand_checking_seller_5 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_brand_checking_seller_6 (asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_1_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_2_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_3_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_4_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_5_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_6_high_demand (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'RS'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_1_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_2_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_3_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_4_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_5_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP'
    ON CONFLICT (asin) DO NOTHING;

    INSERT INTO india_seller_6_dropshipping (asin, product_name, brand, funnel, monthly_unit, product_link, amz_link, remark)
    SELECT asin, product_name, brand, funnel, monthly_unit, link, amz_link, remark FROM _batch WHERE funnel = 'DP'
    ON CONFLICT (asin) DO NOTHING;

    DROP TABLE _batch;

  END LOOP;

  RETURN jsonb_build_object(
    'processed', processed,
    'time_seconds', EXTRACT(EPOCH FROM clock_timestamp() - t_start)
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.india_distribute_to_brand_checking_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sellercentral_link TEXT;
  v_funnel TEXT;
BEGIN
  v_sellercentral_link := 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemcondition=new';
  
  IF COALESCE(NEW.monthly_unit, 0) >= 5 THEN
    v_funnel := 'RS';
  ELSIF COALESCE(NEW.bsr, 999999) < 40000 THEN
    v_funnel := 'RS';
  ELSE
    v_funnel := 'DP';
  END IF;

  INSERT INTO india_brand_checking_seller_1 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_2 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_3 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_4 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_5 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_6 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_7 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  INSERT INTO india_brand_checking_seller_8 (asin, product_name, remark, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, link, amz_link, funnel, sku)
  VALUES (NEW.asin, NEW.product_name, NEW.remark, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.link, v_sellercentral_link, v_funnel, NEW.sku)
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_generate_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.amz_link IS NULL OR NEW.amz_link = '' THEN
    NEW.amz_link := 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='
      || NEW.asin || '&itemCondition=new';
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_get_funnel(mu numeric)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF COALESCE(mu, 0) >= 5 THEN
    RETURN 'RS';
  ELSE
    RETURN 'DP';
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_get_funnel(mu numeric, p_bsr numeric DEFAULT NULL::numeric)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF COALESCE(mu, 0) >= 5 THEN
    RETURN 'RS';
  ELSIF COALESCE(p_bsr, 999999) < 40000 THEN
    RETURN 'RS';
  ELSE
    RETURN 'DP';
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_handle_brand_checking_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  sid INT;
BEGIN
  -- Skip if called during bulk distribution
  IF current_setting('app.bulk_distributing', true) = 'true' THEN
    RETURN NULL;
  END IF;

  sid := split_part(TG_TABLE_NAME, '_', 5)::INT;
  PERFORM india_recalc_brand_check_progress(sid);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_handle_not_approved_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  sid INT;
BEGIN
  -- india_seller_X_not_approved → split part 3 = seller number
  sid := split_part(TG_TABLE_NAME, '_', 3)::INT;
  PERFORM india_recalc_brand_check_progress(sid);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_incremental_progress(p_seller_id integer, p_seller_tag text, p_column text, p_delta integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Ensure row exists
  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (p_seller_id, 0, 0, 0, now())
  ON CONFLICT (sellerid) DO NOTHING;

  -- Increment/decrement the appropriate column
  IF p_column = 'total' THEN
    UPDATE india_brand_check_progress
    SET total = GREATEST(0, total + p_delta), updatedat = now()
    WHERE sellerid = p_seller_id;
  ELSIF p_column = 'approved' THEN
    UPDATE india_brand_check_progress
    SET approved = GREATEST(0, approved + p_delta), updatedat = now()
    WHERE sellerid = p_seller_id;
  ELSIF p_column = 'notapproved' THEN
    UPDATE india_brand_check_progress
    SET notapproved = GREATEST(0, notapproved + p_delta), updatedat = now()
    WHERE sellerid = p_seller_id;
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_mark_recent_as_pending(minutes_ago integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_marked_count INTEGER;
BEGIN
  -- For India, we don't have distribution_status column
  -- Instead, just return list of recent ASINs
  SELECT COUNT(*) INTO v_marked_count
  FROM india_master_sellers
  WHERE created_at > NOW() - (minutes_ago || ' minutes')::INTERVAL;

  RETURN jsonb_build_object(
    'success', true,
    'marked', v_marked_count,
    'message', format('Found %s records uploaded in last %s minutes', v_marked_count, minutes_ago)
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.india_rebalance_funnel_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id  text;
  new_table  text;
  old_table  text;
BEGIN
  -- Skip if called during bulk distribution
  IF current_setting('app.bulk_distributing', true) = 'true' THEN
    RETURN NEW;
  END IF;

  IF (OLD.monthly_unit IS NOT DISTINCT FROM NEW.monthly_unit)
     AND (OLD.funnel IS NOT DISTINCT FROM NEW.funnel) THEN
    RETURN NEW;
  END IF;

  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');

  new_table := 'india_seller_' || seller_id || '_' ||
    CASE NEW.funnel
      WHEN 'RS' THEN 'high_demand'
      ELSE 'dropshipping'
    END;

  old_table := 'india_seller_' || seller_id || '_' ||
    CASE OLD.funnel
      WHEN 'RS' THEN 'high_demand'
      ELSE 'dropshipping'
    END;

  IF old_table <> new_table THEN
    EXECUTE format('DELETE FROM %I WHERE asin = $1', old_table)
    USING NEW.asin;

    EXECUTE format(
      'INSERT INTO %I (asin, product_name, brand, funnel, remark, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
       ON CONFLICT (asin) DO UPDATE SET
         product_name = EXCLUDED.product_name,
         brand        = EXCLUDED.brand,
         funnel       = EXCLUDED.funnel,
         remark       = EXCLUDED.remark,
         updated_at   = NOW()',
      new_table
    )
    USING
      NEW.asin,
      NEW.product_name,
      NEW.brand,
      NEW.funnel,
      NEW.remark;
  ELSE
    EXECUTE format(
      'UPDATE %I
       SET product_name = $1,
           brand        = $2,
           remark       = $3,
           updated_at   = NOW()
       WHERE asin = $4',
      new_table
    )
    USING
      NEW.product_name,
      NEW.brand,
      NEW.remark,
      NEW.asin;
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_recalc_brand_check_progress(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  approved_cnt INT := 0;
  not_approved_cnt INT := 0;
  total_cnt INT := 0;
BEGIN
  -- Count TOTAL products in the brand checking seller table
  EXECUTE format('SELECT COALESCE(COUNT(*), 0) FROM india_brand_checking_seller_%s', p_seller_id)
  INTO total_cnt;

  -- Count APPROVED products (approval_status = 'approved')
  EXECUTE format(
    'SELECT COALESCE(COUNT(*), 0) FROM india_brand_checking_seller_%s WHERE approval_status = ''approved''',
    p_seller_id
  )
  INTO approved_cnt;

  -- Count NOT APPROVED products (approval_status = 'not_approved')
  EXECUTE format(
    'SELECT COALESCE(COUNT(*), 0) FROM india_brand_checking_seller_%s WHERE approval_status = ''not_approved''',
    p_seller_id
  )
  INTO not_approved_cnt;

  -- Update or insert progress
  INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
  VALUES (p_seller_id, total_cnt, approved_cnt, not_approved_cnt, now())
  ON CONFLICT (sellerid)
  DO UPDATE SET
    total = EXCLUDED.total,
    approved = EXCLUDED.approved,
    notapproved = EXCLUDED.notapproved,
    updatedat = EXCLUDED.updatedat;
END;
$function$


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
  UPDATE india_brand_checking_seller_7 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  UPDATE india_brand_checking_seller_8 SET remark = NEW.remark, monthly_unit = NEW.monthly_unit, updated_at = now() WHERE asin = NEW.asin;
  RETURN NEW;
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(2);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(3);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(4);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_5()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(5);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_recalc_seller_6()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(6);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_seller1_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_seller5_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(5);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.india_trg_seller6_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM india_recalc_brand_check_progress(6);
  RETURN NULL;
END;
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.log_user_activity(p_user_id uuid, p_email text, p_full_name text, p_action text, p_marketplace text, p_page text, p_table_name text DEFAULT NULL::text, p_asin text DEFAULT NULL::text, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_col text;
  v_today date := CURRENT_DATE;
BEGIN
  INSERT INTO user_activity_log (user_id, email, full_name, action, marketplace, page, table_name, asin, details)
  VALUES (p_user_id, p_email, p_full_name, p_action, p_marketplace, p_page, p_table_name, p_asin, p_details);

  v_col := CASE p_action
    WHEN 'approve' THEN 'approved_count'
    WHEN 'confirm' THEN 'approved_count'
    WHEN 'not_approve' THEN 'not_approved_count'
    WHEN 'reject' THEN 'rejected_count'
    WHEN 'pass' THEN 'passed_count'
    WHEN 'fail' THEN 'failed_count'
    ELSE 'moved_count'
  END;

  INSERT INTO user_daily_summary (user_id, email, full_name, summary_date, marketplace, page, total_actions)
  VALUES (p_user_id, p_email, p_full_name, v_today, p_marketplace, p_page, 1)
  ON CONFLICT (user_id, summary_date, marketplace, page)
  DO UPDATE SET
    total_actions = user_daily_summary.total_actions + 1,
    updated_at = now();

  EXECUTE format(
    'UPDATE user_daily_summary SET %I = %I + 1 WHERE user_id = $1 AND summary_date = $2 AND marketplace = $3 AND page = $4',
    v_col, v_col
  ) USING p_user_id, v_today, p_marketplace, p_page;
END;
$function$


CREATE OR REPLACE FUNCTION public.marketplace_seller_count(mp text)
 RETURNS integer
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN RETURN CASE mp WHEN 'india' THEN 8 WHEN 'flipkart' THEN 6 ELSE 4 END; END;
$function$


CREATE OR REPLACE FUNCTION public.marketplace_tags(mp text)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN CASE mp
    WHEN 'india' THEN ARRAY['GR','RR','UB','VV','DE','CV','MV','KL']
    WHEN 'flipkart' THEN ARRAY['GR','RR','UB','VV','DE','CV']
    ELSE ARRAY['GR','RR','UB','VV'] END;
END;
$function$


CREATE OR REPLACE FUNCTION public.process_flipkart_distribution_queue(batch_size integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_asins TEXT[];
  v_processed INTEGER := 0;
BEGIN
  -- Fetch next batch safely
  SELECT array_agg(asin)
  INTO v_asins
  FROM (
    SELECT asin
    FROM flipkart_distribution_queue
    WHERE status = 'pending'
    ORDER BY id
    LIMIT batch_size
  ) t;

  -- Nothing left to process
  IF v_asins IS NULL OR array_length(v_asins, 1) = 0 THEN
    RETURN 0;
  END IF;

  -- Mark as processing
  UPDATE flipkart_distribution_queue
  SET status = 'processing', started_at = NOW()
  WHERE asin = ANY(v_asins);

  -- 🔥 Distribute to brand + funnels
  PERFORM distribute_flipkart_asins(v_asins);

  -- Mark as done
  UPDATE flipkart_distribution_queue
  SET status = 'done', completed_at = NOW()
  WHERE asin = ANY(v_asins);

  v_processed := array_length(v_asins, 1);
  RETURN v_processed;
END;
$function$


CREATE OR REPLACE FUNCTION public.process_india_distribution_queue(batch_size integer DEFAULT 500)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_asins     TEXT[];
  v_processed INTEGER := 0;
  v_seller_num INTEGER;
BEGIN
  SELECT array_agg(asin) INTO v_asins
  FROM (
    SELECT asin FROM india_distribution_queue
    ORDER BY asin LIMIT batch_size
  ) t;

  IF v_asins IS NULL OR array_length(v_asins, 1) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_seller_num IN 1..6 LOOP
    -- Brand Checking
    EXECUTE format($sql$
      INSERT INTO india_brand_checking_seller_%s
        (asin, product_name, brand, price, monthly_unit, monthly_sales,
         bsr, seller, category, dimensions, weight, weight_unit,
         remark, link, amz_link, funnel)
      SELECT m.asin, m.product_name, m.brand, m.price, m.monthly_unit,
             m.monthly_sales, m.bsr, m.seller, m.category, m.dimensions,
             m.weight, m.weight_unit, m.remark, m.link,
             'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='
               || m.asin || '&itemCondition=new',
             CASE WHEN COALESCE(m.monthly_unit, 0) >= 5 THEN 'RS' ELSE 'DP' END
      FROM india_master_sellers m
      WHERE m.asin = ANY($1)
      ON CONFLICT (asin) DO UPDATE SET
        remark = EXCLUDED.remark, monthly_unit = EXCLUDED.monthly_unit,
        funnel = EXCLUDED.funnel, updated_at = NOW()
    $sql$, v_seller_num) USING v_asins;

    -- RS → high_demand
    EXECUTE format($sql$
      INSERT INTO india_seller_%s_high_demand
        (asin, product_name, brand, funnel, monthly_unit,
         product_link, amz_link, remark)
      SELECT m.asin, m.product_name, m.brand, 'RS', m.monthly_unit, m.link,
             'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='
               || m.asin || '&itemCondition=new', m.remark
      FROM india_master_sellers m
      WHERE m.asin = ANY($1) AND COALESCE(m.monthly_unit, 0) >= 5
      ON CONFLICT (asin) DO UPDATE SET
        remark = EXCLUDED.remark, monthly_unit = EXCLUDED.monthly_unit,
        updated_at = NOW()
    $sql$, v_seller_num) USING v_asins;

    -- DP → dropshipping
    EXECUTE format($sql$
      INSERT INTO india_seller_%s_dropshipping
        (asin, product_name, brand, funnel, monthly_unit,
         product_link, amz_link, remark)
      SELECT m.asin, m.product_name, m.brand, 'DP', m.monthly_unit, m.link,
             'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin='
               || m.asin || '&itemCondition=new', m.remark
      FROM india_master_sellers m
      WHERE m.asin = ANY($1) AND COALESCE(m.monthly_unit, 0) < 5
      ON CONFLICT (asin) DO UPDATE SET
        remark = EXCLUDED.remark, monthly_unit = EXCLUDED.monthly_unit,
        updated_at = NOW()
    $sql$, v_seller_num) USING v_asins;
  END LOOP;

  -- Clean queue
  DELETE FROM india_distribution_queue WHERE asin = ANY(v_asins);
  v_processed := array_length(v_asins, 1);
  RETURN v_processed;
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.rebalance_flipkart_funnels(asin_pattern text DEFAULT '%'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE moved INT:=0; t0 TIMESTAMP:=clock_timestamp();
BEGIN
  UPDATE seller_products sp SET product_status=funnel_to_product_status(bc.funnel),funnel=bc.funnel,monthly_unit=bc.monthly_unit,remark=bc.remark,product_name=bc.product_name,brand=bc.brand,product_link=bc.link
  FROM brand_checking bc WHERE sp.marketplace='flipkart' AND sp.seller_id=bc.seller_id AND sp.asin=bc.asin AND bc.marketplace='flipkart'
    AND sp.asin LIKE asin_pattern AND sp.product_status IN ('high_demand','dropshipping','low_demand');
  GET DIAGNOSTICS moved=ROW_COUNT;
  RETURN json_build_object('success',true,'total_operations',moved,'duration_seconds',EXTRACT(EPOCH FROM clock_timestamp()-t0));
EXCEPTION WHEN OTHERS THEN RETURN json_build_object('success',false,'error',SQLERRM);
END;
$function$


CREATE OR REPLACE FUNCTION public.rebalance_india_funnels(asin_pattern text DEFAULT '%'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  seller_num  int;
  moved_count int := 0;
  temp_count  int;
  start_time  timestamp := clock_timestamp();
BEGIN
  FOR seller_num IN 1..6 LOOP
    -- Delete from high_demand if no longer RS
    EXECUTE format($sql$
      DELETE FROM india_seller_%s_high_demand
      WHERE asin LIKE $1
        AND asin NOT IN (
          SELECT asin FROM india_brand_checking_seller_%s
          WHERE funnel = 'RS' AND asin LIKE $1
        )
    $sql$, seller_num, seller_num) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;

    -- Upsert high_demand from brand_checking RS
    EXECUTE format($sql$
      INSERT INTO india_seller_%s_high_demand
        (asin, product_name, brand, funnel, monthly_unit,
         product_link, amz_link, remark)
      SELECT asin, product_name, brand, funnel, monthly_unit,
             link, amz_link, remark
      FROM india_brand_checking_seller_%s
      WHERE funnel = 'RS' AND asin LIKE $1
      ON CONFLICT (asin) DO UPDATE SET
        monthly_unit = EXCLUDED.monthly_unit,
        remark = EXCLUDED.remark,
        product_name = EXCLUDED.product_name
    $sql$, seller_num, seller_num) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;

    -- Delete from dropshipping if no longer DP
    EXECUTE format($sql$
      DELETE FROM india_seller_%s_dropshipping
      WHERE asin LIKE $1
        AND asin NOT IN (
          SELECT asin FROM india_brand_checking_seller_%s
          WHERE funnel = 'DP' AND asin LIKE $1
        )
    $sql$, seller_num, seller_num) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;

    -- Upsert dropshipping from brand_checking DP
    EXECUTE format($sql$
      INSERT INTO india_seller_%s_dropshipping
        (asin, product_name, brand, funnel, monthly_unit,
         product_link, amz_link, remark)
      SELECT asin, product_name, brand, funnel, monthly_unit,
             link, amz_link, remark
      FROM india_brand_checking_seller_%s
      WHERE funnel = 'DP' AND asin LIKE $1
      ON CONFLICT (asin) DO UPDATE SET
        monthly_unit = EXCLUDED.monthly_unit,
        remark = EXCLUDED.remark,
        product_name = EXCLUDED.product_name
    $sql$, seller_num, seller_num) USING asin_pattern;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    moved_count := moved_count + temp_count;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Funnel rebalancing completed',
    'sellers_updated', 6,
    'total_operations', moved_count,
    'pattern', asin_pattern,
    'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - start_time)
  );
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.recalc_brand_check_progress_for_seller(integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$


CREATE OR REPLACE FUNCTION public.recalc_brand_progress()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Do nothing - disabled
  RETURN;
END;
$function$


CREATE OR REPLACE FUNCTION public.recalc_brand_progress(integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$


CREATE OR REPLACE FUNCTION public.recalc_brand_progress_generic(p_seller_id integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Do nothing - disabled to prevent high_demand affecting dashboard
  RETURN;
END;
$function$


CREATE OR REPLACE FUNCTION public.refresh_all_sellers_from_validation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_seller_id INT;
  v_old_seller_id INT;
  v_tag TEXT;
BEGIN
  -- Skip if no relevant columns changed
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.seller_tag IS NOT DISTINCT FROM NEW.seller_tag)
       AND (OLD.judgement IS NOT DISTINCT FROM NEW.judgement)
       AND (OLD.status IS NOT DISTINCT FROM NEW.status)
       AND (OLD.sent_to_purchases IS NOT DISTINCT FROM NEW.sent_to_purchases) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Map new seller_tag to seller_id
  IF TG_OP = 'DELETE' THEN
    v_tag := OLD.seller_tag;
  ELSE
    v_tag := NEW.seller_tag;
  END IF;

  v_seller_id := CASE
    WHEN v_tag LIKE '%GR%' THEN 1
    WHEN v_tag LIKE '%RR%' THEN 2
    WHEN v_tag LIKE '%UB%' THEN 3
    WHEN v_tag LIKE '%VV%' THEN 4
    WHEN v_tag LIKE '%DE%' THEN 5
    WHEN v_tag LIKE '%CV%' THEN 6
    ELSE NULL
  END;

  IF v_seller_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    PERFORM india_incremental_progress(v_seller_id, v_tag, 'approved', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM india_incremental_progress(v_seller_id, v_tag, 'approved', -1);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.seller_tag IS DISTINCT FROM NEW.seller_tag THEN
      v_old_seller_id := CASE
        WHEN OLD.seller_tag LIKE '%GR%' THEN 1
        WHEN OLD.seller_tag LIKE '%RR%' THEN 2
        WHEN OLD.seller_tag LIKE '%UB%' THEN 3
        WHEN OLD.seller_tag LIKE '%VV%' THEN 4
        WHEN OLD.seller_tag LIKE '%DE%' THEN 5
        WHEN OLD.seller_tag LIKE '%CV%' THEN 6
        ELSE NULL
      END;
      IF v_old_seller_id IS NOT NULL THEN
        PERFORM india_incremental_progress(v_old_seller_id, OLD.seller_tag, 'approved', -1);
      END IF;
      PERFORM india_incremental_progress(v_seller_id, v_tag, 'approved', 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.refresh_india_brand_check_progress()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  FOR i IN 1..8 LOOP
    PERFORM india_recalc_brand_check_progress(i);
  END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_1()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(1); END; $function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_2()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(2); END; $function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_3()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(3); END; $function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_4()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(4); END; $function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_5()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(5); END; $function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_6()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(6); END; $function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_7()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(7); END;
$function$


CREATE OR REPLACE FUNCTION public.refresh_india_progress_seller_8()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(8); END;
$function$


CREATE OR REPLACE FUNCTION public.reset_brand_progress_if_empty()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.run_flipkart_distribution_until_done()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  LOOP
    EXIT WHEN (process_flipkart_distribution_queue(500)->>'processed') IS NULL;
    PERFORM pg_sleep(0.2);
  END LOOP;
END;
$function$


CREATE OR REPLACE FUNCTION public.run_india_distribution_until_done()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_batch     INTEGER;
  v_total     INTEGER := 0;
  v_iters     INTEGER := 0;
  v_start     TIMESTAMP := clock_timestamp();
BEGIN
  LOOP
    v_batch := process_india_distribution_queue(500);
    v_total := v_total + v_batch;
    v_iters := v_iters + 1;
    EXIT WHEN v_batch = 0;
    PERFORM pg_sleep(0.05);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_processed', v_total,
    'iterations', v_iters,
    'duration_seconds', EXTRACT(EPOCH FROM clock_timestamp() - v_start),
    'message', format('Done: %s records in %s batches', v_total, v_iters)
  );
END;
$function$


CREATE OR REPLACE FUNCTION public.search_asin_everywhere(asin_input text)
 RETURNS TABLE(found_table text, found_asin text, found_productname text, found_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY SELECT bc.marketplace||'_brand_checking_seller_'||bc.seller_id::text, bc.asin, bc.product_name, bc.approval_status FROM brand_checking bc WHERE bc.asin=asin_input;
  RETURN QUERY SELECT sp.marketplace||'_seller_'||sp.seller_id::text||'_'||sp.product_status, sp.asin, sp.product_name, sp.product_status FROM seller_products sp WHERE sp.asin=asin_input AND sp.product_status!='movement_history';
  RETURN QUERY SELECT le.marketplace||'_listing_error_seller_'||le.seller_id::text||'_'||le.error_status, le.asin, le.product_name, le.error_status FROM listing_errors le WHERE le.asin=asin_input AND le.error_status!='movement_history';
  RETURN QUERY SELECT t.marketplace||'_'||t.ops_type||'_seller_'||t.seller_id::text, t.asin, t.product_name, t.ops_type FROM tracking_ops t WHERE t.asin=asin_input;
  RETURN QUERY SELECT 'india_validation_main_file',v.asin,v.product_name,v.status FROM india_validation_main_file v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'flipkart_validation_main_file',v.asin,v.product_name,v.status FROM flipkart_validation_main_file v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'usa_validation_main_file',v.asin,v.product_name,v.status FROM usa_validation_main_file v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uae_validation_main_file',v.asin,v.product_name,v.status FROM uae_validation_main_file v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uk_validation_main_file',v.asin,v.product_name,v.status FROM uk_validation_main_file v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'india_admin_validation',v.asin,v.product_name,v.admin_status FROM india_admin_validation v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'flipkart_admin_validation',v.asin,v.product_name,v.admin_status FROM flipkart_admin_validation v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'usa_admin_validation',v.asin,v.product_name,v.admin_status FROM usa_admin_validation v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uae_admin_validation',v.asin,v.product_name,v.admin_status FROM uae_admin_validation v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uk_admin_validation',v.asin,v.product_name,v.admin_status FROM uk_admin_validation v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'india_purchases',v.asin,v.product_name,v.status FROM india_purchases v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'flipkart_purchases',v.asin,v.product_name,v.status FROM flipkart_purchases v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'usa_purchases',v.asin,v.product_name,v.status FROM usa_purchases v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uae_purchases',v.asin,v.product_name,v.status FROM uae_purchases v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uk_purchases',v.asin,v.product_name,v.status FROM uk_purchases v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'india_master_sellers',v.asin,v.product_name,NULL::text FROM india_master_sellers v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'flipkart_master_sellers',v.asin,v.product_name,NULL::text FROM flipkart_master_sellers v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'usa_master_sellers',v.asin,v.product_name,NULL::text FROM usa_master_sellers v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uae_master_sellers',v.asin,v.product_name,NULL::text FROM uae_master_sellers v WHERE v.asin=asin_input;
  RETURN QUERY SELECT 'uk_master_sellers',v.asin,v.product_name,NULL::text FROM uk_master_sellers v WHERE v.asin=asin_input;
  RETURN;
END;
$function$


CREATE OR REPLACE FUNCTION public.seller_id_to_tag(p_id integer)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  RETURN CASE p_id WHEN 1 THEN 'GR' WHEN 2 THEN 'RR' WHEN 3 THEN 'UB' WHEN 4 THEN 'VV'
    WHEN 5 THEN 'DE' WHEN 6 THEN 'CV' WHEN 7 THEN 'MV' WHEN 8 THEN 'KL' ELSE NULL END;
END;
$function$


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
$function$


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
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.trg_brand_checking_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE m TEXT; sid INT;
BEGIN
  IF TG_OP='DELETE' THEN m:=OLD.marketplace; sid:=OLD.seller_id; ELSE m:=NEW.marketplace; sid:=NEW.seller_id; END IF;
  IF m='usa' THEN PERFORM unified_recalc_progress(m, sid); END IF; RETURN NULL;
END;
$function$


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
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.trg_inc_na_s2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(2);
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trg_inc_na_s3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(3);
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trg_inc_na_s4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(4);
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trg_inc_not_approved_s1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM increment_not_approved(1);
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM india_incremental_progress(1, '', 'total', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM india_incremental_progress(1, '', 'total', -1);
  END IF;
  RETURN NULL;
END; $function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM india_incremental_progress(2, '', 'total', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM india_incremental_progress(2, '', 'total', -1);
  END IF;
  RETURN NULL;
END; $function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM india_incremental_progress(3, '', 'total', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM india_incremental_progress(3, '', 'total', -1);
  END IF;
  RETURN NULL;
END; $function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM india_incremental_progress(4, '', 'total', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM india_incremental_progress(4, '', 'total', -1);
  END IF;
  RETURN NULL;
END; $function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_5()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM india_incremental_progress(5, '', 'total', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM india_incremental_progress(5, '', 'total', -1);
  END IF;
  RETURN NULL;
END; $function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_6()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM india_incremental_progress(6, '', 'total', 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM india_incremental_progress(6, '', 'total', -1);
  END IF;
  RETURN NULL;
END; $function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_7()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(7); RETURN NULL; END;
$function$


CREATE OR REPLACE FUNCTION public.trg_refresh_india_progress_seller_8()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN PERFORM india_recalc_brand_check_progress(8); RETURN NULL; END;
$function$


CREATE OR REPLACE FUNCTION public.trg_seller_products_recalc()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE m TEXT; sid INT;
BEGIN
  IF TG_OP='DELETE' THEN m:=OLD.marketplace; sid:=OLD.seller_id; ELSE m:=NEW.marketplace; sid:=NEW.seller_id; END IF;
  PERFORM unified_recalc_progress(m, sid); RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.trigger_recalc_from_table()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Do nothing - disabled to prevent high_demand affecting dashboard
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.trigger_refresh_india_progress()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_brand_check_progress();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.trigger_refresh_india_progress_seller()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM refresh_india_brand_check_progress();
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.trigger_refresh_india_progress_validation()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Refresh progress for the specific seller
  PERFORM refresh_india_brand_check_progress();
  RETURN COALESCE(NEW, OLD);
END;
$function$


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
$function$


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
$function$


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
$function$


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
$function$


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
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(2);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(3);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.uae_trg_recalc_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uae_recalc_brand_check_progress(4);
  RETURN NULL;
END;
$function$


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
$function$


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
$function$


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
$function$


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
$function$


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
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_1()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(1);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_2()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(2);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_3()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(3);
  RETURN NULL;
END;
$function$


CREATE OR REPLACE FUNCTION public.uk_trg_recalc_seller_4()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM uk_recalc_brand_check_progress(4);
  RETURN NULL;
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.unified_distribute_to_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO seller_products (marketplace, seller_id, asin, product_name, brand, funnel,
    monthly_unit, product_link, amz_link, remark, product_status)
  VALUES (NEW.marketplace, NEW.seller_id, NEW.asin, NEW.product_name, NEW.brand, NEW.funnel,
    NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark, funnel_to_product_status(NEW.funnel))
  ON CONFLICT (marketplace, seller_id, asin) WHERE product_status != 'movement_history' DO NOTHING;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.unified_generate_amz_link()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.amz_link IS NULL OR NEW.amz_link = '' THEN
    NEW.amz_link := CASE NEW.marketplace
      WHEN 'uae' THEN 'https://sellercentral.amazon.ae/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemcondition=new'
      WHEN 'uk'  THEN 'https://sellercentral.amazon.co.uk/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemcondition=new'
      ELSE 'https://sellercentral.amazon.in/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemcondition=new'
    END;
  END IF;
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.unified_get_funnel(mu numeric, p_mkt text DEFAULT 'usa'::text, p_bsr numeric DEFAULT NULL::numeric)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF p_mkt = 'india' THEN
    IF mu >= 5 OR (p_bsr IS NOT NULL AND p_bsr < 40000) THEN RETURN 'RS';
    ELSE RETURN 'DP';
    END IF;
  ELSE
    IF mu > 60 THEN RETURN 'HD';
    ELSIF mu BETWEEN 1 AND 60 THEN RETURN 'DP';
    ELSE RETURN 'LD';
    END IF;
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.unified_rebalance_funnel_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.monthly_unit IS NOT DISTINCT FROM NEW.monthly_unit AND OLD.remark IS NOT DISTINCT FROM NEW.remark THEN RETURN NEW; END IF;
  UPDATE seller_products SET product_status=funnel_to_product_status(NEW.funnel), funnel=NEW.funnel,
    remark=NEW.remark, monthly_unit=NEW.monthly_unit, product_name=NEW.product_name,
    brand=NEW.brand, product_link=NEW.link, amz_link=NEW.amz_link
  WHERE marketplace=NEW.marketplace AND seller_id=NEW.seller_id AND asin=NEW.asin
    AND product_status IN ('high_demand','dropshipping','low_demand');
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.unified_recalc_progress(p_mkt text, p_sid integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_tag TEXT; v_approved INT:=0; v_na INT:=0; v_total INT:=0; v_pending INT:=0; v_rejected INT:=0; v_all INT;
BEGIN
  v_tag := seller_id_to_tag(p_sid); IF v_tag IS NULL THEN RETURN; END IF;
  SELECT COUNT(*) INTO v_na FROM seller_products WHERE marketplace=p_mkt AND seller_id=p_sid AND product_status='not_approved';
  SELECT COUNT(*) INTO v_total FROM seller_products WHERE marketplace=p_mkt AND seller_id=p_sid AND product_status IN ('high_demand','dropshipping','low_demand');

  IF p_mkt = 'india' THEN
    SELECT COUNT(*) INTO v_approved FROM india_validation_main_file WHERE seller_tag LIKE '%'||v_tag||'%';
    INSERT INTO india_brand_check_progress (sellerid, total, approved, notapproved, updatedat)
    VALUES (p_sid, v_total, v_approved, v_na, now())
    ON CONFLICT (sellerid) DO UPDATE SET total=EXCLUDED.total, approved=EXCLUDED.approved, notapproved=EXCLUDED.notapproved, updatedat=EXCLUDED.updatedat;
  ELSIF p_mkt = 'usa' THEN
    SELECT COUNT(*) INTO v_approved FROM usa_validation_main_file WHERE seller_tag LIKE '%'||v_tag||'%';
    SELECT COUNT(*) INTO v_pending FROM brand_checking WHERE marketplace='usa' AND seller_id=p_sid;
    SELECT COUNT(*) INTO v_rejected FROM seller_products WHERE marketplace='usa' AND seller_id=p_sid AND product_status='reject';
    v_all := v_pending+v_approved+v_na+v_rejected;
    UPDATE brand_check_progress SET pending=v_pending, approved=v_approved, not_approved=v_na, rejected=v_rejected, total=v_all, updated_at=now() WHERE seller_id=p_sid;
    IF NOT FOUND THEN INSERT INTO brand_check_progress (seller_id,pending,approved,not_approved,rejected,total) VALUES (p_sid,v_pending,v_approved,v_na,v_rejected,v_all); END IF;
  ELSIF p_mkt = 'flipkart' THEN
    SELECT COUNT(*) INTO v_approved FROM flipkart_validation_main_file WHERE seller_tag LIKE '%'||v_tag||'%';
    UPDATE flipkart_brand_check_progress SET approved=v_approved, not_approved=v_na, total=v_total, updated_at=now() WHERE seller_id=p_sid;
    IF NOT FOUND THEN INSERT INTO flipkart_brand_check_progress (seller_id,pending,approved,not_approved,rejected,total) VALUES (p_sid,0,v_approved,v_na,0,v_total); END IF;
  ELSIF p_mkt = 'uae' THEN
    SELECT COUNT(*) INTO v_approved FROM uae_validation_main_file WHERE seller_tag LIKE '%'||v_tag||'%';
    UPDATE uae_brand_check_progress SET approved=v_approved, not_approved=v_na, total=v_total, updated_at=now() WHERE seller_id=p_sid;
  ELSIF p_mkt = 'uk' THEN
    SELECT COUNT(*) INTO v_approved FROM uk_validation_main_file WHERE seller_tag LIKE '%'||v_tag||'%';
    UPDATE uk_brand_check_progress SET approved=v_approved, not_approved=v_na, total=v_total, updated_at=now() WHERE seller_id=p_sid;
  END IF;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_admin_constants_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.update_brand_check_progress(integer)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN;
END;
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$


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
$function$


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
$function$


CREATE OR REPLACE FUNCTION public.usa_auto_distribute_to_funnels()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  seller_id text;
  target_table text;
BEGIN
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'seller_([0-9]+)');
  
  target_table := 'usa_seller_' || seller_id || '_' ||
    CASE NEW.funnel
      WHEN 'HD' THEN 'high_demand'
      WHEN 'DP' THEN 'dropshipping'
      ELSE 'low_demand'
    END;
  
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
$function$


CREATE OR REPLACE FUNCTION public.usa_batch_distribute_master(batch_size integer DEFAULT 1000)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  rec RECORD;
  processed int := 0;
  skipped int := 0;
  v_funnel text;
  v_amz_link text;
  seller_tags text[] := ARRAY['GA', 'RR', 'UB', 'VV'];
  i int;
  v_target_table text;
  v_funnel_table text;
BEGIN
  FOR rec IN 
    SELECT * FROM usa_master_sellers 
    ORDER BY created_at ASC 
    LIMIT batch_size
  LOOP
    v_funnel := usa_get_funnel(rec.monthly_unit);
    v_amz_link := 'https://sellercentral.amazon.com/hz/approvalrequest/restrictions/approve?asin=' || rec.asin || '&itemCondition=new';
    
    FOR i IN 1..4 LOOP
      v_target_table := 'usa_brand_checking_seller_' || i;
      
      -- Insert into brand checking
      EXECUTE format(
        'INSERT INTO %I (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (asin) DO NOTHING',
        v_target_table
      ) USING rec.id, seller_tags[i], rec.asin, rec.link, rec.product_name, rec.brand, rec.price, rec.monthly_unit, rec.monthly_sales, rec.bsr, rec.seller, rec.category, rec.dimensions, rec.weight, rec.weight_unit, rec.remark, v_amz_link, v_funnel;
      
      -- Insert into funnel sub-table
      v_funnel_table := 'usa_seller_' || i || '_' ||
        CASE v_funnel
          WHEN 'HD' THEN 'high_demand'
          WHEN 'DP' THEN 'dropshipping'
          ELSE 'low_demand'
        END;
      
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
        v_funnel_table
      ) USING rec.asin, rec.product_name, rec.brand, v_funnel, rec.monthly_unit, rec.link, v_amz_link, rec.remark;
    END LOOP;
    
    processed := processed + 1;
  END LOOP;
  
  RETURN jsonb_build_object('processed', processed, 'skipped', skipped);
END;
$function$


CREATE OR REPLACE FUNCTION public.usa_distribute_seller_products()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_table TEXT;
  funnel_tag TEXT;
  seller_id TEXT;
  other_tables TEXT[];
BEGIN
  seller_id := SUBSTRING(TG_TABLE_NAME FROM 'usa_brand_checking_seller_([0-9]+)');
  
  IF NEW.monthly_unit > 60 THEN
    target_table := 'usa_seller_' || seller_id || '_high_demand'; 
    funnel_tag := 'HD';
    other_tables := ARRAY[
      'usa_seller_' || seller_id || '_dropshipping',
      'usa_seller_' || seller_id || '_low_demand'
    ];
  ELSIF NEW.monthly_unit BETWEEN 1 AND 60 THEN
    target_table := 'usa_seller_' || seller_id || '_dropshipping'; 
    funnel_tag := 'DP';
    other_tables := ARRAY[
      'usa_seller_' || seller_id || '_high_demand',
      'usa_seller_' || seller_id || '_low_demand'
    ];
  ELSE
    target_table := 'usa_seller_' || seller_id || '_low_demand'; 
    funnel_tag := 'LD';
    other_tables := ARRAY[
      'usa_seller_' || seller_id || '_high_demand',
      'usa_seller_' || seller_id || '_dropshipping'
    ];
  END IF;

  EXECUTE format('DELETE FROM %I WHERE asin = $1', other_tables[1]) USING NEW.asin;
  EXECUTE format('DELETE FROM %I WHERE asin = $1', other_tables[2]) USING NEW.asin;

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
  ) USING NEW.asin, NEW.product_name, NEW.brand, funnel_tag, NEW.monthly_unit, NEW.link, NEW.amz_link, NEW.remark;
  
  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.usa_distribute_to_brand_checking_sellers()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  calculated_funnel text;
  v_amz_link text;
BEGIN
  calculated_funnel := usa_get_funnel(NEW.monthly_unit);
  -- Generate AMZ Seller Central link (USA domain)
  v_amz_link := 'https://sellercentral.amazon.com/hz/approvalrequest/restrictions/approve?asin=' || NEW.asin || '&itemCondition=new';

  -- Seller 1: Golden Aura
  INSERT INTO usa_brand_checking_seller_1 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'GA', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, v_amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 2: Rudra Retail
  INSERT INTO usa_brand_checking_seller_2 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'RR', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, v_amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 3: UBeauty
  INSERT INTO usa_brand_checking_seller_3 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'UB', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, v_amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  -- Seller 4: Velvet Vista
  INSERT INTO usa_brand_checking_seller_4 (source_id, tag, asin, link, product_name, brand, price, monthly_unit, monthly_sales, bsr, seller, category, dimensions, weight, weight_unit, remark, amz_link, funnel)
  VALUES (NEW.id, 'VV', NEW.asin, NEW.link, NEW.product_name, NEW.brand, NEW.price, NEW.monthly_unit, NEW.monthly_sales, NEW.bsr, NEW.seller, NEW.category, NEW.dimensions, NEW.weight, NEW.weight_unit, NEW.remark, v_amz_link, calculated_funnel)
  ON CONFLICT (asin) DO NOTHING;

  RETURN NEW;
END;
$function$


CREATE OR REPLACE FUNCTION public.usa_get_funnel(p_monthly_unit numeric)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
BEGIN
  IF p_monthly_unit > 60 THEN
    RETURN 'HD';
  ELSIF p_monthly_unit BETWEEN 1 AND 60 THEN
    RETURN 'DP';
  ELSE
    RETURN 'LD';
  END IF;
END;
$function$


