'use client';

import { useState } from 'react';

const OPERATORS = [
  { value: 'eq', label: 'Equals', symbol: '=' },
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'gte', label: 'Greater or equal', symbol: '≥' },
  { value: 'lte', label: 'Less or equal', symbol: '≤' },
];

interface NumericFilterProps {
  currentFilter?: { operator: string; value: number } | null;
  onApply: (filterData: { type: string; operator: string; value: number } | null) => void;
  columnName?: string;
}

export default function NumericFilter({
  currentFilter = null,
  onApply,
  columnName = 'Value',
}: NumericFilterProps) {
  const [operator, setOperator] = useState(currentFilter?.operator || 'gt');
  const [value, setValue] = useState(currentFilter?.value?.toString() || '');

  const handleApply = () => {
    if (!value || isNaN(parseFloat(value))) {
      alert('Please enter a valid number');
      return;
    }
    onApply({
      type: 'numeric',
      operator,
      value: parseFloat(value),
    });
  };

  const handleClear = () => {
    setOperator('gt');
    setValue('');
    onApply(null);
  };

  return (
    <div className="flex flex-col p-4 gap-4">
      {/* Operator Selection */}
      <div className="space-y-2">
        {OPERATORS.map((op) => (
          <label
            key={op.value}
            className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer"
          >
            <input
              type="radio"
              name="operator"
              value={op.value}
              checked={operator === op.value}
              onChange={(e) => setOperator(e.target.value)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-700">
              {op.symbol} {op.label}
            </span>
          </label>
        ))}
      </div>

      {/* Value Input */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 uppercase">
          {columnName}
        </label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter value..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2">
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
