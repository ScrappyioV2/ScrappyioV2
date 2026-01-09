export type FilterOperator = '=' | '>' | '<' | '>=' | '<=';

export interface Filter {
  column: string;
  operator: FilterOperator;
  value: string | number;
}

export interface TextFilter {
  column: string;
  values: string[];
}

/**
 * Build Supabase query with filters
 */
export const applyFilters = (query: any, filters: Filter[]): any => {
  let modifiedQuery = query;

  filters.forEach((filter) => {
    const { column, operator, value } = filter;

    switch (operator) {
      case '=':
        modifiedQuery = modifiedQuery.eq(column, value);
        break;
      case '>':
        modifiedQuery = modifiedQuery.gt(column, value);
        break;
      case '<':
        modifiedQuery = modifiedQuery.lt(column, value);
        break;
      case '>=':
        modifiedQuery = modifiedQuery.gte(column, value);
        break;
      case '<=':
        modifiedQuery = modifiedQuery.lte(column, value);
        break;
    }
  });

  return modifiedQuery;
};

/**
 * Apply text filters (for dropdown selections)
 */
export const applyTextFilters = (query: any, filters: TextFilter[]): any => {
  let modifiedQuery = query;

  filters.forEach((filter) => {
    if (filter.values.length > 0) {
      modifiedQuery = modifiedQuery.in(filter.column, filter.values);
    }
  });

  return modifiedQuery;
};

/**
 * Apply global search across all columns
 */
export const applyGlobalSearch = (
  query: any,
  searchTerm: string,
  columns: string[]
): any => {
  if (!searchTerm || searchTerm.trim() === '') return query;

  // Build OR condition for all searchable columns
  const orConditions = columns
    .map((col) => `${col}.ilike.%${searchTerm}%`)
    .join(',');

  return query.or(orConditions);
};
