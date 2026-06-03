SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'india_purchases' AND column_name = 'journey_id';