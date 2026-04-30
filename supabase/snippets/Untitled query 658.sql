-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.bulk_insert_india_master_with_distribution(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.bulk_insert_india_master_with_distribution(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_insert_india_master_with_distribution(jsonb) TO service_role;
