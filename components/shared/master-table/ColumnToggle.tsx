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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Toggle Columns</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={!hiddenColumns.includes(column)}
                  onChange={() => onToggleColumn(column)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 capitalize">
                  {column.replace(/_/g, ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t bg-gray-50">
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
