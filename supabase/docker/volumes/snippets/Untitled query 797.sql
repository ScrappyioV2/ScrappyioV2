SELECT 'validation.india_link' AS col, count(*) FROM india_validation_main_file WHERE india_link LIKE '%amazon.com%'
UNION ALL SELECT 'purchases.product_link', count(*) FROM india_purchases WHERE product_link LIKE '%amazon.com%'
UNION ALL SELECT 'purchase_copies.india_link', count(*) FROM india_purchase_copies WHERE india_link LIKE '%amazon.com%'
UNION ALL SELECT 'admin_validation.product_link', count(*) FROM india_admin_validation WHERE product_link LIKE '%amazon.com%';