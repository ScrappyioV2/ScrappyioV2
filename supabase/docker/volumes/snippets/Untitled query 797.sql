SELECT COUNT(*), marketplace FROM brand_checking
WHERE created_at >= '2026-05-01 06:47:00'
GROUP BY marketplace;