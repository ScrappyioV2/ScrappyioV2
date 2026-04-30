'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface UploadedInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoiceUrl: string;
  invoiceName: string;
}

export default function UploadedInvoiceModal({
  open,
  onClose,
  invoiceUrl,
  invoiceName,
}: UploadedInvoiceModalProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
      if (isResizing) {
        const newWidth = e.clientX - position.x;
        const newHeight = e.clientY - position.y;
        setSize({
          width: Math.max(400, newWidth),
          height: Math.max(300, newHeight),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, position]);

  if (!open) return null;

  const handleMouseDownDrag = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] z-50 flex items-center justify-center">
      <div
        ref={modalRef}
        className="bg-[#111111] rounded-lg shadow-2xl overflow-hidden"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        {/* Draggable Header */}
        <div
          className="bg-gray-800 text-white px-4 py-3 flex items-center justify-between cursor-move"
          onMouseDown={handleMouseDownDrag}
        >
          <h3 className="font-semibold">{invoiceName}</h3>
          <button
            onClick={onClose}
            className="hover:bg-gray-700 rounded p-1 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="w-full h-[calc(100%-48px)] overflow-auto">
          {invoiceUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
            <img
              src={invoiceUrl}
              alt="Uploaded Invoice"
              className="w-full h-full object-contain"
            />
          ) : (
            <iframe
              src={invoiceUrl}
              className="w-full h-full border-0"
              title="Uploaded Invoice"
            />
          )}
        </div>

        {/* Resize Handle */}
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-gray-400 hover:bg-gray-600"
          onMouseDown={handleMouseDownResize}
          style={{
            clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
          }}
        />
      </div>
    </div>
  );
}
//UploadedInvoiceModal.tsx
