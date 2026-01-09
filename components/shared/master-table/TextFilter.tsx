'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';

interface TextFilterProps {
  values: string[];
  selectedValues?: string[];
  onApply: (values: string[]) => void;
  placeholder?: string;
}

export default function TextFilter({
  values = [],
  selectedValues = [],
  onApply,
  placeholder = 'Search...',
}: TextFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedValues));

  // Update local state when selectedValues prop changes
  useEffect(() => {
    setSelected(new Set(selectedValues));
  }, [selectedValues]);

  // Filter values based on search
  const filteredValues = useMemo(() => {
    if (!searchTerm) return values;
    const term = searchTerm.toLowerCase();
    return values.filter((item) => item.toLowerCase().includes(term));
  }, [values, searchTerm]);

  const handleToggle = (value: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setSelected(newSelected);
  };

  const handleSelectAll = () => {
    if (selected.size === filteredValues.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredValues));
    }
  };

  const handleApply = () => {
    onApply(Array.from(selected));
  };

  const handleClear = () => {
    setSelected(new Set());
    onApply([]);
  };

  const isAllSelected = selected.size === filteredValues.length && filteredValues.length > 0;
  const isSomeSelected = selected.size > 0 && selected.size < filteredValues.length;

  return (
    <div className="flex flex-col h-full">
      {/* Search Box */}
      <div className="p-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Select All */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isSomeSelected;
            }}
            onChange={handleSelectAll}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs font-medium text-gray-700">
            SELECT ALL ({values.length})
          </span>
        </label>
      </div>

      {/* Value List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 max-h-64">
        {filteredValues.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No results found
          </div>
        ) : (
          <div className="space-y-1">
            {filteredValues.map((item) => (
              <label
                key={item}
                className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item)}
                  onChange={() => handleToggle(item)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-700 truncate" title={item}>
                  {item}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-3 border-t border-gray-200 flex gap-2">
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Apply
        </button>
        <button
          onClick={handleClear}
          className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
