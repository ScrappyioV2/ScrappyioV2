-- Check the duplicates
SELECT id, asin, seller_tag, buying_quantity, admin_status, created_at 
FROM india_admin_validation 
WHERE asin = 'B00NJXXE3K';