'use client';

import { X } from 'lucide-react';

interface ActiveFiltersProps {
  filters: Record<string, any>;
  onRemoveFilter: (columnKey: string) => void;
  onClearAll: () => void;
  columnConfig: Record<string, string>;
}

export default function ActiveFilters({
  filters,
  onRemoveFilter,
  onClearAll,
  columnConfig,
}: ActiveFiltersProps) {
  const activeFilters = Object.entries(filters).filter(([_, filterData]) => {
    if (!filterData) return false;
    
    // Check if filter has values
    if (filterData.type === 'text' || filterData.type === 'multiselect') {
      return filterData.values && filterData.values.length > 0;
    }
    
    // Check if numeric filter has value
    if (filterData.type === 'numeric') {
      return filterData.value !== null && filterData.value !== undefined;
    }
    
    return false;
  });

  if (activeFilters.length === 0) return null;

  const getFilterLabel = (columnKey: string, filterData: any): string => {
    const columnName = columnConfig[columnKey] || columnKey;

    if (filterData.type === 'numeric') {
      const operatorLabels: Record<string, string> = {
        eq: '=',
        gt: '>',
        lt: '<',
        gte: '≥',
        lte: '≤',
      };
      const symbol = operatorLabels[filterData.operator] || filterData.operator;
      return `${columnName} ${symbol} ${filterData.value}`;
    }

    if (filterData.type === 'text' || filterData.type === 'multiselect') {
      const count = filterData.values.length;
      if (count === 1) {
        return `${columnName}: ${filterData.values[0]}`;
      }
      return `${columnName}: ${count} selected`;
    }

    return columnName;
  };

  return (
    <div className="mb-4 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1 text-sm text-gray-300">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        <span className="font-medium">Filters: {activeFilters.length}</span>
      </div>

      {activeFilters.map(([columnKey, filterData]) => (
        <div
          key={columnKey}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm text-blue-700"
        >
          <span>{getFilterLabel(columnKey, filterData)}</span>
          <button
            onClick={() => onRemoveFilter(columnKey)}
            className="hover:bg-blue-100 rounded-full p-0.5 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={onClearAll}
        className="px-3 py-1.5 text-sm text-gray-300 hover:text-gray-100 hover:bg-[#1a1a1a] rounded-lg transition"
      >
        Clear All
      </button>
    </div>
  );
}
