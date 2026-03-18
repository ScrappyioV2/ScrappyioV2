'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from './useAuth'

// ─── Types ───
export type Conversation = {
  id: string
  type: 'dm' | 'group' | 'broadcast'
  name: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Enriched fields
  participants?: Participant[]
  last_message?: ChatMessage | null
  unread_count?: number
}

export type Participant = {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
  is_muted: boolean
  // Enriched
  full_name?: string | null
  email?: string | null
  role?: string | null
}

export type ChatMessage = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'system' | 'action' | 'image'
  metadata: {
    asin?: string
    page_context?: string
    action_url?: string
    action_label?: string
  }
  is_pinned: boolean
  pinned_by: string | null
  pinned_at: string | null
  is_deleted: boolean
  created_at: string
  edited_at: string | null
  // Enriched
  sender_name?: string | null
  sender_role?: string | null
  attachments?: Attachment[]
  read_by?: ReadReceipt[]
}

export type Attachment = {
  id: string
  message_id: string
  file_url: string
  file_name: string
  file_type: string
  file_size: number
}

export type ReadReceipt = {
  id: string
  message_id: string
  user_id: string
  read_at: string
  full_name?: string
}

export type UserPresence = {
  user_id: string
  status: 'online' | 'away' | 'offline'
  last_seen: string
  current_page: string | null
  full_name?: string
  email?: string
  role?: string
}

export function useChat() {
  const { user, userRole, isAdmin } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pinnedMessages, setPinnedMessages] = useState<ChatMessage[]>([])
  const [allUsers, setAllUsers] = useState<{ user_id: string; full_name: string; email: string; role: string }[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const channelRef = useRef<any>(null)

  // ─── Fetch all conversations for current user ───
  const fetchConversations = useCallback(async () => {
    if (!user) return

    try {
      // Get conversations user is part of
      const { data: participantData } = await supabase
        .from('chat_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (!participantData || participantData.length === 0) {
        setConversations([])
        return
      }

      const convoIds = participantData.map(p => p.conversation_id)

      // Fetch conversations
      const { data: convos } = await supabase
        .from('chat_conversations')
        .select('*')
        .in('id', convoIds)
        .order('updated_at', { ascending: false })

      if (!convos) return

      // Fetch participants for all conversations with user info
      const { data: allParticipants } = await supabase
        .from('chat_participants')
        .select('*')
        .in('conversation_id', convoIds)

      // Fetch user roles for participant names
      const participantUserIds = [...new Set((allParticipants || []).map(p => p.user_id))]
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id, full_name, email, role')
        .in('user_id', participantUserIds)

      const userMap = new Map((userRoles || []).map(u => [u.user_id, u]))

      // Fetch last message per conversation
      const lastMessages: Record<string, ChatMessage> = {}
      for (const convo of convos) {
        const { data: lastMsg } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('conversation_id', convo.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastMsg) {
          const sender = userMap.get(lastMsg.sender_id)
          lastMessages[convo.id] = { ...lastMsg, sender_name: sender?.full_name || sender?.email || 'Unknown' }
        }
      }

      // Get unread counts
      const { data: unreadData } = await supabase.rpc('get_unread_counts', { p_user_id: user.id })
      const unreadMap = new Map((unreadData || []).map((u: any) => [u.conversation_id, Number(u.unread_count)]))

      // Enrich conversations
      const enriched = convos.map(c => {
        const participants = (allParticipants || [])
          .filter(p => p.conversation_id === c.id)
          .map(p => {
            const userInfo = userMap.get(p.user_id)
            return { ...p, full_name: userInfo?.full_name, email: userInfo?.email, role: userInfo?.role }
          })

        // For DMs, set name to the other person's name
        let displayName = c.name
        if (c.type === 'dm') {
          const otherParticipant = participants.find(p => p.user_id !== user.id)
          displayName = otherParticipant?.full_name || otherParticipant?.email || 'Unknown'
        }

        return {
          ...c,
          name: displayName,
          participants,
          last_message: lastMessages[c.id] || null,
          unread_count: unreadMap.get(c.id) || 0,
        }
      })

      // Sort: unread first, then by latest message
      enriched.sort((a, b) => {
        if ((a.unread_count || 0) > 0 && (b.unread_count || 0) === 0) return -1
        if ((a.unread_count || 0) === 0 && (b.unread_count || 0) > 0) return 1
        const aTime = a.last_message?.created_at || a.updated_at
        const bTime = b.last_message?.created_at || b.updated_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })

      setConversations(enriched)
      setTotalUnread(enriched.reduce((sum, c) => sum + (c.unread_count || 0), 0))
    } catch (err) {
      console.error('Error fetching conversations:', err)
    }
  }, [user])

  // ─── Fetch messages for active conversation ───
  const fetchMessages = useCallback(async (conversationId: string) => {
    if (!user) return
    setLoadingMessages(true)

    try {
      const { data: msgs } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(200)

      if (!msgs) { setMessages([]); return }

      // Get sender info
      const senderIds = [...new Set(msgs.map(m => m.sender_id))]
      const { data: senders } = await supabase
        .from('user_roles')
        .select('user_id, full_name, role')
        .in('user_id', senderIds)

      const senderMap = new Map((senders || []).map(s => [s.user_id, s]))

      // Get attachments
      const msgIds = msgs.map(m => m.id)
      const { data: attachments } = await supabase
        .from('chat_attachments')
        .select('*')
        .in('message_id', msgIds)

      const attachMap = new Map<string, Attachment[]>()
        ; (attachments || []).forEach(a => {
          if (!attachMap.has(a.message_id)) attachMap.set(a.message_id, [])
          attachMap.get(a.message_id)!.push(a)
        })

      // Get read receipts for last few messages
      const recentMsgIds = msgs.slice(-20).map(m => m.id)
      const { data: receipts } = await supabase
        .from('chat_read_receipts')
        .select('*')
        .in('message_id', recentMsgIds)

      const receiptMap = new Map<string, ReadReceipt[]>()
        ; (receipts || []).forEach(r => {
          if (!receiptMap.has(r.message_id)) receiptMap.set(r.message_id, [])
          receiptMap.get(r.message_id)!.push(r)
        })

      // Get pinned messages
      const pinned = msgs.filter(m => m.is_pinned)

      const enrichedMessages = msgs.map(m => {
        const sender = senderMap.get(m.sender_id)
        return {
          ...m,
          sender_name: sender?.full_name || 'Unknown',
          sender_role: sender?.role || null,
          attachments: attachMap.get(m.id) || [],
          read_by: receiptMap.get(m.id) || [],
        }
      })

      setMessages(enrichedMessages)
      setPinnedMessages(enrichedMessages.filter(m => m.is_pinned))

      // Mark as read
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)

    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      setLoadingMessages(false)
    }
  }, [user])

  // ─── Send a message ───
  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    options?: {
      messageType?: 'text' | 'system' | 'action' | 'image'
      metadata?: ChatMessage['metadata']
      attachmentFile?: File
    }
  ) => {
    if (!user || !content.trim()) return null

    try {
      // Build page context from current URL
      const pageContext = typeof window !== 'undefined' ? window.location.pathname : undefined

      const { data: msg, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: content.trim(),
          message_type: options?.messageType || 'text',
          metadata: {
            ...options?.metadata,
            page_context: pageContext,
          },
        })
        .select()
        .single()

      if (error) throw error

      // Handle file attachment
      if (options?.attachmentFile && msg) {
        const file = options.attachmentFile
        const fileExt = file.name.split('.').pop()
        const filePath = `${conversationId}/${msg.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(filePath, file)

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('chat-attachments')
            .getPublicUrl(filePath)

          await supabase.from('chat_attachments').insert({
            message_id: msg.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          })
        }
      }

      // Update conversation updated_at
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId)

      return msg
    } catch (err) {
      console.error('Error sending message:', err)
      return null
    }
  }, [user])

  // ─── Start a DM ───
  const startDM = useCallback(async (otherUserId: string) => {
    if (!user) return null
    try {
      const { data } = await supabase.rpc('get_or_create_dm', {
        p_user1: user.id,
        p_user2: otherUserId,
      })
      if (data) {
        setActiveConversation(data)
        await fetchConversations()
        return data
      }
    } catch (err) {
      console.error('Error starting DM:', err)
    }
    return null
  }, [user, fetchConversations])

  // ─── Create broadcast (admin) ───
  const createBroadcast = useCallback(async (name: string, message: string) => {
    if (!user || !isAdmin) return null
    try {
      const { data: convoId } = await supabase.rpc('create_broadcast_conversation', {
        p_admin_id: user.id,
        p_name: name,
      })

      if (convoId) {
        await sendMessage(convoId, message, { messageType: 'system' })
        await fetchConversations()
        return convoId
      }
    } catch (err) {
      console.error('Error creating broadcast:', err)
    }
    return null
  }, [user, isAdmin, sendMessage, fetchConversations])

  // ─── Pin/Unpin message ───
  const togglePin = useCallback(async (messageId: string, pin: boolean) => {
    if (!user) return
    try {
      await supabase
        .from('chat_messages')
        .update({
          is_pinned: pin,
          pinned_by: pin ? user.id : null,
          pinned_at: pin ? new Date().toISOString() : null,
        })
        .eq('id', messageId)

      if (activeConversation) {
        await fetchMessages(activeConversation)
      }
    } catch (err) {
      console.error('Error toggling pin:', err)
    }
  }, [user, activeConversation, fetchMessages])

  const deleteMessage = useCallback(async (messageId: string) => {
    if (!user) return
    try {
      await supabase
        .from('chat_messages')
        .update({ is_deleted: true })
        .eq('id', messageId)

      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (err) {
      console.error('Error deleting message:', err)
    }
  }, [user])

  // ─── Clear all messages in a conversation ───
  const clearConversation = useCallback(async (conversationId: string) => {
    if (!user) return
    try {
      await supabase
        .from('chat_messages')
        .update({ is_deleted: true })
        .eq('conversation_id', conversationId)

      setMessages([])
      setPinnedMessages([])
      await fetchConversations()
    } catch (err) {
      console.error('Error clearing conversation:', err)
    }
  }, [user, fetchConversations])

  // ─── Delete entire conversation (remove for all) ───
  const deleteConversation = useCallback(async (conversationId: string) => {
    if (!user) return
    try {
      // Delete all messages
      await supabase
        .from('chat_messages')
        .delete()
        .eq('conversation_id', conversationId)

      // Delete participants
      await supabase
        .from('chat_participants')
        .delete()
        .eq('conversation_id', conversationId)

      // Delete conversation
      await supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)

      setMessages([])
      setPinnedMessages([])
      setActiveConversation(null)
      await fetchConversations()
    } catch (err) {
      console.error('Error deleting conversation:', err)
    }
  }, [user, fetchConversations])

  // ─── Mark conversation as read ───
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user) return
    try {
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)

      // Also create read receipts for recent messages
      const { data: recentMsgs } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (recentMsgs && recentMsgs.length > 0) {
        const receipts = recentMsgs.map(m => ({
          message_id: m.id,
          user_id: user.id,
        }))

        await supabase.from('chat_read_receipts').upsert(receipts, {
          onConflict: 'message_id,user_id',
        })
      }
    } catch (err) {
      console.error('Error marking as read:', err)
    }
  }, [user])

  // ─── Fetch all users (for DM picker) ───
  const fetchAllUsers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, full_name, email, role')
        .eq('is_active', true)

      setAllUsers((data || []).filter(u => u.user_id !== user?.id))
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }, [user])

  // ─── Real-time subscription ───
  useEffect(() => {
    if (!user) return

    fetchConversations()
    fetchAllUsers()

    // Subscribe to new messages
    const channel = supabase
      .channel('chat-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, async (payload) => {
        const newMsg = payload.new as ChatMessage

        // If we're viewing this conversation, add the message
        if (newMsg.conversation_id === activeConversation) {
          // Enrich with sender info
          const { data: senderInfo } = await supabase
            .from('user_roles')
            .select('full_name, role')
            .eq('user_id', newMsg.sender_id)
            .maybeSingle()

          const enrichedMsg = {
            ...newMsg,
            sender_name: senderInfo?.full_name || 'Unknown',
            sender_role: senderInfo?.role || null,
            attachments: [],
            read_by: [],
          }

          setMessages(prev => {
            if (prev.find(m => m.id === enrichedMsg.id)) return prev
            return [...prev, enrichedMsg]
          })

          // Auto mark as read if viewing
          markAsRead(newMsg.conversation_id)
        }

        // Refresh conversation list for unread counts
        fetchConversations()
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
      }, () => {
        // Refresh messages (for pins, edits, deletes)
        if (activeConversation) fetchMessages(activeConversation)
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [user, activeConversation])

  // ─── Open conversation ───
  const openConversation = useCallback(async (conversationId: string) => {
    setActiveConversation(conversationId)
    await fetchMessages(conversationId)
    await markAsRead(conversationId)
    await fetchConversations() // Refresh unread counts
  }, [fetchMessages, markAsRead, fetchConversations])

  return {
    conversations,
    activeConversation,
    messages,
    pinnedMessages,
    allUsers,
    totalUnread,
    loadingMessages,
    isAdmin,
    currentUserId: user?.id || null,
    currentUserName: userRole?.full_name || user?.email || null,
    openConversation,
    sendMessage,
    startDM,
    createBroadcast,
    togglePin,
    markAsRead,
    fetchConversations,
    setActiveConversation,
    deleteMessage,
    clearConversation,
    deleteConversation,
  }
}
