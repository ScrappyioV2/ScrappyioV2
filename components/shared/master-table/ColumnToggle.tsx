'use client';

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ColumnToggleProps {
  isOpen: boolean;
  onClose: () => void;
  columns: string[];
  hiddenColumns: string[];
  onToggleColumn: (column: string) => void;
}

export default function ColumnToggle({
  isOpen,
  onClose,
  columns,
  hiddenColumns,
  onToggleColumn,
}: ColumnToggleProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#111111] bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#111111] rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-white">Toggle Columns</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Column List */}
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {columns.map((column) => (
              <label
                key={column}
                className="flex items-center gap-3 p-2 hover:bg-[#111111] rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!hiddenColumns.includes(column)}
                  onChange={() => onToggleColumn(column)}
                  className="w-4 h-4 text-blue-600 border-white/[0.1] rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-300 capitalize">
                  {column.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-[#111111]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
