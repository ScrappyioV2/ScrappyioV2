-- Trigger function: auto-sync buying_quantities JSON for single-tag products
CREATE OR REPLACE FUNCTION sync_buying_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Only sync if buying_quantity changed and it's a single-tag product
  IF NEW.buying_quantity IS DISTINCT FROM OLD.buying_quantity
     AND NEW.seller_tag IS NOT NULL 
     AND NEW.seller_tag != '' THEN
    
    -- Check if buying_quantities is empty, null, or single-tag
    IF NEW.buying_quantities IS NULL 
       OR NEW.buying_quantities = '{}'::jsonb
       OR (jsonb_typeof(NEW.buying_quantities) = 'object' 
           AND (SELECT count(*) FROM jsonb_object_keys(NEW.buying_quantities)) <= 1) THEN
      
      NEW.buying_quantities := jsonb_build_object(NEW.seller_tag, NEW.buying_quantity);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all 3 tables
DROP TRIGGER IF EXISTS trg_sync_buying_quantities ON india_admin_validation;
CREATE TRIGGER trg_sync_buying_quantities
  BEFORE UPDATE OF buying_quantity ON india_admin_validation
  FOR EACH ROW EXECUTE FUNCTION sync_buying_quantities();

DROP TRIGGER IF EXISTS trg_sync_buying_quantities ON india_purchases;
CREATE TRIGGER trg_sync_buying_quantities
  BEFORE UPDATE OF buying_quantity ON india_purchases
  FOR EACH ROW EXECUTE FUNCTION sync_buying_quantities();

DROP TRIGGER IF EXISTS trg_sync_buying_quantities ON india_inbound_tracking;
CREATE TRIGGER trg_sync_buying_quantities
  BEFORE UPDATE OF buying_quantity ON india_inbound_tracking
  FOR EACH ROW EXECUTE FUNCTION sync_buying_quantities();