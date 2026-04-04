"use client";

import React, { useState } from "react";

interface GeneratedLink {
  id: number;
  sellerName: string;
  merchantToken: string;
  page: number;
  filterType: string;
  sellerProfileLink: string;
  status: "Copied" | "Pending";
}

interface GeneratedLinksTableProps {
  links: GeneratedLink[];
  onUpdateLinks: (updatedLinks: GeneratedLink[]) => void;
}

export default function GeneratedLinksTable({ links, onUpdateLinks }: GeneratedLinksTableProps) {
  const [openActionMenu, setOpenActionMenu] = useState<number | null>(null);

  const handleStatusChange = (id: number, newStatus: "Copied" | "Pending") => {
    const updatedLinks = links.map((link) =>
      link.id === id ? { ...link, status: newStatus } : link
    );
    onUpdateLinks(updatedLinks);
    setOpenActionMenu(null);
  };

  const handleDelete = (id: number) => {
    const updatedLinks = links.filter((link) => link.id !== id);
    onUpdateLinks(updatedLinks);
    setOpenActionMenu(null);
  };

  const handleEdit = (id: number) => {
    console.log("Edit link:", id);
    setOpenActionMenu(null);
    // Add edit functionality later
  };

  return (
    <div className="bg-[#111111] rounded-xl shadow-lg overflow-hidden border border-white/[0.1]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gradient-to-r from-slate-700 to-slate-800 text-white">
            <tr>
              <th className="px-4 py-4 text-center text-sm font-bold border-r border-white/[0.1] w-16">
                <input type="checkbox" className="w-4 h-4 accent-blue-600 cursor-pointer" />
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.1] whitespace-nowrap">
                Seller Name
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.1] whitespace-nowrap">
                Merchant Token
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.1] whitespace-nowrap">
                Page
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.1] whitespace-nowrap">
                Filter Type
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.1] whitespace-nowrap">
                Seller Profile Link
              </th>
              <th className="px-4 py-4 text-left text-sm font-bold border-r border-white/[0.1] whitespace-nowrap">
                Status
              </th>
              <th className="px-4 py-4 text-center text-sm font-bold whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {links.map((link, index) => (
              <tr
                key={link.id}
                className={`border-b border-white/[0.1] hover:bg-blue-50 transition-colors ${
                  index % 2 === 0 ? "bg-[#111111]" : "bg-[#111111]"
                }`}
              >
                <td className="px-6 py-4.5 text-center border-r border-white/[0.1]">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.1] font-medium text-gray-100">
                  {link.sellerName}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.1] text-gray-500 font-mono text-sm">
                  {link.merchantToken}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.1] text-blue-600 font-semibold">
                  {link.page}
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.1]">
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                    {link.filterType}
                  </span>
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.1]">
                  <span className="text-blue-600 text-sm truncate max-w-md block hover:text-blue-800">
                    {link.sellerProfileLink}
                  </span>
                </td>
                <td className="px-6 py-4.5 border-r border-white/[0.1]">
                  {link.status === "Copied" ? (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-600 font-semibold text-sm">Copied</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      <span className="text-gray-400 font-semibold text-sm">Pending</span>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4.5 text-center relative">
                  <button
                    onClick={() => setOpenActionMenu(openActionMenu === link.id ? null : link.id)}
                    className="text-gray-400 hover:text-gray-200 transition-colors p-1 hover:bg-[#1a1a1a] rounded"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>

                  {/* Actions Dropdown Menu */}
                  {openActionMenu === link.id && (
                    <div className="absolute right-0 mt-2 w-52 bg-[#111111] border border-white/[0.1] rounded-lg shadow-xl z-10">
                      {/* Conditional Status Change Button */}
                      {link.status === "Copied" ? (
                        <button
                          onClick={() => handleStatusChange(link.id, "Pending")}
                          className="w-full px-4 py-2.5 text-left text-sm text-orange-600 hover:bg-white/[0.05]/10 flex items-center gap-2 border-b border-gray-100 font-medium"
                        >
                          <span className="text-lg">🔄</span> Mark as Pending
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(link.id, "Copied")}
                          className="w-full px-4 py-2.5 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2 border-b border-gray-100 font-medium"
                        >
                          <span className="text-lg">✓</span> Mark as Copied
                        </button>
                      )}

                      {/* Edit Button */}
                      <button
                        onClick={() => handleEdit(link.id)}
                        className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 border-b border-gray-100 font-medium"
                      >
                        <span className="text-lg">✏️</span> Edit
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDelete(link.id)}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                      >
                        <span className="text-lg">🗑️</span> Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
