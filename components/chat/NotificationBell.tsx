'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/lib/hooks/useAuth'
import { Bell, X, Megaphone, MessageCircle, Pin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Notification = {
  id: string
  type: 'message' | 'broadcast' | 'pinned'
  title: string
  body: string
  conversation_id: string
  created_at: string
  read: boolean
}

export default function NotificationBell({ onOpenChat }: { onOpenChat?: (convoId: string) => void }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const bellRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    try {
      // Get user's conversations
      const { data: participantData } = await supabase
        .from('chat_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)

      if (!participantData || participantData.length === 0) return

      const convoIds = participantData.map(p => p.conversation_id)
      const lastReadMap = new Map(participantData.map(p => [p.conversation_id, p.last_read_at]))

      // Get recent messages not from current user
      const { data: recentMsgs } = await supabase
        .from('chat_messages')
        .select('*, chat_conversations!inner(name, type)')
        .in('conversation_id', convoIds)
        .neq('sender_id', user.id)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(20)

      if (!recentMsgs) return

      // Get sender names
      const senderIds = [...new Set(recentMsgs.map(m => m.sender_id))]
      const { data: senders } = await supabase
        .from('user_roles')
        .select('user_id, full_name, email')
        .in('user_id', senderIds)
      const senderMap = new Map((senders || []).map(s => [s.user_id, s]))

      const notifs: Notification[] = recentMsgs.map(msg => {
        const convo = (msg as any).chat_conversations
        const lastRead = lastReadMap.get(msg.conversation_id)
        const isRead = lastRead ? new Date(msg.created_at) <= new Date(lastRead) : false
        const senderInfo = senderMap.get(msg.sender_id)
        const senderName = senderInfo?.full_name || senderInfo?.email || 'Someone'

        let type: 'message' | 'broadcast' | 'pinned' = 'message'
        if (convo?.type === 'broadcast') type = 'broadcast'
        if (msg.is_pinned) type = 'pinned'

        return {
          id: msg.id,
          type,
          title: type === 'broadcast'
            ? `📢 ${convo?.name || 'Announcement'}`
            : senderName,
          body: msg.content.length > 60 ? msg.content.slice(0, 60) + '…' : msg.content,
          conversation_id: msg.conversation_id,
          created_at: msg.created_at,
          read: isRead,
        }
      })

      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.read).length)
    } catch (err) {
      console.error('Notification fetch error:', err)
    }
  }, [user])

  useEffect(() => {
    fetchNotifications()

    // Real-time refresh
    const channel = supabase
      .channel('notification-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        fetchNotifications()
      })
      .subscribe()

    // Periodic refresh
    const interval = setInterval(fetchNotifications, 30000)

    return () => {
      channel.unsubscribe()
      clearInterval(interval)
    }
  }, [fetchNotifications])

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const handleNotificationClick = (notif: Notification) => {
    setIsOpen(false)
    onOpenChat?.(notif.conversation_id)
  }

  const timeAgo = (dateStr: string): string => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (diff < 60) return 'now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div className="relative" ref={bellRef as any}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-[#111111] rounded-lg transition-colors text-gray-400 hover:text-white"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full left-0 mt-2 w-80 bg-[#1a1a1a] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-bold text-white">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-[#111111] rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No notifications yet</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <button
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-[#111111]/60 transition-colors text-left border-b border-white/[0.1] ${!notif.read ? 'bg-orange-500/5' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.type === 'broadcast' ? 'bg-amber-500/20' :
                      notif.type === 'pinned' ? 'bg-amber-500/20' :
                        'bg-orange-500/10'
                      }`}>
                      {notif.type === 'broadcast' ? <Megaphone className="w-4 h-4 text-amber-400" /> :
                        notif.type === 'pinned' ? <Pin className="w-4 h-4 text-amber-400" /> :
                          <MessageCircle className="w-4 h-4 text-orange-500" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-semibold truncate ${!notif.read ? 'text-white' : 'text-gray-400'}`}>
                          {notif.title}
                        </span>
                        <span className="text-[9px] text-gray-500 flex-shrink-0 ml-2">{timeAgo(notif.created_at)}</span>
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${!notif.read ? 'text-gray-500' : 'text-gray-500'}`}>
                        {notif.body}
                      </p>
                    </div>

                    {/* Unread dot */}
                    {!notif.read && (
                      <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
