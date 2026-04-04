'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface FilterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function FilterDropdown({
  isOpen,
  onClose,
  title,
  children,
}: FilterDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<'left' | 'right'>('right');

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Check if dropdown would overflow on the right
      if (rect.right > viewportWidth - 20) {
        setPosition('left');
      } else if (rect.left < 20) {
        setPosition('right');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      ref={dropdownRef}
      className={`absolute top-full mt-2 w-80 bg-[#1a1a1a] rounded-lg shadow-xl border border-white/[0.1] z-50 max-h-96 overflow-hidden flex flex-col ${
        position === 'left' ? 'right-0' : 'left-0'
      }`}
      style={{
        // Ensure dropdown is always visible
        maxWidth: 'calc(100vw - 40px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.1] bg-[#111111]">
        <h3 className="font-semibold text-sm text-white">{title}</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-500 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  );
}
