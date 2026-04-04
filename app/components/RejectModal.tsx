'use client';

import { useState } from 'react';

interface RejectModalProps {
  isOpen: boolean;
  productName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function RejectModal({
  isOpen,
  productName,
  onClose,
  onConfirm,
}: RejectModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason);
      setReason('');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#111111] bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="bg-[#111111] rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Reject Product
          </h2>

          <p className="text-sm text-gray-500 mb-4">
            Product: <span className="font-semibold">{productName}</span>
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-500 mb-2">
              Reason for Rejection *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason why this product is rejected..."
              rows={4}
              className="w-full px-3 py-2 border border-white/[0.1] rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!reason.trim()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
