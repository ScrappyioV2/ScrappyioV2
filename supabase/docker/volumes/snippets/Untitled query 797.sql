SELECT 
  p.asin,
  p.seller_tag AS purchase_tags,
  v.seller_tag AS validation_tags,
  p.status AS purchase_status,
  p.sent_to_admin,
  p.created_at
FROM india_purchases p
JOIN india_validation_main_file v ON v.asin = p.asin
WHERE p.sent_to_admin = false 
  AND p.admin_confirmed = false 
  AND p.move_to IS NULL
  AND v.seller_tag != p.seller_tag
ORDER BY p.created_at DESC;