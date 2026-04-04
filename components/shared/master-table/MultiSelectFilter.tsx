'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';

interface MultiSelectFilterProps {
  values: { value: string; count: number }[];
  selectedValues: string[];
  onApply: (selectedValues: string[]) => void;
  placeholder?: string;
  loading?: boolean;
}

export default function MultiSelectFilter({
  values,
  selectedValues,
  onApply,
  placeholder = 'Search...',
  loading = false,
}: MultiSelectFilterProps) {
  const [search, setSearch] = useState('');
  const [localSelected, setLocalSelected] = useState<string[]>(selectedValues);

  // Update local state when selectedValues prop changes
  useEffect(() => {
    setLocalSelected(selectedValues);
  }, [selectedValues]);

  const filteredValues = useMemo(() => {
    if (!search) return values;
    const searchLower = search.toLowerCase();
    return values.filter((item) =>
      item.value.toLowerCase().includes(searchLower)
    );
  }, [values, search]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setLocalSelected(filteredValues.map((item) => item.value));
    } else {
      setLocalSelected([]);
    }
  };

  const handleToggle = (value: string) => {
    setLocalSelected((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleApply = () => {
    onApply(localSelected);
  };

  const handleClear = () => {
    setLocalSelected([]);
    onApply([]);
  };

  const isAllSelected = localSelected.length === filteredValues.length && filteredValues.length > 0;
  const isSomeSelected = localSelected.length > 0 && localSelected.length < filteredValues.length;

  if (loading) {
    return (
      <div className="p-4 text-center text-sm text-gray-300">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-white/[0.1]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 text-sm border border-white/[0.1] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Select All */}
      <div className="px-4 py-3 border-b border-white/[0.1] bg-[#111111]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isAllSelected}
            ref={(input) => {
              if (input) input.indeterminate = isSomeSelected;
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="w-4 h-4 rounded border-white/[0.1] text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs font-medium text-gray-500">
            SELECT ALL ({values.length})
          </span>
        </label>
      </div>

      {/* Options List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 max-h-64">
        {filteredValues.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-300">
            NO RESULTS FOUND
          </div>
        ) : (
          <div className="space-y-1">
            {filteredValues.map((item) => (
              <label
                key={item.value}
                className="flex items-center gap-2 py-1.5 px-2 hover:bg-[#111111] rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={localSelected.includes(item.value)}
                  onChange={() => handleToggle(item.value)}
                  className="w-4 h-4 rounded border-white/[0.1] text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-xs text-gray-300 flex-1 truncate" title={item.value}>
                  {item.value}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  ({item.count.toLocaleString()})
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-white/[0.1] flex gap-2">
        <button
          onClick={handleApply}
          className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
        >
          Apply
        </button>
        <button
          onClick={handleClear}
          className="flex-1 px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 text-sm font-medium rounded-lg hover:bg-[#111111] transition"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
