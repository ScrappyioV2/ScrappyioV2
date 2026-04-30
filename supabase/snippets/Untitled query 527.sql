-- Get counts of database objects
SELECT 
    'Tables' as object_type, 
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Functions', 
    COUNT(*)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
UNION ALL
SELECT 
    'Triggers', 
    COUNT(*)
FROM information_schema.triggers
WHERE event_object_schema = 'public';
