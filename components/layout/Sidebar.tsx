'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { APP_ROUTES } from '@/lib/config/routes'
import { AppRoute } from '@/lib/types'
import NotificationBell from '@/components/chat/NotificationBell'
import {
  LogOut,
  ChevronDown,
  Rocket,
  ShieldCheck,
  Circle,
  Loader2
} from 'lucide-react'
import UniversalAsinSearch from './UniversalAsinSearch'

// ✅ NEW: Accept mobile props
interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { userRole, logout, hasPageAccess, loading } = useAuth()
  const pathname = usePathname()

  const [isHovered, setIsHovered] = useState(false);
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

  // ✅ NEW: Close sidebar on route change (mobile)
  useEffect(() => {
    if (onClose) onClose()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMenu = (path: string) => {
    setOpenMenus(prev => ({ ...prev, [path]: !prev[path] }))
  }

  if (loading) {
    return (
      <aside className="w-[60px] bg-[#0a0a0a] border-r border-white/[0.1] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </aside>
    )
  }

  // ✅ The actual sidebar content (shared between mobile overlay & desktop)
  const sidebarContent = (
    <aside className="w-64 bg-[#0a0a0a] border-r border-white/[0.1] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.1] flex items-center gap-2">
        <Rocket className="w-5 h-5 text-orange-500" />
        <span className="font-bold text-white text-lg tracking-tight">Scrappy v2</span>
      </div>

      <div className="mb-4 px-1">
        <UniversalAsinSearch />
      </div>

      {/* User Role Badge */}
      {userRole && (
        <div className="px-4 py-2 border-b border-white/[0.1] flex items-center justify-between">
          <div>
            {userRole.full_name && (
              <p className="text-xs text-gray-400 mb-1 truncate">{userRole.full_name}</p>
            )}
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-200">
              <ShieldCheck className="w-3 h-3" />
              {userRole.role}
            </span>
          </div>
          <NotificationBell />
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
      <div className="p-3 border-t border-white/[0.1]">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  )

  return (
    <>
      {/* ✅ DESKTOP: Collapsed by default, expand on hover */}
      <div
        className="hidden md:flex h-full"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <aside className={`${isHovered ? 'w-64' : 'w-[60px]'} bg-[#0a0a0a] border-r border-white/[0.1] flex flex-col h-full transition-all duration-300 overflow-hidden`}>
          {/* Header */}
          <div className="p-4 border-b border-white/[0.1] flex items-center gap-2">
            <Rocket className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <span className={`font-bold text-white text-lg tracking-tight whitespace-nowrap transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>Scrappy v2</span>
          </div>

          <div className={`mb-4 px-1 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <UniversalAsinSearch />
          </div>

          {/* User Role Badge */}
          {userRole && (
            <div className={`px-4 py-2 border-b border-white/[0.1] flex items-center ${isHovered ? 'justify-between' : 'justify-center'}`}>
              <div className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                {userRole.full_name && (
                  <p className="text-xs text-gray-400 mb-1 truncate">{userRole.full_name}</p>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 border border-orange-200">
                  <ShieldCheck className="w-3 h-3" />
                  {userRole.role}
                </span>
              </div>
              <NotificationBell />
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
                isCollapsed={!isHovered}
              />
            ))}
          </nav>

          {/* Logout */}
          <div className="p-3 border-t border-white/[0.1]">
            <button
              onClick={logout}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-rose-400 hover:bg-rose-500/5 rounded-lg transition-colors ${!isHovered ? 'justify-center' : ''}`}
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className={`transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>Logout</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ✅ MOBILE: Overlay sidebar (hidden on desktop) */}
      <div className="md:hidden">
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-[#111111]/60 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          onClick={onClose}
        />
        {/* Slide-in panel */}
        <div
          className={`fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  )
}

// ✅ Helper Component — NOW WITH DRAG-TO-NEW-TAB SUPPORT
function SidebarItem({
  item,
  depth,
  openMenus,
  toggleMenu,
  hasPageAccess,
  isCollapsed
}: {
  item: AppRoute,
  depth: number,
  openMenus: Record<string, boolean>,
  toggleMenu: (path: string) => void,
  hasPageAccess: (permission: string) => boolean,
  isCollapsed?: boolean
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
      padding: 6px 14px; background: #1a1a2e; color: #f97316;
      border-radius: 8px; font-size: 12px; font-weight: 600;
      border: 1px solid #f97316; white-space: nowrap;
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
        draggable={true}
        onDragStart={handleDragStart}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150
          select-none
          ${depth > 0 ? 'mt-1' : ''}
          ${isActive ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : ''}
          ${!isActive && isParentOfActive ? 'text-orange-600 bg-orange-500/10' : ''}
          ${!isActive && !isParentOfActive ? 'hover:bg-white/[0.03] hover:text-white text-gray-400' : ''}
          ${depth === 1 ? 'text-xs' : ''}
          ${depth === 2 ? 'text-xs' : ''}
          ${depth === 3 ? 'text-[11px]' : ''}
          cursor-grab active:cursor-grabbing
        `}
        style={{ paddingLeft: `${12 + (depth * 12)}px` }}
        onClick={handleMainClick}
        title={`Drag to tab bar → open "${item.label}" in new tab`}
      >
        <Icon className={`w-${depth > 1 ? 3 : 4} h-${depth > 1 ? 3 : 4} flex-shrink-0`} />
        <span className={`flex-1 truncate font-semibold transition-opacity duration-300 ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>{item.label}</span>
        {hasSubRoutes && (
          <ChevronDown
            className={`w-3.5 h-3.5 transition-all duration-300 ${isOpen ? 'rotate-180' : ''} ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}
            onClick={handleToggleClick}
          />
        )}
      </div>

      {hasSubRoutes && isOpen && !isCollapsed && (
        <div className="ml-1">
          {item.subRoutes!.map((subItem) => (
            <SidebarItem
              key={subItem.path}
              item={subItem}
              depth={depth + 1}
              openMenus={openMenus}
              toggleMenu={toggleMenu}
              hasPageAccess={hasPageAccess}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      )}
    </div>
  )
}