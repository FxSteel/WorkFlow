import { useState, useRef, useEffect, useCallback } from 'react'
import { Sun, Moon, Filter, SortAsc, Plus, LogOut, User, Settings, ChevronRight, Clock } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import NotificationCenter from '../workspace/NotificationCenter'
import StatusAvatar, { STATUS_CONFIG } from '../ui/StatusAvatar'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

const DURATION_OPTIONS = [
  { label: '15 minutos', ms: 15 * 60 * 1000 },
  { label: '1 hora', ms: 60 * 60 * 1000 },
  { label: '8 horas', ms: 8 * 60 * 60 * 1000 },
  { label: '24 horas', ms: 24 * 60 * 60 * 1000 },
  { label: '3 días', ms: 3 * 24 * 60 * 60 * 1000 },
  { label: 'Indefinido', ms: null },
]

const STATUS_DESCRIPTIONS = {
  online: null,
  idle: null,
  dnd: 'No recibirás notificaciones',
  invisible: 'Aparecerás como desconectado',
}

export default function Topbar({ onNewTask, onNewSprint, onOpenSettings, onOpenProfile }) {
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()
  const { state } = useApp()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [durationSubmenu, setDurationSubmenu] = useState(null) // status key
  const [userStatus, setUserStatus] = useState(() =>
    localStorage.getItem('workflow-user-status') || 'online'
  )
  const [statusExpiry, setStatusExpiry] = useState(() => {
    const exp = localStorage.getItem('workflow-status-expiry')
    return exp ? Number(exp) : null
  })
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
        setShowStatusPicker(false)
        setDurationSubmenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-revert status when duration expires
  useEffect(() => {
    if (!statusExpiry) return
    const remaining = statusExpiry - Date.now()
    if (remaining <= 0) {
      changeStatus('online', null)
      return
    }
    const timer = setTimeout(() => changeStatus('online', null), remaining)
    return () => clearTimeout(timer)
  }, [statusExpiry])

  const changeStatus = useCallback(async (status, durationMs) => {
    setUserStatus(status)
    localStorage.setItem('workflow-user-status', status)

    if (durationMs) {
      const expiry = Date.now() + durationMs
      setStatusExpiry(expiry)
      localStorage.setItem('workflow-status-expiry', String(expiry))
    } else {
      setStatusExpiry(null)
      localStorage.removeItem('workflow-status-expiry')
    }

    setShowStatusPicker(false)
    setDurationSubmenu(null)

    if (user?.id) {
      await supabase
        .from('members')
        .update({ status })
        .eq('user_id', user.id)
    }
  }, [user])

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'
  const userAvatar = user?.user_metadata?.avatar_url

  const handleSignOut = async () => {
    await changeStatus('invisible', null)
    await signOut()
    setShowUserMenu(false)
  }

  // Which statuses show duration submenu
  const hasDuration = (status) => status === 'idle' || status === 'dnd'

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        {state.currentBoard ? (
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-foreground">
              {state.currentBoard.name}
            </h1>
            <div className="flex items-center gap-1">
              <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                <Filter className="w-3.5 h-3.5" />
                Filtrar
              </button>
              <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                <SortAsc className="w-3.5 h-3.5" />
                Ordenar
              </button>
            </div>
          </div>
        ) : (
          <h1 className="text-lg font-semibold text-foreground">
            {state.currentWorkspace ? state.currentWorkspace.name : ''}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        {state.currentBoard && (
          <>
            <button
              onClick={onNewSprint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Sprint
            </button>
            <button
              onClick={onNewTask}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva tarea
            </button>
          </>
        )}

        <div className="w-px h-6 bg-border mx-1" />

        <NotificationCenter />

        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
        >
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <StatusAvatar
            src={userAvatar}
            name={userName}
            size="md"
            status={userStatus}
            onClick={() => {
              setShowUserMenu(!showUserMenu)
              setShowStatusPicker(false)
              setDurationSubmenu(null)
            }}
          />

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-1 w-72 rounded-xl border border-border bg-popover shadow-lg py-1 z-50 animate-scale-in">
              {/* User info */}
              <div className="px-3 py-3 border-b border-border flex items-center gap-3">
                <StatusAvatar
                  src={userAvatar}
                  name={userName}
                  size="lg"
                  status={userStatus}
                  showStatus={true}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  {statusExpiry && userStatus !== 'online' && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      Revierte {formatExpiry(statusExpiry)}
                    </p>
                  )}
                </div>
              </div>

              {/* Status dropdown */}
              <div className="px-3 py-2 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Estado</span>
                <div className="relative mt-1.5">
                  <button
                    onClick={() => { setShowStatusPicker(!showStatusPicker); setDurationSubmenu(null) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                  >
                    <StatusDot status={userStatus} />
                    <span className="text-sm text-foreground flex-1 text-left">{STATUS_CONFIG[userStatus]?.label}</span>
                    {statusExpiry && userStatus !== 'online' && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatExpiry(statusExpiry)}
                      </span>
                    )}
                    <ChevronRight className={cn(
                      'w-3.5 h-3.5 text-muted-foreground transition-transform',
                      showStatusPicker && 'rotate-90'
                    )} />
                  </button>

                  {showStatusPicker && (
                    <div className="absolute left-0 right-0 top-full mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden z-10 animate-scale-in">
                      {/* Online */}
                      <StatusOption
                        status="online"
                        current={userStatus}
                        onClick={() => changeStatus('online', null)}
                      />

                      {/* Idle */}
                      <StatusOptionWithDuration
                        status="idle"
                        current={userStatus}
                        durationSubmenu={durationSubmenu}
                        setDurationSubmenu={setDurationSubmenu}
                        onSelectDuration={(ms) => changeStatus('idle', ms)}
                      />

                      {/* DND */}
                      <StatusOptionWithDuration
                        status="dnd"
                        current={userStatus}
                        durationSubmenu={durationSubmenu}
                        setDurationSubmenu={setDurationSubmenu}
                        onSelectDuration={(ms) => changeStatus('dnd', ms)}
                      />

                      {/* Invisible */}
                      <StatusOption
                        status="invisible"
                        current={userStatus}
                        onClick={() => changeStatus('invisible', null)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="py-1">
                <button
                  onClick={() => { onOpenProfile?.(); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <User className="w-4 h-4 text-muted-foreground" />
                  Mi perfil
                </button>
                <button
                  onClick={() => { onOpenSettings?.(); setShowUserMenu(false) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" />
                  Configuración
                </button>
              </div>
              <div className="border-t border-border py-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function StatusOption({ status, current, onClick }) {
  const config = STATUS_CONFIG[status]
  const description = STATUS_DESCRIPTIONS[status]
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 transition-colors',
        current === status ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      <StatusDot status={status} />
      <div className="flex-1 text-left">
        <span className="text-sm text-foreground">{config.label}</span>
        {description && (
          <p className="text-[11px] text-muted-foreground leading-tight">{description}</p>
        )}
      </div>
      {current === status && (
        <span className="text-[10px] text-muted-foreground">Actual</span>
      )}
    </button>
  )
}

function StatusOptionWithDuration({ status, current, durationSubmenu, setDurationSubmenu, onSelectDuration }) {
  const config = STATUS_CONFIG[status]
  const description = STATUS_DESCRIPTIONS[status]
  const isExpanded = durationSubmenu === status

  return (
    <div className="relative">
      <button
        onClick={() => setDurationSubmenu(isExpanded ? null : status)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 transition-colors',
          current === status ? 'bg-accent' : 'hover:bg-accent/50'
        )}
      >
        <StatusDot status={status} />
        <div className="flex-1 text-left">
          <span className="text-sm text-foreground">{config.label}</span>
          {description && (
            <p className="text-[11px] text-muted-foreground leading-tight">{description}</p>
          )}
        </div>
        <ChevronRight className={cn(
          'w-3.5 h-3.5 text-muted-foreground transition-transform',
          isExpanded && 'rotate-90'
        )} />
      </button>

      {/* Duration submenu */}
      {isExpanded && (
        <div className="mx-2 mb-1 rounded-lg border border-border bg-card overflow-hidden animate-scale-in">
          {DURATION_OPTIONS.map((opt, i) => (
            <button
              key={i}
              onClick={() => onSelectDuration(opt.ms)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-accent/50 transition-colors"
            >
              <Clock className="w-3 h-3 text-muted-foreground" />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }) {
  const dotColors = {
    online: 'bg-emerald-500',
    idle: 'bg-yellow-500',
    dnd: 'bg-red-500',
    invisible: 'border-2 border-gray-400 dark:border-gray-500',
  }

  return (
    <span className="relative w-3.5 h-3.5 flex items-center justify-center shrink-0">
      <span className={cn(
        'w-3.5 h-3.5 rounded-full',
        dotColors[status] || dotColors.online
      )}>
        {status === 'dnd' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-[55%] h-[2px] rounded-full bg-white" />
          </span>
        )}
        {status === 'idle' && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-[40%] h-[40%] rounded-full bg-popover absolute top-[12%] left-[12%]" />
          </span>
        )}
      </span>
    </span>
  )
}

function formatExpiry(expiry) {
  const diff = expiry - Date.now()
  if (diff <= 0) return 'ahora'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `en ${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `en ${hours}h`
  const days = Math.round(hours / 24)
  return `en ${days}d`
}
