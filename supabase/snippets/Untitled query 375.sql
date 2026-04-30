-- Delete from funnel tables (all 6 sellers × 3 funnels = 18 tables)
DELETE FROM flipkart_seller_1_high_demand WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_1_dropshipping WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_1_low_demand WHERE asin LIKE 'B0BLK%';

DELETE FROM flipkart_seller_2_high_demand WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_2_dropshipping WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_2_low_demand WHERE asin LIKE 'B0BLK%';

DELETE FROM flipkart_seller_3_high_demand WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_3_dropshipping WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_3_low_demand WHERE asin LIKE 'B0BLK%';

DELETE FROM flipkart_seller_4_high_demand WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_4_dropshipping WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_4_low_demand WHERE asin LIKE 'B0BLK%';

DELETE FROM flipkart_seller_5_high_demand WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_5_dropshipping WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_5_low_demand WHERE asin LIKE 'B0BLK%';

DELETE FROM flipkart_seller_6_high_demand WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_6_dropshipping WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_seller_6_low_demand WHERE asin LIKE 'B0BLK%';

-- Delete from brand checking tables (6 sellers)
DELETE FROM flipkart_brand_checking_seller_1 WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_brand_checking_seller_2 WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_brand_checking_seller_3 WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_brand_checking_seller_4 WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_brand_checking_seller_5 WHERE asin LIKE 'B0BLK%';
DELETE FROM flipkart_brand_checking_seller_6 WHERE asin LIKE 'B0BLK%';

-- Delete from master table (last, since brand checking has foreign key)
DELETE FROM flipkart_master_sellers WHERE asin LIKE 'B0BLK%';
