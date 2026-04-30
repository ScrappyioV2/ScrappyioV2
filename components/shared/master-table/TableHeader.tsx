'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

interface TableHeaderProps {
  onSearch: (searchTerm: string) => void;
  onColumnToggle: () => void;
  onUpload: () => void;
  onExport: () => void;
}

export default function TableHeader({
  onSearch,
  onColumnToggle,
  onUpload,
  onExport,
}: TableHeaderProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  return (
    <div className="w-full bg-[#111111] border-b px-6 py-4 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        {/* LEFT SIDE - Search */}
        <div className="flex-1 max-w-md">
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
    <input
  type="search"
  placeholder="Search all columns..."
  value={searchTerm}
  onChange={handleSearchChange}
  className="w-full pl-10 pr-4 py-2 border border-white/[0.1] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:!text-black placeholder:opacity-100 placeholder:font-medium"
/>

  </div>
</div>



        {/* RIGHT SIDE - Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onColumnToggle}
            className="px-4 py-2 bg-[#111111] border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#111111] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Columns
          </button>

          <button
            onClick={onUpload}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload
          </button>

          <button
            onClick={onExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
