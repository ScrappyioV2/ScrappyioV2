-- Drop existing function
DROP FUNCTION IF EXISTS bulk_insert_india_master_with_distribution(jsonb);

-- Create with SECURITY DEFINER and proper permissions
CREATE OR REPLACE FUNCTION public.bulk_insert_india_master_with_distribution(products JSONB)
RETURNS TABLE(inserted_count INTEGER, updated_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  inserted INTEGER := 0;
  updated INTEGER := 0;
  product JSONB;
BEGIN
  FOR product IN SELECT * FROM jsonb_array_elements(products)
  LOOP
    INSERT INTO public.india_master_sellers (
      asin, product_name, remark, brand, price, 
      monthly_units_sold, monthly_revenue, bsr, 
      no_of_sellers, category, dimensions, weight, link, display_number
    ) VALUES (
      product->>'asin',
      product->>'product_name',
      product->>'remark',
      product->>'brand',
      NULLIF(product->>'price', '')::NUMERIC,
      NULLIF(product->>'monthly_units_sold', '')::INTEGER,
      NULLIF(product->>'monthly_revenue', '')::NUMERIC,
      NULLIF(product->>'bsr', '')::INTEGER,
      NULLIF(product->>'no_of_sellers', '')::INTEGER,
      product->>'category',
      product->>'dimensions',
      NULLIF(product->>'weight', '')::NUMERIC,
      product->>'link',
      COALESCE(NULLIF(product->>'display_number', '')::INTEGER, 
               (SELECT COALESCE(MAX(display_number), 0) + 1 FROM india_master_sellers))
    )
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
      link = EXCLUDED.link,
      updated_at = now();

    IF FOUND THEN
      updated := updated + 1;
    ELSE
      inserted := inserted + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT inserted, updated;
END;
$$;
