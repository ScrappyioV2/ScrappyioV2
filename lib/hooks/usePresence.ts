'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from './useAuth'
import { usePathname } from 'next/navigation'

export type UserPresence = {
  user_id: string
  status: 'online' | 'away' | 'offline'
  last_seen: string
  current_page: string | null
  full_name?: string
  email?: string
  role?: string
}

export function usePresence() {
  const { user, userRole } = useAuth()
  const pathname = usePathname()
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null)
  const visibilityRef = useRef<boolean>(true)

  // ─── Update own presence ───
  const updatePresence = useCallback(async (status: 'online' | 'away' | 'offline') => {
    if (!user) return
    try {
      await supabase
        .from('chat_user_presence')
        .upsert({
          user_id: user.id,
          status,
          last_seen: new Date().toISOString(),
          current_page: status !== 'offline' ? pathname : null,
        }, { onConflict: 'user_id' })
    } catch (err) {
      console.error('Presence update error:', err)
    }
  }, [user, pathname])

  // ─── Fetch all users' presence ───
  const fetchPresence = useCallback(async () => {
    try {
      const { data: presenceData } = await supabase
        .from('chat_user_presence')
        .select('*')

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, full_name, email, role')
        .eq('is_active', true)

      const roleMap = new Map((userRoles || []).map(u => [u.user_id, u]))

      const enriched = (presenceData || []).map(p => {
        const roleInfo = roleMap.get(p.user_id)
        // Mark as offline if last_seen > 2 minutes ago
        const lastSeen = new Date(p.last_seen).getTime()
        const isStale = Date.now() - lastSeen > 2 * 60 * 1000
        return {
          ...p,
          status: isStale ? 'offline' as const : p.status,
          full_name: roleInfo?.full_name || undefined,
          email: roleInfo?.email || undefined,
          role: roleInfo?.role || undefined,
        }
      })

      setOnlineUsers(enriched)
    } catch (err) {
      console.error('Fetch presence error:', err)
    }
  }, [])

  // ─── Heartbeat: keep presence alive ───
  useEffect(() => {
    if (!user) return

    // Set online immediately
    updatePresence('online')
    fetchPresence()

    // Heartbeat every 30 seconds
    heartbeatRef.current = setInterval(() => {
      updatePresence(visibilityRef.current ? 'online' : 'away')
      fetchPresence()
    }, 60000)

    // Visibility change detection
    const handleVisibility = () => {
      visibilityRef.current = !document.hidden
      updatePresence(document.hidden ? 'away' : 'online')
    }

    // Before unload → set offline
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/chat_user_presence?user_id=eq.${user.id}`
      const body = JSON.stringify({ status: 'offline', last_seen: new Date().toISOString(), current_page: null })
      navigator.sendBeacon?.(url, body) // May not work with RLS, fallback below
      updatePresence('offline')
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Subscribe to presence changes via realtime
    const channel = supabase
      .channel('presence-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_user_presence',
      }, () => {
        fetchPresence()
      })
      .subscribe()

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      updatePresence('offline')
      channel.unsubscribe()
    }
  }, [user])

  // ─── Update page context when route changes ───
  useEffect(() => {
    if (user && visibilityRef.current) {
      updatePresence('online')
    }
  }, [pathname])

  // Helpers
  const isOnline = (userId: string) => {
    const p = onlineUsers.find(u => u.user_id === userId)
    return p?.status === 'online'
  }

  const getUserPresence = (userId: string) => {
    return onlineUsers.find(u => u.user_id === userId) || null
  }

  const onlineCount = onlineUsers.filter(u => u.status === 'online').length

  return {
    onlineUsers,
    onlineCount,
    isOnline,
    getUserPresence,
    updatePresence,
  }
}
