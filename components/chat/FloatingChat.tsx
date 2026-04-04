'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useChat, ChatMessage, Conversation } from '@/lib/hooks/useChat'
import { usePresence } from '@/lib/hooks/usePresence'
import {
  MessageCircle, X, Send, Pin, PinOff, ChevronLeft, Users,
  Megaphone, Paperclip, Image as ImageIcon, Check, CheckCheck,
  Circle, Search, Plus, Loader2, ExternalLink, MapPin,
  Trash2, MoreVertical
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

// ─── Page context pretty names ───
const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/india-selling/brand-checking': 'India → Brand Check',
  '/dashboard/india-selling/validation': 'India → Validation',
  '/dashboard/india-selling/listing-error': 'India → Listing Errors',
  '/dashboard/india-selling/purchases': 'India → Purchases',
  '/dashboard/india-selling/tracking': 'India → Tracking',
  '/dashboard/india-selling/restock': 'India → Restock',
  '/dashboard/india-selling/reorder': 'India → Reorder',
  '/dashboard/india-selling/admin-validation': 'India → Admin Approvals',
  '/dashboard/usa-selling/brand-checking': 'USA → Brand Check',
  '/dashboard/usa-selling/validation': 'USA → Validation',
  '/dashboard/usa-selling/listing-error': 'USA → Listing Errors',
  '/dashboard/usa-selling/purchases': 'USA → Purchases',
  '/dashboard/usa-selling/tracking': 'USA → Tracking',
  '/dashboard/usa-selling/reorder': 'USA → Reorder',
  '/dashboard/usa-selling/admin-validation': 'USA → Admin Approvals',
  '/dashboard/uk-selling/brand-checking': 'UK → Brand Check',
  '/dashboard/uk-selling/validation': 'UK → Validation',
  '/dashboard/uk-selling/listing-error': 'UK → Listing Errors',
  '/dashboard/uk-selling/purchases': 'UK → Purchases',
  '/dashboard/uk-selling/tracking': 'UK → Tracking',
  '/dashboard/uk-selling/reorder': 'UK → Reorder',
  '/dashboard/uk-selling/admin-validation': 'UK → Admin Approvals',
  '/dashboard/uae-selling/brand-checking': 'UAE → Brand Check',
  '/dashboard/uae-selling/validation': 'UAE → Validation',
  '/dashboard/uae-selling/listing-error': 'UAE → Listing Errors',
  '/dashboard/uae-selling/purchases': 'UAE → Purchases',
  '/dashboard/uae-selling/tracking': 'UAE → Tracking',
  '/dashboard/uae-selling/reorder': 'UAE → Reorder',
  '/dashboard/uae-selling/admin-validation': 'UAE → Admin Approvals',
  '/dashboard/flipkart/brand-checking': 'Flipkart → Brand Check',
  '/dashboard/flipkart/validation': 'Flipkart → Validation',
  '/dashboard/flipkart/listing-error': 'Flipkart → Listing Errors',
  '/dashboard/flipkart/purchases': 'Flipkart → Purchases',
  '/dashboard/flipkart/tracking': 'Flipkart → Tracking',
  '/dashboard/flipkart/reorder': 'Flipkart → Reorder',
  '/dashboard/flipkart/admin-validation': 'Flipkart → Admin Approvals',
  '/dashboard/manage-sellers': 'Manage Sellers',
}

function getPageLabel(path: string | null | undefined): string {
  if (!path) return ''
  return PAGE_LABELS[path] || path.split('/').slice(-2).join(' → ')
}

// ─── Time formatting ───
function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function FloatingChat() {
  const {
    conversations, activeConversation, messages, pinnedMessages,
    allUsers, totalUnread, loadingMessages, isAdmin, currentUserId,
    currentUserName, openConversation, sendMessage, startDM,
    createBroadcast, togglePin, setActiveConversation, fetchConversations,
    deleteMessage, clearConversation, deleteConversation,
  } = useChat()

  const { onlineUsers, isOnline, getUserPresence, onlineCount } = usePresence()

  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'list' | 'chat' | 'new_dm' | 'broadcast'>('list')
  const [inputValue, setInputValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [broadcastName, setBroadcastName] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [showPinned, setShowPinned] = useState(false)
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showActionMenu, setShowActionMenu] = useState(false)
  const [showChatMenu, setShowChatMenu] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ type: 'clear' | 'delete' | 'deleteMsg'; id: string } | null>(null)
  const [actionForm, setActionForm] = useState({ asin: '', message: '', url: '/dashboard/india-selling/purchases', label: 'Go to Product' })

  // ─── Drag state ───
  const [tabY, setTabY] = useState<number>(() => {
    if (typeof window === 'undefined') return 300;
    try {
      const saved = localStorage.getItem('chatTabY');
      return saved ? Number(saved) : Math.round(window.innerHeight / 2);
    } catch { return 300; }
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startPos: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // ─── Grammarly-style hover open/close ───
  const handleBtnMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    if (!isOpen) { setIsOpen(true); fetchConversations() }
  }
  const handleBtnMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setIsOpen(false), 400)
  }
  const handleWindowMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
  }
  const handleWindowMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => setIsOpen(false), 400)
  }

  // ─── Compute chat window position (always fully on-screen) ───
  const getWindowStyle = () => {
    if (typeof window === 'undefined') return { top: 20, height: 560 };
    const maxH = Math.min(560, window.innerHeight - 40);
    // Center window on tab, but clamp so it never goes off-screen
    let top = tabY - maxH / 2;
    if (top < 20) top = 20;
    if (top + maxH > window.innerHeight - 20) top = window.innerHeight - 20 - maxH;
    return { top, height: maxH };
  }

  // ─── Auto scroll to bottom ───
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // ─── Handle file selection ───
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAttachmentFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (ev) => setAttachmentPreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setAttachmentPreview(null)
    }
  }

  const clearAttachment = () => {
    setAttachmentFile(null)
    setAttachmentPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ─── Send handler ───
  const handleSend = async () => {
    if (!activeConversation || (!inputValue.trim() && !attachmentFile)) return
    setSending(true)

    const content = inputValue.trim() || (attachmentFile ? `📎 ${attachmentFile.name}` : '')

    await sendMessage(activeConversation, content, {
      messageType: attachmentFile?.type.startsWith('image/') ? 'image' : 'text',
      attachmentFile: attachmentFile || undefined,
    })

    setInputValue('')
    clearAttachment()
    setSending(false)
    inputRef.current?.focus()
  }

  // ─── Keyboard shortcut ───
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSendAction = async () => {
    if (!activeConversation || !actionForm.message.trim()) return
    setSending(true)

    await sendMessage(activeConversation, actionForm.message.trim(), {
      messageType: 'action',
      metadata: {
        asin: actionForm.asin.trim() || undefined,
        action_url: actionForm.url.trim() || undefined,
        action_label: actionForm.label.trim() || 'Open',
      },
    })

    setActionForm({ asin: '', message: '', url: '/dashboard/india-selling/purchases', label: 'Go to Product' })
    setShowActionMenu(false)
    setSending(false)
  }

  // ─── Open chat and go to conversation ───
  const handleOpenConversation = async (convoId: string) => {
    await openConversation(convoId)
    setView('chat')
  }

  // ─── Start DM from user list ───
  const handleStartDM = async (userId: string) => {
    const convoId = await startDM(userId)
    if (convoId) {
      await openConversation(convoId)
      setView('chat')
    }
  }

  // ─── Send broadcast ───
  const handleBroadcast = async () => {
    if (!broadcastName.trim() || !broadcastMessage.trim()) return
    setSending(true)
    const convoId = await createBroadcast(broadcastName.trim(), broadcastMessage.trim())
    if (convoId) {
      setBroadcastName('')
      setBroadcastMessage('')
      await openConversation(convoId)
      setView('chat')
    }
    setSending(false)
  }

  // ─── Get active conversation data ───
  const activeConvo = conversations.find(c => c.id === activeConversation)

  // ─── Filtered users for DM picker ───
  const filteredUsers = allUsers.filter(u =>
    !searchQuery || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ─── Presence dot component ───
  const PresenceDot = ({ userId, size = 'sm' }: { userId: string; size?: 'sm' | 'md' }) => {
    const online = isOnline(userId)
    const s = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
    return (
      <span className={`${s} rounded-full flex-shrink-0 ${online ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' : 'bg-slate-600'}`} />
    )
  }

  // ─── Read receipt indicator ───
  const ReadReceipt = ({ message }: { message: ChatMessage }) => {
    if (message.sender_id !== currentUserId) return null
    const readCount = message.read_by?.length || 0
    if (readCount === 0) return <Check className="w-3 h-3 text-gray-500" />
    return (
      <span className="flex items-center gap-0.5" title={`Read by ${readCount}`}>
        <CheckCheck className="w-3 h-3 text-orange-500" />
      </span>
    )
  }

  return (
    <>
      {/* ─── Edge Tab (peek from right side, draggable) ─── */}
      <div
        onMouseEnter={handleBtnMouseEnter}
        onMouseLeave={handleBtnMouseLeave}
        onMouseDown={(e) => {
          dragRef.current = { startY: e.clientY, startPos: tabY };
          setIsDragging(false);
          const onMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            if (Math.abs(ev.clientY - dragRef.current.startY) > 4) setIsDragging(true);
            const newY = Math.max(40, Math.min(window.innerHeight - 40, dragRef.current.startPos + (ev.clientY - dragRef.current.startY)));
            setTabY(newY);
          };
          const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            localStorage.setItem('chatTabY', String(tabY));
            setTimeout(() => { dragRef.current = null; }, 50);
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
        className="fixed right-0 z-50 group cursor-grab active:cursor-grabbing select-none"
        style={{ top: tabY, transform: 'translateY(-50%)' }}
      >
        <div className={`flex items-center transition-all duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-[28px] group-hover:translate-x-0'
        }`}>
          <div className={`w-5 h-12 flex items-center justify-center rounded-l-lg transition-all duration-300 ${
            isOpen
              ? 'bg-[#111111] border border-r-0 border-white/[0.06]'
              : 'bg-orange-500/100/60 group-hover:bg-white/[0.03]0/100/100 border border-r-0 border-orange-500/30'
          }`}>
            <svg className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'text-gray-400 rotate-180' : 'text-white/80 group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
          <button
            onClick={() => { if (isDragging) return; if (isOpen) setIsOpen(false) }}
            className={`w-10 h-12 flex items-center justify-center transition-all duration-200 rounded-l-lg -ml-px ${
              isOpen
                ? 'bg-[#111111] border border-r-0 border-white/[0.06] text-gray-400 hover:text-white'
                : 'bg-orange-500/100/80 group-hover:bg-orange-400 border border-r-0 border-orange-500/40 text-white shadow-lg shadow-indigo-900/30'
            }`}
          >
            {isOpen ? <X className="w-4 h-4" /> : <MessageCircle className="w-5 h-5" />}
            {totalUnread > 0 && !isOpen && (
              <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-slate-950">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Chat Window ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={handleWindowMouseEnter}
            onMouseLeave={handleWindowMouseLeave}
            className="fixed right-[54px] z-50 w-[380px] bg-[#1a1a1a] rounded-2xl shadow-2xl border border-white/[0.06] flex flex-col overflow-hidden"
            style={getWindowStyle()}
          >
            {/* ─── HEADER ─── */}
            <div className="flex-none px-4 py-3 bg-[#111111] border-b border-white/[0.06] flex items-center justify-between">
              {view === 'chat' && activeConvo ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <button onClick={() => { setView('list'); setActiveConversation(null) }} className="p-1 hover:bg-[#111111] rounded-lg transition-colors">
                      <ChevronLeft className="w-4 h-4 text-gray-400" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white truncate">{activeConvo.name}</h3>
                        {activeConvo.type === 'broadcast' && <Megaphone className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                      </div>
                      {activeConvo.type === 'dm' && activeConvo.participants && (
                        <div className="flex items-center gap-1">
                          <PresenceDot userId={activeConvo.participants.find(p => p.user_id !== currentUserId)?.user_id || ''} />
                          <span className="text-[10px] text-gray-500">
                            {isOnline(activeConvo.participants.find(p => p.user_id !== currentUserId)?.user_id || '')
                              ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Pin toggle */}
                  <div className="flex items-center gap-1">
                    {/* Pin toggle */}
                    <button
                      onClick={() => setShowPinned(!showPinned)}
                      className={`p-1.5 rounded-lg transition-colors ${showPinned ? 'bg-amber-500/100/20 text-amber-400' : 'hover:bg-[#111111] text-gray-500'}`}
                      title="Pinned messages"
                    >
                      <Pin className="w-4 h-4" />
                      {pinnedMessages.length > 0 && (
                        <span className="absolute -mt-6 ml-3 w-4 h-4 bg-amber-500/100 text-[9px] font-bold text-black rounded-full flex items-center justify-center">
                          {pinnedMessages.length}
                        </span>
                      )}
                    </button>

                    {/* 3-dot menu */}
                    <div className="relative">
                      <button
                        onClick={() => setShowChatMenu(!showChatMenu)}
                        className="p-1.5 hover:bg-[#111111] rounded-lg transition-colors text-gray-500"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showChatMenu && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowChatMenu(false)} />
                          <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] border border-white/[0.06] rounded-xl shadow-2xl p-1.5 z-40 w-48 animate-in fade-in zoom-in-95">
                            <button
                              onClick={() => {
                                setConfirmAction({ type: 'clear', id: activeConversation! })
                                setShowChatMenu(false)
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-[#1a1a1a] rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                              Clear Messages
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setConfirmAction({ type: 'delete', id: activeConversation! })
                                  setShowChatMenu(false)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Conversation
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              ) : view === 'new_dm' ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setView('list')} className="p-1 hover:bg-[#111111] rounded-lg transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <h3 className="text-sm font-bold text-white">New Message</h3>
                </div>
              ) : view === 'broadcast' ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => setView('list')} className="p-1 hover:bg-[#111111] rounded-lg transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>
                  <h3 className="text-sm font-bold text-white">Broadcast to All</h3>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-orange-500" />
                    <h3 className="text-sm font-bold text-white">Messages</h3>
                    <div className="relative group">
                      <span className="text-[10px] bg-emerald-500/100/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium cursor-pointer">
                        {onlineCount} online
                      </span>
                      {/* Tooltip showing who's online */}
                      <div className="hidden group-hover:block absolute top-full left-0 mt-1.5 bg-[#1a1a1a] border border-white/[0.06] rounded-xl shadow-2xl p-2.5 min-w-[180px] z-50">
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1.5 px-1">Online Now</p>
                        {onlineUsers.filter(u => u.status === 'online' && u.user_id !== currentUserId).map(u => (
                          <div key={u.user_id} className="flex items-center gap-2 px-1 py-1.5 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs text-white font-medium truncate">{u.full_name || u.email || 'Unknown'}</p>
                              {u.current_page && (
                                <p className="text-[9px] text-gray-500 truncate">{getPageLabel(u.current_page)}</p>
                              )}
                            </div>
                          </div>
                        ))}
                        {onlineUsers.filter(u => u.status === 'online' && u.user_id !== currentUserId).length === 0 && (
                          <p className="text-[10px] text-gray-500 px-1 py-1">Only you are online</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <button onClick={() => setView('broadcast')} className="p-1.5 hover:bg-[#111111] rounded-lg transition-colors text-amber-400" title="Broadcast to all">
                        <Megaphone className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => { setView('new_dm'); setSearchQuery('') }} className="p-1.5 hover:bg-[#111111] rounded-lg transition-colors text-orange-500" title="New message">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* ─── PINNED MESSAGES BAR ─── */}
            {view === 'chat' && showPinned && pinnedMessages.length > 0 && (
              <div className="flex-none bg-amber-500/100/15 border-b border-amber-500/20 px-3 py-2 max-h-32 overflow-y-auto">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Pin className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pinned</span>
                </div>
                {pinnedMessages.map(pm => (
                  <div key={pm.id} className="text-xs text-gray-500 mb-1 pl-4 border-l-2 border-amber-500/30">
                    <span className="text-amber-400 font-medium">{pm.sender_name}: </span>
                    {pm.content.length > 80 ? pm.content.slice(0, 80) + '…' : pm.content}
                  </div>
                ))}
              </div>
            )}

            {/* ─── BODY ─── */}
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">

              {/* ── CONVERSATION LIST VIEW ── */}
              {view === 'list' && (
                <div className="p-2">
                  {conversations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageCircle className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 font-medium">No conversations yet</p>
                      <p className="text-xs text-gray-500 mt-1">Start a new message to begin</p>
                    </div>
                  ) : (
                    conversations.map(convo => (
                      <div key={convo.id} className="relative group/item">
                        <button
                          onClick={() => handleOpenConversation(convo.id)}
                          className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-[#111111]/60 transition-colors text-left"
                        >
                          {/* Avatar / Icon */}
                          <div className="relative flex-shrink-0">
                            {convo.type === 'broadcast' ? (
                              <div className="w-10 h-10 rounded-full bg-amber-500/100/20 flex items-center justify-center">
                                <Megaphone className="w-5 h-5 text-amber-400" />
                              </div>
                            ) : convo.type === 'dm' ? (
                              <div className="w-10 h-10 rounded-full bg-orange-500/100/10 flex items-center justify-center text-orange-500 font-bold text-sm">
                                {(convo.name || '?')[0].toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            {convo.type === 'dm' && convo.participants && (
                              <span className="absolute -bottom-0.5 -right-0.5">
                                <PresenceDot userId={convo.participants.find(p => p.user_id !== currentUserId)?.user_id || ''} size="md" />
                              </span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-semibold truncate ${(convo.unread_count || 0) > 0 ? 'text-white' : 'text-gray-500'}`}>
                                {convo.name || 'Chat'}
                              </span>
                              <span className="text-[10px] text-gray-500 flex-shrink-0">
                                {convo.last_message ? timeAgo(convo.last_message.created_at) : ''}
                              </span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className={`text-xs truncate ${(convo.unread_count || 0) > 0 ? 'text-gray-500 font-medium' : 'text-gray-500'}`}>
                                {convo.last_message
                                  ? `${convo.last_message.sender_name}: ${convo.last_message.content}`
                                  : 'No messages yet'
                                }
                              </p>
                              {(convo.unread_count || 0) > 0 && (
                                <span className="w-5 h-5 bg-orange-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                                  {convo.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Delete button on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmAction({ type: 'delete', id: convo.id })
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#111111] border border-white/[0.06] text-gray-500 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 opacity-0 group-hover/item:opacity-100 transition-all z-10"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── NEW DM VIEW ── */}
              {view === 'new_dm' && (
                <div className="p-3">
                  {/* Search */}
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="w-full pl-9 pr-3 py-2 bg-[#111111] border border-white/[0.06] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                      autoFocus
                    />
                  </div>

                  {/* User list */}
                  <div className="space-y-1">
                    {filteredUsers.map(u => {
                      const presence = getUserPresence(u.user_id)
                      return (
                        <button
                          key={u.user_id}
                          onClick={() => handleStartDM(u.user_id)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#111111]/60 transition-colors text-left"
                        >
                          <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-orange-500/100/10 flex items-center justify-center text-orange-500 font-bold text-xs">
                              {(u.full_name || u.email)?.[0]?.toUpperCase() || '?'}
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5">
                              <PresenceDot userId={u.user_id} size="md" />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{u.full_name || u.email}</p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 capitalize">{u.role}</span>
                              {presence?.current_page && presence.status === 'online' && (
                                <>
                                  <span className="text-gray-500">•</span>
                                  <span className="text-[10px] text-orange-500/70">{getPageLabel(presence.current_page)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── BROADCAST VIEW (admin only) ── */}
              {view === 'broadcast' && (
                <div className="p-4 space-y-4">
                  <div className="bg-amber-500/100/15 border border-amber-500/20 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Megaphone className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Broadcast</span>
                    </div>
                    <p className="text-xs text-amber-300/70">This message will be sent to all active users on Scrappy.</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Title</label>
                    <input
                      type="text"
                      value={broadcastName}
                      onChange={(e) => setBroadcastName(e.target.value)}
                      placeholder="e.g. Dollar Rate Update"
                      className="w-full px-3 py-2 bg-[#111111] border border-white/[0.06] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1.5 block">Message</label>
                    <textarea
                      value={broadcastMessage}
                      onChange={(e) => setBroadcastMessage(e.target.value)}
                      placeholder="Type your announcement..."
                      rows={4}
                      className="w-full px-3 py-2 bg-[#111111] border border-white/[0.06] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleBroadcast}
                    disabled={!broadcastName.trim() || !broadcastMessage.trim() || sending}
                    className="w-full py-2.5 bg-amber-500/100 hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                    Send to All Users
                  </button>
                </div>
              )}

              {/* ── CHAT VIEW ── */}
              {view === 'chat' && (
                <div className="flex flex-col min-h-full">
                  {loadingMessages ? (
                    <div className="flex-1 flex items-center justify-center py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 px-4">
                      <div className="w-12 h-12 rounded-full bg-orange-500/100/10 flex items-center justify-center mb-3">
                        <MessageCircle className="w-6 h-6 text-orange-500" />
                      </div>
                      <p className="text-sm text-gray-400 font-medium text-center">No messages yet</p>
                      <p className="text-xs text-gray-500 mt-1">Send a message to start the conversation</p>
                    </div>
                  ) : (
                    <div className="p-3 space-y-1">
                      {messages.map((msg, idx) => {
                        const isMe = msg.sender_id === currentUserId
                        const isSystem = msg.message_type === 'system'
                        const showSender = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id)
                        const pageContext = msg.metadata?.page_context

                        // System messages
                        if (isSystem) {
                          return (
                            <div key={msg.id} className="text-center py-2">
                              <span className="text-[10px] text-gray-500 bg-[#1a1a1a]/50 px-3 py-1 rounded-full">
                                {msg.content}
                              </span>
                            </div>
                          )
                        }

                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                            <div className={`max-w-[80%] ${isMe ? 'order-1' : ''}`}>
                              {/* Sender name */}
                              {showSender && (
                                <div className="flex items-center gap-1.5 mb-0.5 px-1">
                                  <span className="text-[10px] font-semibold text-orange-500">{msg.sender_name}</span>
                                  {msg.sender_role === 'admin' && (
                                    <span className="text-[8px] bg-amber-500/100/20 text-amber-400 px-1 py-0.5 rounded font-bold">ADMIN</span>
                                  )}
                                </div>
                              )}

                              {/* Message bubble */}
                              <div className={`relative px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe
                                ? 'bg-orange-500/100 text-white rounded-br-md'
                                : 'bg-[#111111] text-gray-100 rounded-bl-md'
                                } ${msg.is_pinned ? 'ring-1 ring-amber-500/40' : ''}`}>

                                {/* Pinned indicator */}
                                {msg.is_pinned && (
                                  <Pin className="absolute -top-1.5 -right-1.5 w-3 h-3 text-amber-400" />
                                )}

                                {/* Page context tag */}
                                {pageContext && !isMe && (
                                  <div className="flex items-center gap-1 mb-1">
                                    <MapPin className="w-2.5 h-2.5 text-gray-500" />
                                    <span className="text-[9px] text-gray-500">{getPageLabel(pageContext)}</span>
                                  </div>
                                )}

                                {/* ASIN tag */}
                                {msg.metadata?.asin && (
                                  <div className="inline-flex items-center gap-1 bg-[#111111]/10 px-1.5 py-0.5 rounded text-[10px] font-mono mb-1">
                                    <span>ASIN: {msg.metadata.asin}</span>
                                  </div>
                                )}

                                {/* Content */}
                                <p className="break-words whitespace-pre-wrap">{msg.content}</p>

                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {msg.attachments.map(att => (
                                      att.file_type.startsWith('image/') ? (
                                        <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer">
                                          <img src={att.file_url} alt={att.file_name} className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                                        </a>
                                      ) : (
                                        <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-2 bg-[#111111]/10 rounded-lg px-2.5 py-1.5 hover:bg-[#111111]/15 transition-colors">
                                          <Paperclip className="w-3 h-3" />
                                          <span className="text-xs truncate">{att.file_name}</span>
                                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                        </a>
                                      )
                                    ))}
                                  </div>
                                )}

                                {/* Action button */}
                                {msg.message_type === 'action' && msg.metadata?.action_url && (
                                  <button
                                    onClick={() => {
                                      router.push(msg.metadata!.action_url!)
                                      setIsOpen(false)
                                    }}
                                    className="mt-2 inline-flex items-center gap-1.5 bg-[#111111]/15 hover:bg-[#111111]/25 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    {msg.metadata.action_label || 'Open'}
                                  </button>
                                )}

                                {/* Time + read receipt */}
                                <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : ''}`}>
                                  <span className={`text-[9px] ${isMe ? 'text-indigo-200/50' : 'text-gray-500'}`}>
                                    {formatTime(msg.created_at)}
                                  </span>
                                  <ReadReceipt message={msg} />
                                </div>
                              </div>

                              {/* Hover actions */}
                              {/* Hover actions */}
                              <div className={`hidden group-hover:flex items-center gap-0.5 mt-0.5 ${isMe ? 'justify-end' : ''} px-1`}>
                                {(isAdmin || isMe) && (
                                  <>
                                    <button
                                      onClick={() => togglePin(msg.id, !msg.is_pinned)}
                                      className="p-1 hover:bg-[#111111] rounded text-gray-500 hover:text-amber-400 transition-colors"
                                      title={msg.is_pinned ? 'Unpin' : 'Pin'}
                                    >
                                      {msg.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                                    </button>
                                    <button
                                      onClick={() => setConfirmAction({ type: 'deleteMsg', id: msg.id })}
                                      className="p-1 hover:bg-[#111111] rounded text-gray-500 hover:text-red-400 transition-colors"
                                      title="Delete message"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ─── INPUT BAR (only in chat view) ─── */}
            {view === 'chat' && (
              <div className="flex-none border-t border-white/[0.06] bg-[#111111] px-3 py-2.5">
                {/* Action message form (admin only) */}
                <AnimatePresence>
                  {showActionMenu && isAdmin && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-2"
                    >
                      <div className="bg-[#111111] rounded-xl p-3 border border-orange-500/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">Action Message</span>
                          <button onClick={() => setShowActionMenu(false)} className="text-gray-500 hover:text-white">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={actionForm.asin}
                          onChange={(e) => setActionForm(prev => ({ ...prev, asin: e.target.value }))}
                          placeholder="ASIN (optional, e.g. B08XYZ123)"
                          className="w-full px-2.5 py-1.5 bg-[#111111] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <input
                          type="text"
                          value={actionForm.message}
                          onChange={(e) => setActionForm(prev => ({ ...prev, message: e.target.value }))}
                          placeholder="Message (e.g. Please re-check this ASIN)"
                          className="w-full px-2.5 py-1.5 bg-[#111111] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        <div className="flex gap-2">
                          <select
                            value={actionForm.url}
                            onChange={(e) => setActionForm(prev => ({ ...prev, url: e.target.value }))}
                            className="flex-1 px-2.5 py-1.5 bg-[#111111] border border-white/[0.06] rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                          >
                            <optgroup label="India Selling">
                              <option value="/dashboard/india-selling/brand-checking">Brand Checking</option>
                              <option value="/dashboard/india-selling/validation">Validation</option>
                              <option value="/dashboard/india-selling/listing-error">Listing Errors</option>
                              <option value="/dashboard/india-selling/purchases">Purchases</option>
                              <option value="/dashboard/india-selling/tracking">Tracking</option>
                              <option value="/dashboard/india-selling/restock">Restock</option>
                              <option value="/dashboard/india-selling/reorder">Reorder</option>
                              <option value="/dashboard/india-selling/admin-validation">Admin Approvals</option>
                            </optgroup>
                            <optgroup label="USA Selling">
                              <option value="/dashboard/usa-selling/brand-checking">Brand Checking</option>
                              <option value="/dashboard/usa-selling/validation">Validation</option>
                              <option value="/dashboard/usa-selling/listing-error">Listing Errors</option>
                              <option value="/dashboard/usa-selling/purchases">Purchases</option>
                              <option value="/dashboard/usa-selling/tracking">Tracking</option>
                              <option value="/dashboard/usa-selling/reorder">Reorder</option>
                              <option value="/dashboard/usa-selling/admin-validation">Admin Approvals</option>
                            </optgroup>
                            <optgroup label="UK Selling">
                              <option value="/dashboard/uk-selling/brand-checking">Brand Checking</option>
                              <option value="/dashboard/uk-selling/validation">Validation</option>
                              <option value="/dashboard/uk-selling/listing-error">Listing Errors</option>
                              <option value="/dashboard/uk-selling/purchases">Purchases</option>
                              <option value="/dashboard/uk-selling/tracking">Tracking</option>
                              <option value="/dashboard/uk-selling/reorder">Reorder</option>
                              <option value="/dashboard/uk-selling/admin-validation">Admin Approvals</option>
                            </optgroup>
                            <optgroup label="UAE Selling">
                              <option value="/dashboard/uae-selling/brand-checking">Brand Checking</option>
                              <option value="/dashboard/uae-selling/validation">Validation</option>
                              <option value="/dashboard/uae-selling/listing-error">Listing Errors</option>
                              <option value="/dashboard/uae-selling/purchases">Purchases</option>
                              <option value="/dashboard/uae-selling/tracking">Tracking</option>
                              <option value="/dashboard/uae-selling/reorder">Reorder</option>
                              <option value="/dashboard/uae-selling/admin-validation">Admin Approvals</option>
                            </optgroup>
                            <optgroup label="Flipkart">
                              <option value="/dashboard/flipkart/brand-checking">Brand Checking</option>
                              <option value="/dashboard/flipkart/validation">Validation</option>
                              <option value="/dashboard/flipkart/listing-error">Listing Errors</option>
                              <option value="/dashboard/flipkart/purchases">Purchases</option>
                              <option value="/dashboard/flipkart/tracking">Tracking</option>
                              <option value="/dashboard/flipkart/reorder">Reorder</option>
                              <option value="/dashboard/flipkart/admin-validation">Admin Approvals</option>
                            </optgroup>
                            <optgroup label="Other">
                              <option value="/dashboard">Dashboard</option>
                              <option value="/dashboard/manage-sellers">Manage Sellers</option>
                            </optgroup>
                          </select>
                          <input
                            type="text"
                            value={actionForm.label}
                            onChange={(e) => setActionForm(prev => ({ ...prev, label: e.target.value }))}
                            placeholder="Button text"
                            className="w-28 px-2.5 py-1.5 bg-[#111111] border border-white/[0.06] rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>
                        <button
                          onClick={handleSendAction}
                          disabled={!actionForm.message.trim() || sending}
                          className="w-full py-2 bg-orange-500/100 hover:bg-orange-400 disabled:opacity-40 text-white font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                          {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                          Send Action Message
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Attachment preview */}
                {attachmentFile && (
                  <div className="flex items-center gap-2 mb-2 p-2 bg-[#111111] rounded-lg">
                    {attachmentPreview ? (
                      <img src={attachmentPreview} alt="preview" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <Paperclip className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-500 truncate flex-1">{attachmentFile.name}</span>
                    <button onClick={clearAttachment} className="text-gray-500 hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* Action menu trigger (admin only) */}
                  {isAdmin && (
                    <button
                      onClick={() => setShowActionMenu(!showActionMenu)}
                      className={`p-1.5 rounded-lg transition-colors ${showActionMenu ? 'text-orange-500 bg-orange-500/100/10' : 'text-gray-500 hover:text-orange-500 hover:bg-[#111111]'}`}
                      title="Send action message"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}

                  {/* File attach */}
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xlsx" onChange={handleFileSelect} className="hidden" />
                  <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-gray-500 hover:text-orange-500 transition-colors rounded-lg hover:bg-[#111111]" title="Attach file">
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Input */}
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 bg-[#111111] border border-white/[0.06] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />

                  {/* Send */}
                  <button
                    onClick={handleSend}
                    disabled={(!inputValue.trim() && !attachmentFile) || sending}
                    className="p-2 bg-orange-500/100 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#111111]/60 z-[60]"
              onClick={() => setConfirmAction(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
            >
              <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-2xl shadow-2xl p-5 w-80 pointer-events-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {confirmAction.type === 'deleteMsg' ? 'Delete Message' :
                        confirmAction.type === 'clear' ? 'Clear Messages' :
                          'Delete Conversation'}
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {confirmAction.type === 'deleteMsg' ? 'This message will be removed for everyone.' :
                        confirmAction.type === 'clear' ? 'All messages will be cleared for everyone.' :
                          'This conversation will be permanently deleted for all participants.'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="flex-1 py-2 bg-[#111111] hover:bg-[#1a1a1a] text-gray-500 rounded-xl text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (confirmAction.type === 'deleteMsg') {
                        await deleteMessage(confirmAction.id)
                      } else if (confirmAction.type === 'clear') {
                        await clearConversation(confirmAction.id)
                      } else if (confirmAction.type === 'delete') {
                        await deleteConversation(confirmAction.id)
                        setView('list')
                      }
                      setConfirmAction(null)
                    }}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    {confirmAction.type === 'deleteMsg' ? 'Delete' : confirmAction.type === 'clear' ? 'Clear All' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
