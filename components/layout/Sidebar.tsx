'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { APP_ROUTES } from '@/lib/config/routes'
import { AppRoute } from '@/lib/types'
import {
  LogOut,
  ChevronDown,
  Rocket,
  ShieldCheck,
  Circle,
  Loader2
} from 'lucide-react'

// ✅ CRITICAL: This must be "export default"
export default function Sidebar() {
  const { userRole, logout, hasPageAccess, loading } = useAuth()
  const pathname = usePathname()

  // ✅ UPDATED: Initialize with function to detect active menu
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    // Find which module the current path belongs to
    const activeModule = [
      '/dashboard/manage-sellers',
      '/dashboard/usa-selling',
      '/dashboard/india-selling',
      '/dashboard/uk-selling',
      '/dashboard/uae-selling',
      '/dashboard/flipkart'
    ].find(module => pathname.startsWith(module))

    // Only open the active module
    return {
      '/dashboard/manage-sellers': activeModule === '/dashboard/manage-sellers',
      '/dashboard/usa-selling': activeModule === '/dashboard/usa-selling',
      '/dashboard/india-selling': activeModule === '/dashboard/india-selling',
      '/dashboard/uk-selling': activeModule === '/dashboard/uk-selling',
      '/dashboard/uae-selling': activeModule === '/dashboard/uae-selling',
      '/dashboard/flipkart': activeModule === '/dashboard/flipkart',
    }
  })

  // ✅ NEW: Update open menus when pathname changes (e.g., user navigates)
  useEffect(() => {
    const activeModule = [
      '/dashboard/manage-sellers',
      '/dashboard/usa-selling',
      '/dashboard/india-selling',
      '/dashboard/uk-selling',
      '/dashboard/uae-selling',
      '/dashboard/flipkart'
    ].find(module => pathname.startsWith(module))

    if (activeModule) {
      setOpenMenus(prev => ({
        '/dashboard/manage-sellers': false,
        '/dashboard/usa-selling': false,
        '/dashboard/india-selling': false,
        '/dashboard/uk-selling': false,
        '/dashboard/uae-selling': false,
        '/dashboard/flipkart': false,
        [activeModule]: true, // Only keep active module open
      }))
    }
  }, [pathname])

  const toggleMenu = (path: string) => {
    setOpenMenus(prev => ({ ...prev, [path]: !prev[path] }))
  }

  // Loading State
  if (loading) {
    return (
      <div className="w-64 bg-slate-950 border-r border-slate-800 p-4 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 p-4 flex flex-col h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8 px-2">
        <Rocket className="w-6 h-6 text-indigo-500" />
        <h1 className="text-xl font-bold text-white">Scrappy v2</h1>
      </div>

      {/* User Role Badge */}
      {userRole && (
        <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">
            {String(userRole)}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {APP_ROUTES.map(route => (
          <SidebarItem
            key={route.path}
            item={route}
            depth={0}
            openMenus={openMenus}
            toggleMenu={toggleMenu}
            hasPageAccess={hasPageAccess}
          />
        ))}
      </nav>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center gap-2 px-3 py-2 mt-4 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20"
      >
        <LogOut className="w-4 h-4" />
        Logout
      </button>
    </div>
  )
}

// Helper Component for Recursive Menu
function SidebarItem({
  item,
  depth,
  openMenus,
  toggleMenu,
  hasPageAccess
}: {
  item: AppRoute,
  depth: number,
  openMenus: Record<string, boolean>,
  toggleMenu: (path: string) => void,
  hasPageAccess: (permission: string) => boolean
}) {
  const pathname = usePathname()
  const router = useRouter()

  // 🔒 STRICT CHECK: Hide item if user lacks permission
  if (!hasPageAccess(item.permission)) return null

  const isOpen = openMenus[item.path]
  const hasSubRoutes = item.subRoutes && item.subRoutes.length > 0
  const isActive = pathname === item.path || (hasSubRoutes && pathname.startsWith(item.path))
  const Icon = item.icon || Circle

  // Handle click: Navigate to page
  const handleMainClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    router.push(item.path)

    // If closed and has children, expand it
    if (hasSubRoutes && !isOpen) {
      toggleMenu(item.path)
    }
  }

  // Handle toggle: Expand/Collapse only
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleMenu(item.path)
  }

  return (
    <div>
      <div
        className={`
          flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200
          ${depth > 0 ? 'mt-1' : ''}
          ${isActive && depth === 0 ? 'bg-indigo-600 text-white shadow-md' : ''}
          ${isActive && depth > 0 ? 'text-indigo-400 bg-indigo-500/10' : ''}
          ${!isActive ? 'hover:bg-slate-900 hover:text-slate-200 text-slate-500' : ''}
          ${depth > 0 ? 'text-xs' : ''}
        `}
        style={{ paddingLeft: `${12 + (depth * 12)}px` }}
        onClick={handleMainClick}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-${depth > 0 ? 3 : 4} h-${depth > 0 ? 3 : 4}`} />
          <span className="font-medium">{item.label}</span>
        </div>
        {hasSubRoutes && (
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            onClick={handleToggleClick}
          />
        )}
      </div>
      {hasSubRoutes && isOpen && (
        <div className="space-y-0.5">
          {item.subRoutes!.map((subItem) => (
            <SidebarItem
              key={subItem.path}
              item={subItem}
              depth={depth + 1}
              openMenus={openMenus}
              toggleMenu={toggleMenu}
              hasPageAccess={hasPageAccess}
            />
          ))}
        </div>
      )}
    </div>
  )
}
