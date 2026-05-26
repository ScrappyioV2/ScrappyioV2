-- VERIFY: all 4 ASINs should now have 3 rows each with correct per-tag quantities
SELECT asin, seller_tag, status, pending_quantity, tracking_details, journey_id
FROM india_inbound_tracking
WHERE asin IN ('B00112FLEQ', 'B00126E3Z4', 'B001KYNTLC', 'B07GBNTPRY')
AND status = 'delivered'
ORDER BY asin, seller_tag;