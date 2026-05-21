CREATE OR REPLACE FUNCTION get_brand_report(p_marketplace TEXT, p_seller_id INT)
RETURNS TABLE(brand TEXT, total BIGINT, rs BIGINT, dp BIGINT)
LANGUAGE sql STABLE
AS $$
  SELECT 
    COALESCE(NULLIF(TRIM(brand), ''), 'Unknown') AS brand,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE funnel = 'RS') AS rs,
    COUNT(*) FILTER (WHERE funnel = 'DP') AS dp
  FROM seller_products
  WHERE marketplace = p_marketplace
    AND seller_id = p_seller_id
    AND product_status IN ('high_demand', 'dropshipping', 'not_approved')
  GROUP BY 1
  ORDER BY total DESC;
$$;