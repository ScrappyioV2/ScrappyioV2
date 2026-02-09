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


export default function Sidebar() {
  const { userRole, logout, hasPageAccess, loading } = useAuth()
  const pathname = usePathname()

  // ✅ UPDATED: Initialize with function to detect active menu (supports 4 levels now)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    
    // Find all parent paths of current pathname
    const pathSegments = pathname.split('/').filter(Boolean)
    let currentPath = ''
    
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`
      initial[currentPath] = true
    })
    
    return initial
  })

  // ✅ UPDATED: Update open menus when pathname changes
  useEffect(() => {
    const newOpenMenus: Record<string, boolean> = {}
    
    // Open all parent paths of current pathname
    const pathSegments = pathname.split('/').filter(Boolean)
    let currentPath = ''
    
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`
      newOpenMenus[currentPath] = true
    })
    
    setOpenMenus(newOpenMenus)
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


// ✅ UPDATED: Helper Component with better depth handling
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

  if (!hasPageAccess(item.permission)) return null

  const isOpen = openMenus[item.path]
  const hasSubRoutes = item.subRoutes && item.subRoutes.length > 0
  const isActive = pathname === item.path
  const isParentOfActive = pathname.startsWith(item.path + '/')
  const Icon = item.icon || Circle

  const handleMainClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    // If has children, toggle. If no children, navigate
    if (hasSubRoutes) {
      toggleMenu(item.path)
    } else {
      router.push(item.path)
    }
  }

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
          ${isActive ? 'bg-indigo-600 text-white shadow-md' : ''}
          ${!isActive && isParentOfActive ? 'text-indigo-400 bg-indigo-500/5' : ''}
          ${!isActive && !isParentOfActive ? 'hover:bg-slate-900 hover:text-slate-200 text-slate-500' : ''}
          ${depth === 1 ? 'text-xs' : ''}
          ${depth === 2 ? 'text-xs' : ''}
          ${depth === 3 ? 'text-[11px]' : ''}
        `}
        style={{ paddingLeft: `${12 + (depth * 12)}px` }}
        onClick={handleMainClick}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-${depth > 1 ? 3 : 4} h-${depth > 1 ? 3 : 4}`} />
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
