"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type NestedMenuItem = {
  label: string;
  href: string;
};

type SubMenuItem = {
  label: string;
  href: string;
  submenu?: NestedMenuItem[];
};

type MenuItem = {
  label: string;
  href: string;
  submenu: SubMenuItem[] | null;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedMenu, setExpandedMenu] = useState<string | null>("Manage Sellers");
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>(null);


  // 👇 Submenu items for "Manage Sellers"
const manageSellerSubmenu: SubMenuItem[] = [
  { label: "Link Generator", href: "/dashboard/manage-sellers/add-seller" },
  { label: "USA Sellers", href: "/dashboard/manage-sellers/usa-sellers" },
  { label: "India Sellers", href: "/dashboard/manage-sellers/india-sellers" },
  { label: "UK Sellers", href: "/dashboard/manage-sellers/uk-sellers" },
  { label: "UAE Sellers", href: "/dashboard/manage-sellers/uae-sellers" },
];

const brandCheckingSellers: NestedMenuItem[] = [
  { label: "Seller 1", href: "/dashboard/usa-selling/brand-checking/seller-1" },
  { label: "Seller 2", href: "/dashboard/usa-selling/brand-checking/seller-2" },
  { label: "Seller 3", href: "/dashboard/usa-selling/brand-checking/seller-3" },
  { label: "Seller 4", href: "/dashboard/usa-selling/brand-checking/seller-4" },
  { label: "Seller 5", href: "/dashboard/usa-selling/brand-checking/seller-5" },
];

const usaSellingSubmenu: SubMenuItem[] = [
  { label: "Brand Checking", href: "/dashboard/usa-selling/brand-checking", submenu: brandCheckingSellers },
  { label: "Validation", href: "/dashboard/usa-selling#validation" },
  { label: "Admin Validation", href: "/dashboard/usa-selling#admin-validation" },
  { label: "Listing & Error", href: "/dashboard/usa-selling#listing-error" },
  { label: "Purchase", href: "/dashboard/usa-selling#purchases" },
  { label: "Reorder", href: "/dashboard/usa-selling#reorder" },
];

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/dashboard", submenu: null },
  { label: "Manage Sellers", href: "/dashboard/manage-sellers", submenu: manageSellerSubmenu },
  { label: "USA Selling", href: "/dashboard/usa-selling", submenu: usaSellingSubmenu },
  { label: "India Selling", href: "/dashboard/india-selling", submenu: null },
  { label: "UAE Selling", href: "/dashboard/uae-selling", submenu: null },
  { label: "UK Selling", href: "/dashboard/uk-selling", submenu: null },
  { label: "Flipkart", href: "/dashboard/flipkart", submenu: null },
  { label: "Jio Mart", href: "/dashboard/jio-mart", submenu: null },
];


  const toggleMenu = (label: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking arrow
    setExpandedMenu(expandedMenu === label ? null : label);
  };

  const toggleSubMenu = (label: string, e: React.MouseEvent) => {
  e.stopPropagation();
  setExpandedSubMenu(expandedSubMenu === label ? null : label);
};

const handleSubMenuClick = (href: string | null, hasSubmenu: boolean, label: string) => {
  if (href) {
    router.push(href);
  }
  if (hasSubmenu) {
    setExpandedSubMenu(expandedSubMenu === label ? null : label);
  }
};

  const handleMenuClick = (href: string | null, hasSubmenu: boolean, label: string) => {
    if (href) {
      router.push(href);
    }
    if (hasSubmenu) {
      setExpandedMenu(expandedMenu === label ? null : label);
    }
  };

  return (
    <aside className="w-60 min-h-screen bg-[#1e293b] border-r border-gray-700 text-white flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white">Scrappy v2</h1>
      </div>

      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <div className="p-4 space-y-1">
          {menuItems.map((item) => (
            <div key={item.label}>
              {/* Main Menu Item */}
              {item.submenu ? (
                <div
                  className={`flex items-center justify-between rounded-lg cursor-pointer transition-all duration-200 ${
                    pathname === item.href || pathname.startsWith(item.href + "/")
                      ? "bg-blue-600 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {/* Clickable area for navigation */}
                  <button
                    onClick={() => handleMenuClick(item.href, true, item.label)}
                    className="flex-1 text-left px-4 py-2.5 text-sm font-medium"
                  >
                    {item.label}
                  </button>
                  
                  {/* Arrow button - only toggles dropdown */}
                  <button
                    onClick={(e) => toggleMenu(item.label, e)}
                    className="px-3 py-2.5"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${
                        expandedMenu === item.label ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <Link
                  href={item.href || "#"}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    pathname === item.href
                      ? "bg-green-600 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              )}

              {/* Submenu - Scrollable */}
              {item.submenu && expandedMenu === item.label && (
                <div className="mt-1 ml-3 border-l-2 border-gray-600 pl-2">
                  <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent pr-2">
                    <div className="space-y-0.5 py-1">
                      {item.submenu.map((subItem) => (
                        <div key={subItem.label}>
                          {subItem.submenu ? (
                            // Item with nested submenu (Brand Checking)
                            <div>
                              <div className={`flex items-center justify-between rounded-md text-sm transition-all duration-200 ${pathname === subItem.href || pathname.startsWith(subItem.href + "/")
                                  ? "bg-blue-500 text-white font-medium"
                                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
                                }`}>
                                <button
                                  onClick={() => handleSubMenuClick(subItem.href, true, subItem.label)}
                                  className="flex-1 text-left px-3 py-2"
                                >
                                  {subItem.label}
                                </button>
                                <button onClick={(e) => toggleSubMenu(subItem.label, e)} className="px-2 py-2">
                                  <svg className={`w-3 h-3 transition-transform duration-200 ${expandedSubMenu === subItem.label ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>
                              {subItem.submenu && expandedSubMenu === subItem.label && (
                                <div className="mt-1 ml-2 border-l-2 border-gray-500 pl-2">
                                  <div className="space-y-0.5 py-1">
                                    {subItem.submenu.map((nestedItem) => (
                                      <Link
                                        key={nestedItem.label}
                                        href={nestedItem.href}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`block px-3 py-1.5 rounded-md text-xs transition-all duration-200 ${pathname === nestedItem.href
                                            ? "bg-green-500 text-white font-medium"
                                            : "text-gray-400 hover:bg-gray-700 hover:text-white"
                                          }`}
                                      >
                                        {nestedItem.label}
                                      </Link>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            // Regular item without nested submenu
                            <Link
                              href={subItem.href}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className={`block px-3 py-2 rounded-md text-sm transition-all duration-200 ${pathname === subItem.href
                                  ? "bg-blue-500 text-white font-medium"
                                  : "text-gray-400 hover:bg-gray-700 hover:text-white"
                                }`}
                            >
                              {subItem.label}
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          ))}
        </div>
      </nav>

      {/* Footer (Optional) */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-400 text-center">
          © 2026 Scrappy v2
        </div>
      </div>
    </aside>
  );
}