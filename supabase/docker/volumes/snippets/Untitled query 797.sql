SELECT asin, journey_id, journey_number, seller_tag, admin_status, created_at
FROM india_admin_validation
WHERE asin = 'B0007XBNSI'
ORDER BY created_at
LIMIT 5;