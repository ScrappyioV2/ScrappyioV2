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
import UniversalAsinSearch from './UniversalAsinSearch'

export default function Sidebar() {
  const { userRole, logout, hasPageAccess, loading } = useAuth()
  const pathname = usePathname()

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    const pathSegments = pathname.split('/').filter(Boolean)
    let currentPath = ''
    pathSegments.forEach((segment) => {
      currentPath += `/${segment}`
      initial[currentPath] = true
    })
    return initial
  })

  useEffect(() => {
    const newOpenMenus: Record<string, boolean> = {}
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

  if (loading) {
    return (
      <aside className="w-64 bg-slate-950 border-r border-slate-800 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </aside>
    )
  }

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <Rocket className="w-5 h-5 text-indigo-500" />
        <span className="font-bold text-white text-lg tracking-tight">Scrappy v2</span>
      </div>

      <div className="mb-4 px-1">
        <UniversalAsinSearch />
      </div>

      {/* User Role Badge */}
      {userRole && (
        <div className="px-4 py-2 border-b border-slate-800">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ShieldCheck className="w-3 h-3" />
            {String(userRole)}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
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
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )
}

// ✅ Helper Component — NOW WITH DRAG-TO-NEW-TAB SUPPORT
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

  // ✅ NEW: Drag handler for opening in new tab
  const handleDragStart = (e: React.DragEvent) => {
    const fullUrl = `${window.location.origin}${item.path}`
    e.dataTransfer.setData('text/uri-list', fullUrl)
    e.dataTransfer.setData('text/plain', fullUrl)
    e.dataTransfer.effectAllowed = 'copyLink'

    // Styled drag ghost
    const ghost = document.createElement('div')
    ghost.textContent = `🔗 ${item.label}`
    ghost.style.cssText = `
      position: fixed; top: -200px; left: -200px;
      padding: 6px 14px; background: #1e293b; color: #e2e8f0;
      border-radius: 8px; font-size: 12px; font-weight: 600;
      border: 1px solid #6366f1; white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    requestAnimationFrame(() => document.body.removeChild(ghost))
  }

  const handleMainClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasSubRoutes) {
      router.push(item.path)
      if (!isOpen) {
        toggleMenu(item.path)
      }
    } else {
      router.push(item.path)
    }
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    toggleMenu(item.path)
  }

  return (
    <div>
      <div
        draggable={true}                    // ✅ NEW
        onDragStart={handleDragStart}       // ✅ NEW
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150
          select-none
          ${depth > 0 ? 'mt-1' : ''}
          ${isActive ? 'bg-indigo-600 text-white shadow-md' : ''}
          ${!isActive && isParentOfActive ? 'text-indigo-400 bg-indigo-500/5' : ''}
          ${!isActive && !isParentOfActive ? 'hover:bg-slate-900 hover:text-slate-200 text-slate-500' : ''}
          ${depth === 1 ? 'text-xs' : ''}
          ${depth === 2 ? 'text-xs' : ''}
          ${depth === 3 ? 'text-[11px]' : ''}
          cursor-grab active:cursor-grabbing
        `}
        style={{ paddingLeft: `${12 + (depth * 12)}px` }}
        onClick={handleMainClick}
        title={`Drag to tab bar → open "${item.label}" in new tab`}
      >
        <Icon className={`w-${depth > 1 ? 3 : 4} h-${depth > 1 ? 3 : 4}`} />
        <span className="flex-1 truncate">{item.label}</span>
        {hasSubRoutes && (
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            onClick={handleToggleClick}
          />
        )}
      </div>

      {hasSubRoutes && isOpen && (
        <div className="ml-1">
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
