CREATE OR REPLACE FUNCTION bulk_insert_india_master_with_distribution(batch_data JSONB)
RETURNS JSON AS $$
DECLARE
    product JSONB;
    seller_num INT;
    inserted_count INT := 0;
BEGIN
    -- Insert into master table
    INSERT INTO india_master (asin, product_name, remark, brand, price, monthly_units_sold, 
                              monthly_revenue, bsr, no_of_sellers, category, dimensions, weight, link)
    SELECT 
        (p->>'asin')::TEXT,
        (p->>'product_name')::TEXT,
        (p->>'remark')::TEXT,
        (p->>'brand')::TEXT,
        (p->>'price')::NUMERIC,
        (p->>'monthly_units_sold')::INT,
        (p->>'monthly_revenue')::NUMERIC,
        (p->>'bsr')::INT,
        (p->>'no_of_sellers')::INT,
        (p->>'category')::TEXT,
        (p->>'dimensions')::TEXT,
        (p->>'weight')::NUMERIC,
        (p->>'link')::TEXT
    FROM jsonb_array_elements(batch_data) AS p
    ON CONFLICT (asin) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        remark = EXCLUDED.remark,
        brand = EXCLUDED.brand,
        price = EXCLUDED.price,
        monthly_units_sold = EXCLUDED.monthly_units_sold,
        monthly_revenue = EXCLUDED.monthly_revenue,
        bsr = EXCLUDED.bsr,
        no_of_sellers = EXCLUDED.no_of_sellers,
        category = EXCLUDED.category,
        dimensions = EXCLUDED.dimensions,
        weight = EXCLUDED.weight,
        link = EXCLUDED.link;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;

    -- Distribute to brand checking tables with CORRECT column names
    FOR product IN SELECT * FROM jsonb_array_elements(batch_data) LOOP
        seller_num := (inserted_count % 6) + 1;
        
        -- ✅ Fixed column mapping: monthly_unit, monthly_sales, seller (not monthly_units_sold, monthly_revenue, no_of_sellers)
        EXECUTE format('INSERT INTO india_brand_checking_seller_%s 
                       (asin, product_name, remark, brand, price, monthly_unit, 
                        monthly_sales, bsr, seller, category, dimensions, weight, link)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                       ON CONFLICT (asin) DO NOTHING', seller_num)
        USING product->>'asin', product->>'product_name', product->>'remark', 
              product->>'brand', (product->>'price')::NUMERIC, 
              (product->>'monthly_units_sold')::NUMERIC,  -- Maps to monthly_unit
              (product->>'monthly_revenue')::NUMERIC,      -- Maps to monthly_sales
              (product->>'bsr')::NUMERIC,
              (product->>'no_of_sellers')::NUMERIC,        -- Maps to seller
              product->>'category', product->>'dimensions', 
              (product->>'weight')::NUMERIC, product->>'link';
        
        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN json_build_object('inserted_count', inserted_count);
END;
$$ LANGUAGE plpgsql;
