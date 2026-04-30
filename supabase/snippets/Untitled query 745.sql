-- Check triggers on flipkart_brand_checking_seller_2
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_table = 'flipkart_brand_checking_seller_2';
