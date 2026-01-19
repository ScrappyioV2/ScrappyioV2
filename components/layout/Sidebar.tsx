'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/hooks/useAuth'

type NestedMenuItem = {
  label: string
  href: string
  requiresPage?: string
}

type SubMenuItem = {
  label: string
  href: string
  requiresPage?: string
  submenu?: NestedMenuItem[]
}

type MenuItem = {
  label: string
  href: string
  requiresPage?: string | null
  requiresAdmin?: boolean
  submenu: SubMenuItem[] | null
  adminOnly?: boolean
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { userRole, logout } = useAuth()
  const [expandedMenu, setExpandedMenu] = useState<string | null>('Manage Sellers')
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>(null)

  // Submenu items for Manage Sellers
  const manageSellerSubmenu: SubMenuItem[] = [
    { label: 'Link Generator', href: '/dashboard/manage-sellers/add-seller', requiresPage: 'manage-sellers' },
    { label: 'USA Sellers', href: '/dashboard/manage-sellers/usa-sellers', requiresPage: 'manage-sellers' },
    { label: 'India Sellers', href: '/dashboard/manage-sellers/india-sellers', requiresPage: 'manage-sellers' },
    { label: 'UK Sellers', href: '/dashboard/manage-sellers/uk-sellers', requiresPage: 'manage-sellers' },
    { label: 'UAE Sellers', href: '/dashboard/manage-sellers/uae-sellers', requiresPage: 'manage-sellers' },
  ]

  const brandCheckingSellers: NestedMenuItem[] = [
    { label: 'Golden Aura', href: '/dashboard/usa-selling/brand-checking/golden-aura', requiresPage: 'usa-selling' },
    { label: 'Rudra Retail', href: '/dashboard/usa-selling/brand-checking/rudra-retail', requiresPage: 'usa-selling' },
    { label: 'UBeauty', href: '/dashboard/usa-selling/brand-checking/ubeauty', requiresPage: 'usa-selling' },
    { label: 'Velvet Vista', href: '/dashboard/usa-selling/brand-checking/velvet-vista', requiresPage: 'usa-selling' },
  ]

  const usaSellingSubmenu: SubMenuItem[] = [
    { label: 'Brand Checking', href: '/dashboard/usa-selling/brand-checking', requiresPage: 'usa-selling', submenu: brandCheckingSellers },
    { label: 'Validation', href: '/dashboard/usa-selling/validation', requiresPage: 'usa-selling/validation' },
    { label: 'Admin Validation', href: '/dashboard/usa-selling/admin-validation', requiresPage: 'usa-selling/admin-validation' },
    { label: 'Listing & Error', href: '/dashboard/usa-selling/listing-error', requiresPage: 'usa-selling' },
    { label: 'Purchase', href: '/dashboard/usa-selling/purchases', requiresPage: 'usa-selling/purchases' },
    { label: 'Reorder', href: '/dashboard/usa-selling/reorder', requiresPage: 'usa-selling/reorder' },
  ]

  const menuItems: MenuItem[] = [
    { label: 'Dashboard', href: '/dashboard', requiresPage: null, submenu: null, adminOnly: true },
    { label: 'Manage Sellers', href: '/dashboard/manage-sellers', requiresPage: 'manage-sellers', submenu: manageSellerSubmenu },
    { label: 'Manage Users', href: '/dashboard/manage-users', requiresAdmin: true, submenu: null },
    { label: 'USA Selling', href: '/dashboard/usa-selling', requiresPage: 'usa-selling', submenu: usaSellingSubmenu },
    { label: 'India Selling', href: '/dashboard/india-selling', requiresPage: 'india-selling', submenu: null },
    { label: 'UAE Selling', href: '/dashboard/uae-selling', requiresPage: 'uae-selling', submenu: null },
    { label: 'UK Selling', href: '/dashboard/uk-selling', requiresPage: 'uk-selling', submenu: null },
    { label: 'Flipkart', href: '/dashboard/flipkart', requiresPage: 'flipkart', submenu: null },
    { label: 'Jio Mart', href: '/dashboard/jio-mart', requiresPage: 'jio-mart', submenu: null },
  ]

  // ✅ RBAC: Check if user can access a menu item
  const canAccessMenuItem = (item: MenuItem | SubMenuItem | NestedMenuItem): boolean => {
    if (!userRole) return false

    // Admins can access everything
    if (userRole.role === 'admin') return true

    // ✅ Check adminOnly flag (for Dashboard)
    if ('adminOnly' in item && item.adminOnly) {
      return false // Non-admins cannot access
    }

    // Check requiresAdmin items (for Manage Users)
    if ('requiresAdmin' in item && item.requiresAdmin) {
      return false // Non-admins cannot access
    }

    // Items without requiresPage are accessible to all authenticated users
    if (!item.requiresPage || item.requiresPage === null) return true

    // Check if user has access to this page
    return userRole.allowed_pages.includes('*') ||
      userRole.allowed_pages.some(page => item.requiresPage?.includes(page))
  }

  const toggleMenu = (label: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedMenu(expandedMenu === label ? null : label)
  }

  const toggleSubMenu = (label: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedSubMenu(expandedSubMenu === label ? null : label)
  }

  const handleSubMenuClick = (href: string | null, hasSubmenu: boolean, label: string) => {
    if (href) {
      router.push(href)
    }
    if (hasSubmenu) {
      setExpandedSubMenu(expandedSubMenu === label ? null : label)
    }
  }

  const handleMenuClick = (href: string | null, hasSubmenu: boolean, label: string) => {
    if (href) {
      router.push(href)
    }
    if (hasSubmenu) {
      setExpandedMenu(expandedMenu === label ? null : label)
    }
  }

  return (
    <aside className="w-60 min-h-screen bg-[#1e293b] border-r border-gray-700 text-white flex flex-col">
      {/* Logo/Header */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white">🚀 Scrappy v2</h1>
        {userRole && (
          <p className="text-xs text-gray-400 mt-1">{userRole.role.toUpperCase()}</p>
        )}
      </div>

      {/* Scrollable Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
        <div className="p-4 space-y-1">
          {menuItems.map((item) => {
            // ✅ RBAC: Hide menu if user doesn't have access
            if (!canAccessMenuItem(item)) return null

            return (
              <div key={item.label}>
                {/* Main Menu Item */}
                {item.submenu ? (
                  <div
                    className={`flex items-center justify-between rounded-lg cursor-pointer transition-all duration-200 ${pathname === item.href || pathname.startsWith(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
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
                    <button onClick={(e) => toggleMenu(item.label, e)} className="px-3 py-2.5">
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${expandedMenu === item.label ? 'rotate-180' : ''
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
                    href={item.href}
                    className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${pathname === item.href
                      ? 'bg-green-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
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
                        {item.submenu.map((subItem) => {
                          // ✅ RBAC: Hide submenu if user doesn't have access
                          if (!canAccessMenuItem(subItem)) return null

                          return (
                            <div key={subItem.label}>
                              {subItem.submenu ? (
                                /* Item with nested submenu (Brand Checking) */
                                <div>
                                  <div
                                    className={`flex items-center justify-between rounded-md text-sm transition-all duration-200 ${pathname === subItem.href || pathname.startsWith(subItem.href)
                                      ? 'bg-blue-500 text-white font-medium'
                                      : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                      }`}
                                  >
                                    <button
                                      onClick={() => handleSubMenuClick(subItem.href, true, subItem.label)}
                                      className="flex-1 text-left px-3 py-2"
                                    >
                                      {subItem.label}
                                    </button>
                                    <button onClick={(e) => toggleSubMenu(subItem.label, e)} className="px-2 py-2">
                                      <svg
                                        className={`w-3 h-3 transition-transform duration-200 ${expandedSubMenu === subItem.label ? 'rotate-180' : ''
                                          }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </button>
                                  </div>

                                  {subItem.submenu && expandedSubMenu === subItem.label && (
                                    <div className="mt-1 ml-2 border-l-2 border-gray-500 pl-2">
                                      <div className="space-y-0.5 py-1">
                                        {subItem.submenu.map((nestedItem) => {
                                          // ✅ RBAC: Hide nested item if user doesn't have access
                                          if (!canAccessMenuItem(nestedItem)) return null

                                          return (
                                            <Link
                                              key={nestedItem.label}
                                              href={nestedItem.href}
                                              onClick={(e) => e.stopPropagation()}
                                              className={`block px-3 py-1.5 rounded-md text-xs transition-all duration-200 ${pathname === nestedItem.href
                                                ? 'bg-green-500 text-white font-medium'
                                                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                                }`}
                                            >
                                              {nestedItem.label}
                                            </Link>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                /* Regular item without nested submenu */
                                <Link
                                  href={subItem.href}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`block px-3 py-2 rounded-md text-sm transition-all duration-200 ${pathname === subItem.href
                                    ? 'bg-blue-500 text-white font-medium'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                    }`}
                                >
                                  {subItem.label}
                                </Link>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* Logout Button */}
      <div className="mt-auto p-4 border-t border-gray-700">
        <button
          onClick={logout}
          className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center gap-2 font-semibold"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  )
}
