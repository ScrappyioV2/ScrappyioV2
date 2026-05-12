CREATE UNIQUE INDEX idx_to_restock_no_dup 
ON tracking_ops (asin, seller_tag, marketplace, journey_id) 
WHERE ops_type = 'restock' AND status = 'pending';