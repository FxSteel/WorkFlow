import { useState, useEffect, useRef } from 'react'
import {
  Bell, Check, X, Loader2, Mail, Users, CheckCircle2,
  UserPlus, AtSign, MessageSquare, ClipboardList,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import EmptyState from '../ui/EmptyState'

const TYPE_CONFIG = {
  task_assigned: { icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  mention: { icon: AtSign, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  comment: { icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  invite: { icon: UserPlus, color: 'text-orange-500', bg: 'bg-orange-500/10' },
}

export default function NotificationCenter() {
  const { user } = useAuth()
  const { state, dispatch, openTask } = useApp()
  const { fetchMyInvites, acceptInvite, declineInvite, fetchOrganizations } = useSupabase()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingId, setLoadingId] = useState(null)
  const [activeTab, setActiveTab] = useState('all')
  const ref = useRef(null)

  useEffect(() => {
    if (user) {
      loadAll()
      // Poll every 30 seconds
      const interval = setInterval(loadAll, 30000)
      return () => clearInterval(interval)
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadAll = async () => {
    setLoading(true)
    const [notifResult, inviteResult] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
      fetchMyInvites(user.email),
    ])
    if (notifResult.data) setNotifications(notifResult.data)
    if (inviteResult?.data) setInvites(inviteResult.data)
    setLoading(false)
  }

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const handleAcceptInvite = async (invite) => {
    setLoadingId(invite.id)
    const userName = user.user_metadata?.full_name || user.email.split('@')[0]
    await acceptInvite(invite.id, invite.org_id, user.id, userName, user.email, invite.role, invite.workspace_ids)
    setInvites(prev => prev.filter(i => i.id !== invite.id))
    await fetchOrganizations()
    setLoadingId(null)
  }

  const handleDeclineInvite = async (invite) => {
    setLoadingId(invite.id)
    await declineInvite(invite.id)
    setInvites(prev => prev.filter(i => i.id !== invite.id))
    setLoadingId(null)
  }

  const handleNotificationClick = async (notif) => {
    markAsRead(notif.id)
    if (notif.task_id) {
      // Fetch task with its board info
      const { data: task } = await supabase
        .from('tasks')
        .select('*, boards(name, workspace_id)')
        .eq('id', notif.task_id)
        .single()

      if (task) {
        // Navigate to the correct workspace and board
        const wsId = notif.workspace_id || task.boards?.workspace_id
        const ws = state.workspaces.find(w => w.id === wsId)
        if (ws) dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: ws })
        if (task.boards) {
          dispatch({ type: 'SET_CURRENT_BOARD', payload: { id: task.board_id, name: task.boards.name, workspace_id: wsId } })
        }
        // Small delay to let board load, then open task
        setTimeout(() => openTask(task), 300)
      }
    }
    setIsOpen(false)
  }

  const unreadCount = notifications.filter(n => !n.read).length + invites.length

  const timeAgo = (dateStr) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diff = Math.floor((now - date) / 1000)
    if (diff < 60) return 'Ahora'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) loadAll() }}
        className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-96 rounded-xl border border-border bg-popover shadow-lg z-50 animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Marcar todo como leído
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'unread', label: `Sin leer (${notifications.filter(n => !n.read).length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 py-2 text-xs font-medium transition-colors relative',
                  activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t" />}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              </div>
            ) : (
              <>
                {/* Invites */}
                {invites.length > 0 && activeTab === 'all' && (
                  <div>
                    {invites.map(invite => (
                      <div key={invite.id} className="px-4 py-3 border-b border-border bg-primary/5 hover:bg-accent/30 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', TYPE_CONFIG.invite.bg)}>
                            <UserPlus className={cn('w-4 h-4', TYPE_CONFIG.invite.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">
                              Te invitaron a <span className="font-semibold">{invite.organizations?.name || 'Organizacion'}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Por: {invite.invited_by_name}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                onClick={() => handleAcceptInvite(invite)}
                                disabled={loadingId === invite.id}
                                className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                              >
                                {loadingId === invite.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Aceptar
                              </button>
                              <button
                                onClick={() => handleDeclineInvite(invite)}
                                disabled={loadingId === invite.id}
                                className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                Rechazar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notifications */}
                {filteredNotifications.length === 0 && invites.length === 0 && (
                  <EmptyState
                    title={activeTab === 'unread' ? 'Sin notificaciones nuevas' : 'Sin notificaciones'}
                    description="Aqui veran menciones, asignaciones y actualizaciones."
                    compact
                  />
                )}

                {filteredNotifications.map(notif => {
                  const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.task_assigned
                  const Icon = config.icon
                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        'w-full px-4 py-3 border-b border-border text-left transition-colors flex items-start gap-3',
                        notif.read ? 'hover:bg-accent/30' : 'bg-primary/5 hover:bg-accent/30'
                      )}
                    >
                      {notif.from_user_avatar ? (
                        <img src={notif.from_user_avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
                          <Icon className={cn('w-4 h-4', config.color)} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('text-sm truncate', notif.read ? 'text-foreground' : 'text-foreground font-medium')}>
                            {notif.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(notif.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                      )}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
