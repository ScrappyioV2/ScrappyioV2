SELECT id, asin, seller_tag, buying_quantity, admin_status, journey_number, created_at 
FROM india_admin_validation 
WHERE asin = 'B00B4YY1GU' 
ORDER BY created_at;