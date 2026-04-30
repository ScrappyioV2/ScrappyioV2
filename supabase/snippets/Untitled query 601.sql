-- List all triggers with details (local)
SELECT 
    event_object_table as table_name,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement as trigger_function,
    action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;
