-- Check if india_purchases has order_id for these ASINs
SELECT p.asin, p.seller_tag, p.order_id, p.journey_id
FROM india_purchases p
WHERE p.journey_id IN (
  SELECT DISTINCT journey_id FROM india_inbound_tracking
  WHERE asin IN (
    SELECT DISTINCT asin FROM india_box_history 
    WHERE action = 'deleted' AND box_number = 'BB1'
  )
  AND status = 'delivered'
  AND (order_id IS NULL OR order_id = '')
  AND journey_id IS NOT NULL
)
AND p.order_id IS NOT NULL AND p.order_id != ''
ORDER BY p.asin, p.seller_tag;