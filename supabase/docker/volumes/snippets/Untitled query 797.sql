SELECT id, seller_tag, status, sent_to_admin, admin_confirmed, journey_number, created_at
FROM india_purchases 
WHERE asin = 'B003XRV65K' 
ORDER BY created_at;