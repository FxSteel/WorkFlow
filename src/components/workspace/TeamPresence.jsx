import { useState, useEffect, useRef } from 'react'
import { Users, ChevronDown, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

const STATUS_ORDER = { online: 0, idle: 1, dnd: 2, invisible: 3 }
const OFFLINE_THRESHOLD = 3 * 60 * 1000 // 3 min without heartbeat = offline

const STATUS_INDICATOR = {
  online: { color: 'bg-emerald-500', label: 'En linea' },
  idle: { color: 'bg-yellow-500', label: 'Ausente' },
  dnd: { color: 'bg-red-500', label: 'No molestar' },
  invisible: { color: 'bg-gray-400', label: 'Desconectado' },
  offline: { color: 'bg-gray-400', label: 'Desconectado' },
}

export default function TeamPresence() {
  const { state } = useApp()
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [collapsed, setCollapsed] = useState({ online: false, offline: false })

  // Fetch members with presence for current org
  useEffect(() => {
    if (!state.currentOrg) {
      setMembers([])
      return
    }
    fetchPresence()
    const interval = setInterval(fetchPresence, 15000)
    // Refresh immediately when status changes locally
    const onPresenceChanged = () => fetchPresence()
    window.addEventListener('presence-changed', onPresenceChanged)
    return () => {
      clearInterval(interval)
      window.removeEventListener('presence-changed', onPresenceChanged)
    }
  }, [state.currentOrg?.id])

  const fetchPresence = async () => {
    if (!state.currentOrg) return
    const { data } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', state.currentOrg.id)
      .order('name')
    if (data) setMembers(data)
  }

  const getEffectiveStatus = (member) => {
    // Manual status (dnd) takes priority
    if (member.status === 'dnd') return 'dnd'
    if (member.status === 'invisible') return 'offline'

    // Check last_active to determine if truly online
    if (!member.last_active) return 'offline'
    const lastActive = new Date(member.last_active).getTime()
    const now = Date.now()
    const elapsed = now - lastActive

    if (elapsed > OFFLINE_THRESHOLD) return 'offline'
    if (member.status === 'idle') return 'idle'
    return member.status === 'online' ? 'online' : 'offline'
  }

  const onlineMembers = members
    .map(m => ({ ...m, effectiveStatus: getEffectiveStatus(m) }))
    .filter(m => ['online', 'idle', 'dnd'].includes(m.effectiveStatus))
    .sort((a, b) => STATUS_ORDER[a.effectiveStatus] - STATUS_ORDER[b.effectiveStatus])

  const offlineMembers = members
    .map(m => ({ ...m, effectiveStatus: getEffectiveStatus(m) }))
    .filter(m => m.effectiveStatus === 'offline')

  if (members.length === 0) return null

  return (
    <div className="px-2 py-2 border-t border-sidebar-border">
      {/* Online section */}
      <button
        onClick={() => setCollapsed(p => ({ ...p, online: !p.online }))}
        className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        {collapsed.online ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        En linea — {onlineMembers.length}
      </button>

      {!collapsed.online && (
        <div className="space-y-0.5 mb-2">
          {onlineMembers.map(member => (
            <MemberRow key={member.id} member={member} isCurrentUser={member.user_id === user?.id} />
          ))}
          {onlineMembers.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-muted-foreground/50">Nadie en linea</p>
          )}
        </div>
      )}

      {/* Offline section */}
      {offlineMembers.length > 0 && (
        <>
          <button
            onClick={() => setCollapsed(p => ({ ...p, offline: !p.offline }))}
            className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          >
            {collapsed.offline ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Desconectado — {offlineMembers.length}
          </button>

          {!collapsed.offline && (
            <div className="space-y-0.5">
              {offlineMembers.map(member => (
                <MemberRow key={member.id} member={member} isCurrentUser={member.user_id === user?.id} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MemberRow({ member, isCurrentUser }) {
  const status = STATUS_INDICATOR[member.effectiveStatus] || STATUS_INDICATOR.offline

  return (
    <div className={cn(
      'flex items-center gap-2 px-2 py-1 rounded-md transition-colors',
      'hover:bg-accent/50'
    )}>
      {/* Avatar with status */}
      <div className="relative shrink-0">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: member.color || '#6c5ce7' }}
          >
            {member.name?.[0]?.toUpperCase()}
          </div>
        )}
        {/* Status dot */}
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-sidebar',
          status.color
        )}>
          {member.effectiveStatus === 'dnd' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-[55%] h-[1.5px] rounded-full bg-white" />
            </span>
          )}
          {member.effectiveStatus === 'idle' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-[35%] h-[35%] rounded-full bg-sidebar absolute top-[12%] left-[12%]" />
            </span>
          )}
        </span>
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs truncate',
          member.effectiveStatus === 'offline' ? 'text-muted-foreground/60' : 'text-sidebar-foreground'
        )}>
          {member.name}
          {isCurrentUser && <span className="text-muted-foreground ml-1">(tu)</span>}
        </p>
      </div>

      {/* Role badge */}
      {(member.role === 'admin' || member.role === 'owner') && (
        <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
          {member.role === 'owner' ? 'Owner' : 'Admin'}
        </span>
      )}
    </div>
  )
}
