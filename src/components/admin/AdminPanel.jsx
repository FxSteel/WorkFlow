import { useState, useEffect, useRef } from 'react'
import {
  Users, LayoutDashboard, CheckSquare, CreditCard,
  Search, Shield, Loader2, ChevronDown, ChevronUp,
  Sun, Moon, Check,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

// Only these emails can access admin panel
const ADMIN_EMAILS = ['fernando@nova-ai.cl']

export default function AdminPanel() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedUser, setExpandedUser] = useState(null)
  const [stats, setStats] = useState({ users: 0, organizations: 0, workspaces: 0, tasks: 0, activeSubs: 0 })

  // Auth check
  const isAuthorized = user && ADMIN_EMAILS.includes(user.email)

  useEffect(() => {
    if (isAuthorized) {
      fetchData()
    }
  }, [isAuthorized])

  const fetchData = async () => {
    setLoading(true)

    // Fetch all users with auth admin
    let allUsers = []
    if (supabaseAdmin) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      if (data?.users) allUsers = data.users
    }

    // Use admin client to bypass RLS and see ALL data
    const adminClient = supabaseAdmin || supabase

    // Fetch org_members (to get org counts per user)
    const { data: members } = await adminClient.from('org_members').select('user_id, org_id')

    // Fetch all organizations
    const { data: organizations } = await adminClient.from('organizations').select('id, owner_id')

    // Fetch all workspaces
    const { data: workspaces } = await adminClient.from('workspaces').select('id, owner_id, org_id')

    // Fetch tasks with assignee info
    const { data: tasks } = await adminClient.from('tasks').select('id, assignee_id, board_id, boards(workspace_id)')

    // Fetch subscriptions
    const { data: subs } = await adminClient.from('subscriptions').select('*').order('created_at', { ascending: false })

    // Build user data
    const enrichedUsers = allUsers.map(u => {
      // Orgs where user is owner
      const ownedOrgs = organizations?.filter(o => o.owner_id === u.id) || []
      const ownedOrgIds = ownedOrgs.map(o => o.id)

      // Workspaces in orgs the user owns
      const ownedWorkspaces = workspaces?.filter(w => ownedOrgIds.includes(w.org_id)) || []
      const ownedWsIds = ownedWorkspaces.map(w => w.id)

      // Tasks in workspaces the user owns
      const orgTasks = tasks?.filter(t => {
        const wsId = t.boards?.workspace_id
        return ownedWsIds.includes(wsId)
      }) || []

      const userSub = subs?.find(s => s.user_id === u.id)

      return {
        id: u.id,
        email: u.email,
        name: u.user_metadata?.full_name || u.email?.split('@')[0] || '',
        avatar: u.user_metadata?.avatar_url,
        provider: u.app_metadata?.provider || 'email',
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
        orgCount: ownedOrgs.length,
        workspaceCount: ownedWorkspaces.length,
        taskCount: orgTasks.length,
        subscription: userSub,
        banned: u.banned_until ? true : false,
      }
    })

    setUsers(enrichedUsers)

    // Stats
    const activeSubs = subs?.filter(s => s.status === 'active').length || 0
    setStats({
      users: allUsers.length,
      organizations: organizations?.length || 0,
      workspaces: workspaces?.length || 0,
      tasks: tasks?.length || 0,
      activeSubs,
    })

    setLoading(false)
  }

  const handleToggleSubscription = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'expired' : 'active'
    const sub = users.find(u => u.id === userId)?.subscription

    if (sub) {
      await supabase.from('subscriptions').update({
        status: newStatus,
        current_period_end: newStatus === 'active'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : new Date().toISOString(),
      }).eq('id', sub.id)
    } else if (newStatus === 'active') {
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan: 'pro',
        status: 'active',
        amount: 25000,
        currency: 'CLP',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    toast.success(newStatus === 'active' ? 'Suscripción activada' : 'Suscripción desactivada')
    fetchData()
  }

  const handleBanUser = async (userId, ban) => {
    if (!supabaseAdmin) return
    if (ban) {
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }) // ~100 years
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
    }
    toast.success(ban ? 'Usuario bloqueado' : 'Usuario desbloqueado')
    fetchData()
  }

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  // Not authorized
  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Acceso denegado</h1>
          <p className="text-sm text-muted-foreground">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    )
  }

  const filteredUsers = users
    .filter(u =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'subscription') {
        valA = a.subscription?.status || 'none'
        valB = b.subscription?.status || 'none'
      }
      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }
      return sortDir === 'asc' ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0)
    })

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={theme === 'dark'
                ? 'https://fkhukpqhmpudsarnusvf.supabase.co/storage/v1/object/public/attachments/w-icons/w4-blanco.png'
                : 'https://fkhukpqhmpudsarnusvf.supabase.co/storage/v1/object/public/attachments/w-icons/w-negro.png'
              }
              alt="WorkFlow"
              className="w-8 h-8 rounded-lg"
            />
            <div>
              <h1 className="text-lg font-bold text-foreground">WorkFlow Admin</h1>
              <p className="text-[11px] text-muted-foreground">Panel de administración</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <a href="/" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
              Volver a WorkFlow
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Usuarios', value: stats.users, icon: Users, color: 'text-blue-500' },
            { label: 'Organizaciones', value: stats.organizations, icon: LayoutDashboard, color: 'text-purple-500' },
            { label: 'Tareas', value: stats.tasks, icon: CheckSquare, color: 'text-emerald-500' },
            { label: 'Suscripciones activas', value: stats.activeSubs, icon: CreditCard, color: 'text-orange-500' },
          ].map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={cn('w-4 h-4', stat.color)} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? '...' : stat.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualizar'}
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {[
                    { key: 'name', label: 'Usuario' },
                    { key: 'orgCount', label: 'Orgs' },
                    { key: 'taskCount', label: 'Tareas' },
                    { key: 'subscription', label: 'Suscripcion' },
                    { key: 'created_at', label: 'Registro' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => col.key !== 'actions' && toggleSort(col.key)}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider',
                        col.key !== 'actions' && 'cursor-pointer hover:text-foreground transition-colors'
                      )}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortBy === col.key && (
                          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center">
                      <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => {
                    const subStatus = u.subscription?.status || 'none'
                    return (
                      <tr key={u.id} className={cn('border-b border-border hover:bg-accent/30 transition-colors', u.banned && 'opacity-50')}>
                        {/* User */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                {u.name?.[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-foreground">{u.name}</p>
                              <p className="text-[11px] text-muted-foreground">{u.email}</p>
                            </div>
                            {u.banned && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-destructive/10 text-destructive">Bloqueado</span>
                            )}
                          </div>
                        </td>
                        {/* Orgs */}
                        <td className="px-4 py-3 text-sm text-foreground">{u.orgCount}</td>
                        {/* Tasks */}
                        <td className="px-4 py-3 text-sm text-foreground">{u.taskCount}</td>
                        {/* Subscription — dropdown */}
                        <td className="px-4 py-3">
                          <SubStatusDropdown
                            userId={u.id}
                            status={subStatus}
                            subscription={u.subscription}
                            onUpdate={fetchData}
                          />
                        </td>
                        {/* Created */}
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} encontrado{filteredUsers.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

const SUB_OPTIONS = [
  { value: 'active', label: 'Activa', color: 'bg-success/10 text-success', dot: 'bg-emerald-500' },
  { value: 'pending', label: 'Pendiente', color: 'bg-warning/10 text-warning', dot: 'bg-yellow-500' },
  { value: 'cancelled', label: 'Cancelada', color: 'bg-destructive/10 text-destructive', dot: 'bg-red-500' },
  { value: 'expired', label: 'Expirada', color: 'bg-orange-500/10 text-orange-500', dot: 'bg-orange-500' },
  { value: 'none', label: 'Sin plan', color: 'bg-muted text-muted-foreground', dot: 'bg-gray-400' },
]

function SubStatusDropdown({ userId, status, subscription, onUpdate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const current = SUB_OPTIONS.find(o => o.value === status) || SUB_OPTIONS[4]

  const handleChange = async (newStatus) => {
    setOpen(false)
    if (newStatus === status) return

    if (subscription) {
      await supabase.from('subscriptions').update({
        status: newStatus === 'none' ? 'cancelled' : newStatus,
        current_period_end: newStatus === 'active'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : subscription.current_period_end,
      }).eq('id', subscription.id)
    } else if (newStatus === 'active') {
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan: 'pro',
        status: 'active',
        amount: 25000,
        currency: 'CLP',
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
    }

    toast.success(`Suscripción actualizada a "${SUB_OPTIONS.find(o => o.value === newStatus)?.label}"`)
    onUpdate?.()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-opacity hover:opacity-80', current.color)}
      >
        {current.label}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-40 rounded-lg border border-border bg-popover shadow-lg py-1 z-50 animate-scale-in">
          {SUB_OPTIONS.filter(o => o.value !== 'none' || status === 'none').map(opt => (
            <button
              key={opt.value}
              onClick={() => handleChange(opt.value)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors',
                status === opt.value ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              <div className={cn('w-2 h-2 rounded-full', opt.dot)} />
              {opt.label}
              {status === opt.value && <Check className="w-3 h-3 ml-auto text-foreground" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
