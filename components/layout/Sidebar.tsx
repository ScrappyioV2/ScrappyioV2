'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { 
  LayoutDashboard, 
  Users, 
  Globe, 
  ShoppingCart, 
  ShoppingBag, 
  LogOut, 
  ChevronDown, 
  ChevronRight, 
  Rocket,
  MapPin
} from 'lucide-react'

// --- Types ---
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
  icon: React.ReactNode
  requiresPage?: string | null
  requiresAdmin?: boolean
  submenu: SubMenuItem[] | null
  adminOnly?: boolean
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { userRole, logout } = useAuth()
  
  // State for menu expansion
  const [expandedMenu, setExpandedMenu] = useState<string | null>('Manage Sellers')
  const [expandedSubMenu, setExpandedSubMenu] = useState<string | null>(null)

  // --- Menu Configurations ---

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

  const listingErrorSellers: NestedMenuItem[] = [
    { label: 'Golden Aura', href: '/dashboard/usa-selling/listing-error/golden-aura', requiresPage: 'usa-selling' },
    { label: 'Rudra Retail', href: '/dashboard/usa-selling/listing-error/rudra-retail', requiresPage: 'usa-selling' },
    { label: 'UBeauty', href: '/dashboard/usa-selling/listing-error/ubeauty', requiresPage: 'usa-selling' },
    { label: 'Velvet Vista', href: '/dashboard/usa-selling/listing-error/velvet-vista', requiresPage: 'usa-selling' },
  ]

  const usaSellingSubmenu: SubMenuItem[] = [
    { label: 'Brand Checking', href: '/dashboard/usa-selling/brand-checking', requiresPage: 'usa-selling', submenu: brandCheckingSellers },
    { label: 'Validation', href: '/dashboard/usa-selling/validation', requiresPage: 'usa-selling/validation' },
    { label: 'Admin Validation', href: '/dashboard/usa-selling/admin-validation', requiresPage: 'usa-selling/admin-validation' },
    { label: 'Listing & Error', href: '/dashboard/usa-selling/listing-error', requiresPage: 'usa-selling', submenu: listingErrorSellers },
    { label: 'Purchase', href: '/dashboard/usa-selling/purchases', requiresPage: 'usa-selling/purchases' },
    { label: 'Reorder', href: '/dashboard/usa-selling/reorder', requiresPage: 'usa-selling/reorder' },
  ]

  const menuItems: MenuItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} />, requiresPage: null, submenu: null, adminOnly: true },
    { label: 'Manage Sellers', href: '/dashboard/manage-sellers', icon: <Users size={18} />, requiresPage: 'manage-sellers', submenu: manageSellerSubmenu },
    { label: 'USA Selling', href: '/dashboard/usa-selling', icon: <MapPin size={18} />, requiresPage: 'usa-selling', submenu: usaSellingSubmenu },
    { label: 'India Selling', href: '/dashboard/india-selling', icon: <Globe size={18} />, requiresPage: 'india-selling', submenu: null },
    { label: 'UAE Selling', href: '/dashboard/uae-selling', icon: <Globe size={18} />, requiresPage: 'uae-selling', submenu: null },
    { label: 'UK Selling', href: '/dashboard/uk-selling', icon: <Globe size={18} />, requiresPage: 'uk-selling', submenu: null },
    { label: 'Flipkart', href: '/dashboard/flipkart', icon: <ShoppingCart size={18} />, requiresPage: 'flipkart', submenu: null },
    { label: 'Jio Mart', href: '/dashboard/jio-mart', icon: <ShoppingBag size={18} />, requiresPage: 'jio-mart', submenu: null },
  ]

  // RBAC Check
  const canAccessMenuItem = (item: MenuItem | SubMenuItem | NestedMenuItem): boolean => {
    if (!userRole) return false
    if (userRole.role === 'admin') return true
    if ('adminOnly' in item && item.adminOnly) return false
    if ('requiresAdmin' in item && item.requiresAdmin) return false
    if (!item.requiresPage) return true
    return userRole.allowed_pages.includes('*') || userRole.allowed_pages.some(page => item.requiresPage?.includes(page))
  }

  const toggleMenu = (label: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedMenu(expandedMenu === label ? null : label)
  }

  const toggleSubMenu = (label: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedSubMenu(expandedSubMenu === label ? null : label)
  }

  const handleMenuClick = (href: string, hasSubmenu: boolean, label: string) => {
    if (href) router.push(href)
    if (hasSubmenu) setExpandedMenu(expandedMenu === label ? null : label)
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href)

  return (
    <aside className="w-64 min-h-screen bg-slate-950 border-r border-slate-800 text-slate-400 flex flex-col">
      
      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="p-2 bg-indigo-600 rounded-lg shadow-md shadow-indigo-900/20">
          <Rocket className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-slate-200">Scrappy v2</h1>
          {userRole && (
            <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider font-semibold">
              {userRole.role}
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {menuItems.map((item) => {
          if (!canAccessMenuItem(item)) return null

          const active = isActive(item.href)
          const expanded = expandedMenu === item.label

          return (
            <div key={item.label} className="mb-1">
              {/* Main Item */}
              <button
                onClick={() => handleMenuClick(item.href, !!item.submenu, item.label)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={active ? 'text-white' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.submenu && (
                  <div onClick={(e) => toggleMenu(item.label, e)} className="p-1 rounded hover:bg-black/20">
                    <ChevronDown size={14} className={expanded ? 'rotate-180' : ''} />
                  </div>
                )}
              </button>

              {/* Submenus */}
              {item.submenu && expanded && (
                <div className="mt-1 ml-4 pl-3 border-l border-slate-800 space-y-1">
                  {item.submenu.map((subItem) => {
                    if (!canAccessMenuItem(subItem)) return null
                    const subActive = pathname === subItem.href || pathname.startsWith(subItem.href)
                    const subExpanded = expandedSubMenu === subItem.label

                    return (
                      <div key={subItem.label}>
                        {subItem.submenu ? (
                          // Nested Trigger
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                router.push(subItem.href)
                                toggleSubMenu(subItem.label, e) // ✅ FIX: Passed event 'e' correctly
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                                subActive ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                              }`}
                            >
                              <span className="truncate">{subItem.label}</span>
                              <ChevronRight size={12} className={subExpanded ? 'rotate-90' : ''} />
                            </button>

                            {/* Nested Level */}
                            {subExpanded && (
                              <div className="mt-1 ml-2 pl-3 border-l border-slate-800 space-y-1">
                                {subItem.submenu.map((nested) => {
                                  if (!canAccessMenuItem(nested)) return null
                                  const nestedActive = pathname === nested.href
                                  return (
                                    <Link
                                      key={nested.label}
                                      href={nested.href}
                                      className={`block px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                                        nestedActive 
                                          ? 'text-indigo-400 bg-indigo-500/10' 
                                          : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                                      }`}
                                    >
                                      {nested.label}
                                    </Link>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          // Standard Sub Item
                          <Link
                            href={subItem.href}
                            className={`block px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                              subActive 
                                ? 'text-indigo-400 bg-indigo-500/10' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                          >
                            {subItem.label}
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

