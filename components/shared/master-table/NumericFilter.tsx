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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [operator, setOperator] = useState(currentFilter?.operator || 'gt');
  const [value, setValue] = useState(currentFilter?.value?.toString() || '');

  const handleApply = () => {
    if (!value || isNaN(parseFloat(value))) {
      setToast({ message: 'Please enter a valid number', type: 'error' });
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
            className="flex items-center gap-2 py-1.5 px-2 hover:bg-[#111111] rounded cursor-pointer"
          >
            <input
              type="radio"
              name="operator"
              value={op.value}
              checked={operator === op.value}
              onChange={(e) => setOperator(e.target.value)}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-300">
              {op.symbol} {op.label}
            </span>
          </label>
        ))}
      </div>

      {/* Value Input */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-500 uppercase">
          {columnName}
        </label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter value..."
          className="w-full px-3 py-2 text-sm border border-white/[0.06] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          className="flex-1 px-4 py-2 bg-[#111111] border border-white/[0.06] text-gray-500 text-sm font-medium rounded-lg hover:bg-[#111111] transition"
        >
          Clear
        </button>
      </div>
      {toast && (
        <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[100] animate-slide-in">
          <div className={`px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-3 max-w-[calc(100vw-2rem)] sm:max-w-[600px] border ${toast.type === 'success' ? 'bg-green-600 text-white border-green-500' : 'bg-red-600 text-white border-red-500'}`}>
            <span className="text-2xl">{toast.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-semibold flex-1 text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-white/70 hover:text-white ml-2">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
