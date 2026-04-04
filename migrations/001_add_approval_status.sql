-- ============================================================
-- Migration: Add approval_status to brand checking tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Add approval_status column to all 6 tables
ALTER TABLE india_brand_checking_seller_1 ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE india_brand_checking_seller_2 ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE india_brand_checking_seller_3 ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE india_brand_checking_seller_4 ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE india_brand_checking_seller_5 ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE india_brand_checking_seller_6 ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';

-- 2. Add indexes on approval_status
CREATE INDEX IF NOT EXISTS idx_brand_checking_seller_1_approval ON india_brand_checking_seller_1 (approval_status);
CREATE INDEX IF NOT EXISTS idx_brand_checking_seller_2_approval ON india_brand_checking_seller_2 (approval_status);
CREATE INDEX IF NOT EXISTS idx_brand_checking_seller_3_approval ON india_brand_checking_seller_3 (approval_status);
CREATE INDEX IF NOT EXISTS idx_brand_checking_seller_4_approval ON india_brand_checking_seller_4 (approval_status);
CREATE INDEX IF NOT EXISTS idx_brand_checking_seller_5_approval ON india_brand_checking_seller_5 (approval_status);
CREATE INDEX IF NOT EXISTS idx_brand_checking_seller_6_approval ON india_brand_checking_seller_6 (approval_status);

-- 3. Replace india_recalc_brand_check_progress function (FIX: was setting approved_cnt = total_cnt)
CREATE OR REPLACE FUNCTION india_recalc_brand_check_progress(p_seller_id integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  total_cnt integer;
  approved_cnt integer;
  not_approved_cnt integer;
BEGIN
  EXECUTE format('SELECT COUNT(*) FROM india_brand_checking_seller_%s', p_seller_id) INTO total_cnt;
  EXECUTE format('SELECT COUNT(*) FROM india_brand_checking_seller_%s WHERE approval_status = ''approved''', p_seller_id) INTO approved_cnt;
  EXECUTE format('SELECT COUNT(*) FROM india_brand_checking_seller_%s WHERE approval_status = ''not_approved''', p_seller_id) INTO not_approved_cnt;

  INSERT INTO india_brand_check_progress (seller_id, total_products, approved_products, not_approved_products, updated_at)
  VALUES (p_seller_id, total_cnt, approved_cnt, not_approved_cnt, NOW())
  ON CONFLICT (seller_id) DO UPDATE SET
    total_products = EXCLUDED.total_products,
    approved_products = EXCLUDED.approved_products,
    not_approved_products = EXCLUDED.not_approved_products,
    updated_at = NOW();
END;
$$;

-- 4. Replace refresh_india_brand_check_progress
CREATE OR REPLACE FUNCTION refresh_india_brand_check_progress()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  FOR i IN 1..6 LOOP
    PERFORM india_recalc_brand_check_progress(i);
  END LOOP;
END;
$$;

-- 5. Replace all 6 refresh_india_progress_seller_N functions
CREATE OR REPLACE FUNCTION refresh_india_progress_seller_1() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM india_recalc_brand_check_progress(1); END; $$;
CREATE OR REPLACE FUNCTION refresh_india_progress_seller_2() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM india_recalc_brand_check_progress(2); END; $$;
CREATE OR REPLACE FUNCTION refresh_india_progress_seller_3() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM india_recalc_brand_check_progress(3); END; $$;
CREATE OR REPLACE FUNCTION refresh_india_progress_seller_4() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM india_recalc_brand_check_progress(4); END; $$;
CREATE OR REPLACE FUNCTION refresh_india_progress_seller_5() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM india_recalc_brand_check_progress(5); END; $$;
CREATE OR REPLACE FUNCTION refresh_india_progress_seller_6() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM india_recalc_brand_check_progress(6); END; $$;

-- 6. Backfill existing data — mark approved
UPDATE india_brand_checking_seller_1 SET approval_status = 'approved' WHERE asin IN (SELECT asin FROM india_validation_main_file WHERE seller_tag LIKE '%GR%');
UPDATE india_brand_checking_seller_2 SET approval_status = 'approved' WHERE asin IN (SELECT asin FROM india_validation_main_file WHERE seller_tag LIKE '%RR%');
UPDATE india_brand_checking_seller_3 SET approval_status = 'approved' WHERE asin IN (SELECT asin FROM india_validation_main_file WHERE seller_tag LIKE '%UB%');
UPDATE india_brand_checking_seller_4 SET approval_status = 'approved' WHERE asin IN (SELECT asin FROM india_validation_main_file WHERE seller_tag LIKE '%VV%');
UPDATE india_brand_checking_seller_5 SET approval_status = 'approved' WHERE asin IN (SELECT asin FROM india_validation_main_file WHERE seller_tag LIKE '%DE%');
UPDATE india_brand_checking_seller_6 SET approval_status = 'approved' WHERE asin IN (SELECT asin FROM india_validation_main_file WHERE seller_tag LIKE '%CV%');

-- Backfill existing data — mark not_approved
UPDATE india_brand_checking_seller_1 SET approval_status = 'not_approved' WHERE asin IN (SELECT asin FROM india_seller_1_not_approved);
UPDATE india_brand_checking_seller_2 SET approval_status = 'not_approved' WHERE asin IN (SELECT asin FROM india_seller_2_not_approved);
UPDATE india_brand_checking_seller_3 SET approval_status = 'not_approved' WHERE asin IN (SELECT asin FROM india_seller_3_not_approved);
UPDATE india_brand_checking_seller_4 SET approval_status = 'not_approved' WHERE asin IN (SELECT asin FROM india_seller_4_not_approved);
UPDATE india_brand_checking_seller_5 SET approval_status = 'not_approved' WHERE asin IN (SELECT asin FROM india_seller_5_not_approved);
UPDATE india_brand_checking_seller_6 SET approval_status = 'not_approved' WHERE asin IN (SELECT asin FROM india_seller_6_not_approved);

-- 7. Refresh progress with corrected counts
SELECT refresh_india_brand_check_progress();
