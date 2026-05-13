-- Purchase copies
UPDATE india_purchase_copies 
SET buying_quantity = 2, buying_quantities = '{"VV": 2}' 
WHERE id = 1002;

-- Admin validation
UPDATE india_admin_validation 
SET buying_quantity = 2 
WHERE id = '636f3a38-9092-4e74-b536-d87ff4679e79';