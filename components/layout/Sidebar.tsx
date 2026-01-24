'use client'

import { useState } from 'react'
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
  
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    '/dashboard/manage-sellers': true,
    '/dashboard/usa-selling': true
  })

  const toggleMenu = (path: string) => {
    setOpenMenus(prev => ({ ...prev, [path]: !prev[path] }))
  }

  // Loading State
  if (loading) {
    return (
      <aside className="w-64 min-h-screen bg-slate-950 border-r border-slate-800 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
      </aside>
    )
  }

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
            <div className="flex items-center gap-1">
              <ShieldCheck size={10} className="text-indigo-400" />
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-wider font-semibold">
                {userRole.role}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {APP_ROUTES.map((route) => (
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
    <div className="mb-1">
      <div
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer
          ${depth > 0 ? 'mt-1' : ''}
          ${isActive && depth === 0 ? 'bg-indigo-600 text-white shadow-md' : ''}
          ${isActive && depth > 0 ? 'text-indigo-400 bg-indigo-500/10' : ''}
          ${!isActive ? 'hover:bg-slate-900 hover:text-slate-200 text-slate-500' : ''}
          ${depth > 0 ? 'text-xs' : ''} 
        `}
        style={{ paddingLeft: `${12 + (depth * 12)}px` }}
        onClick={handleMainClick}
      >
        <div className="flex items-center gap-3">
          <span className={isActive ? (depth === 0 ? 'text-white' : 'text-indigo-400') : 'text-slate-500'}>
            <Icon size={depth === 0 ? 18 : 14} strokeWidth={depth > 0 ? 3 : 2} />
          </span>
          <span className="truncate">{item.label}</span>
        </div>
        
        {hasSubRoutes && (
          <div 
            role="button"
            onClick={handleToggleClick}
            className={`p-1 hover:bg-slate-700/50 rounded transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          >
            <ChevronDown size={14} />
          </div>
        )}
      </div>

      {hasSubRoutes && isOpen && (
        <div className="border-l border-slate-800 ml-4 space-y-1">
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