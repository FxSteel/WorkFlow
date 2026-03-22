import { useState, useEffect } from 'react'
import {
  X, Mail, UserPlus, Send, Loader2, CheckCircle2,
  AlertCircle, Clock, Trash2, Users, Shield,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

const ROLE_OPTIONS = [
  { value: 'member', label: 'Miembro', description: 'Puede ver y editar tareas' },
  { value: 'admin', label: 'Admin', description: 'Puede gestionar el espacio' },
]

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  accepted: { label: 'Aceptada', color: 'bg-emerald-500', icon: CheckCircle2 },
  declined: { label: 'Rechazada', color: 'bg-red-500', icon: AlertCircle },
}

export default function InviteModal({ isOpen, onClose, workspace }) {
  const { state } = useApp()
  const { user } = useAuth()
  const { fetchInvites, createInvite, deleteInvite, fetchMembers } = useSupabase()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('invite')

  useEffect(() => {
    if (isOpen && workspace) {
      fetchInvites(workspace.id)
      fetchMembers(workspace.id)
      setError('')
      setSuccess('')
    }
  }, [isOpen, workspace])

  if (!isOpen || !workspace) return null

  const isOwner = workspace.owner_id === user?.id

  const handleSendInvite = async () => {
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError('Ingresa un correo electrónico')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Ingresa un correo válido')
      return
    }

    // Check if already invited
    const alreadyInvited = state.invites.find(
      i => i.email === email.trim() && i.status === 'pending'
    )
    if (alreadyInvited) {
      setError('Ya existe una invitación pendiente para este correo')
      return
    }

    // Check if already a member
    const alreadyMember = state.members.find(m => m.email === email.trim())
    if (alreadyMember) {
      setError('Este usuario ya es miembro del espacio')
      return
    }

    setSending(true)
    const inviteEmail = email.trim().toLowerCase()

    // 1. Save invite record in DB
    const { error: inviteError } = await createInvite({
      workspace_id: workspace.id,
      email: inviteEmail,
      role,
      invited_by: user.id,
      invited_by_name: user.user_metadata?.full_name || user.email,
      status: 'pending',
    })

    if (inviteError) {
      setError(inviteError.message)
      setSending(false)
      return
    }

    // 2. Send invite email via Supabase Admin (inviteUserByEmail)
    if (supabaseAdmin) {
      const senderName = user.user_metadata?.full_name || user.email
      const senderInitials = senderName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

      const { error: inviteEmailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(inviteEmail, {
        redirectTo: window.location.origin,
        data: {
          invited_to_workspace: workspace.name,
          invited_by: senderName,
          invited_by_initials: senderInitials,
        },
      })

      if (inviteEmailError) {
        // If user already exists, that's fine — invite is saved
        if (inviteEmailError.message?.includes('already been registered')) {
          const msg = `Invitación enviada a ${inviteEmail} (ya tiene cuenta)`
          setSuccess(msg)
          toast.success(msg)
        } else {
          const msg = `Invitación guardada para ${inviteEmail} (el correo no pudo enviarse)`
          setSuccess(msg)
          toast.success(msg)
        }
      } else {
        const msg = `Invitación enviada a ${inviteEmail}`
        setSuccess(msg)
        toast.success(msg)
      }
    } else {
      const msg = `Invitación guardada para ${inviteEmail}`
      setSuccess(msg)
      toast.success(msg)
    }
    setTimeout(() => setSuccess(''), 3000)

    setEmail('')
    setRole('member')
    fetchInvites(workspace.id)
    setSending(false)
  }

  const handleDeleteInvite = async (inviteId) => {
    await deleteInvite(inviteId)
    fetchInvites(workspace.id)
  }

  const pendingInvites = state.invites.filter(i => i.status === 'pending')
  const pastInvites = state.invites.filter(i => i.status !== 'pending')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-card rounded-xl shadow-2xl border border-border animate-scale-in max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: workspace.color || '#6c5ce7' }}
            >
              {workspace.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-card-foreground">{workspace.name}</h2>
              <p className="text-xs text-muted-foreground">Gestionar miembros e invitaciones</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: 'invite', label: 'Invitar', icon: UserPlus },
            { id: 'pending', label: `Pendientes (${pendingInvites.length})`, icon: Clock },
            { id: 'members', label: `Miembros (${state.members.length})`, icon: Users },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Invite Tab */}
          {activeTab === 'invite' && (
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 animate-scale-in">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 border border-success/20 animate-scale-in">
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  <span className="text-sm text-success">{success}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); setSuccess('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendInvite() }}
                    placeholder="usuario@ejemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Rol
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setRole(opt.value)}
                      className={cn(
                        'flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all',
                        role === opt.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-muted-foreground/40'
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Shield className={cn(
                          'w-3.5 h-3.5',
                          role === opt.value ? 'text-primary' : 'text-muted-foreground'
                        )} />
                        <span className={cn(
                          'text-sm font-medium',
                          role === opt.value ? 'text-primary' : 'text-foreground'
                        )}>
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5">
                        {opt.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSendInvite}
                disabled={sending || !email.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar invitación
                  </>
                )}
              </button>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="px-6 py-4">
              {state.members.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay miembros todavía</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {state.members.map(member => {
                    const isOwner = member.user_id === workspace.owner_id
                    return (
                    <div key={member.id} className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isOwner ? 'bg-primary/5 border border-primary/10' : 'hover:bg-accent/50'
                    )}>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                        style={{ backgroundColor: member.color || '#6c5ce7' }}
                      >
                        {member.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-medium capitalize',
                        isOwner ? 'bg-primary/10 text-primary font-semibold' : 'bg-muted text-muted-foreground'
                      )}>
                        {isOwner ? 'Owner' : member.role || 'member'}
                      </span>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pending Invites Tab */}
          {activeTab === 'pending' && (
            <div className="px-6 py-4">
              {state.invites.length === 0 ? (
                <div className="text-center py-8">
                  <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay invitaciones</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {state.invites.map(invite => {
                    const statusConfig = STATUS_CONFIG[invite.status] || STATUS_CONFIG.pending
                    const StatusIcon = statusConfig.icon
                    return (
                      <div key={invite.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(invite.created_at).toLocaleDateString('es', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {' · '}
                            Rol: {invite.role}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white',
                            statusConfig.color
                          )}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                          {isOwner && invite.status === 'pending' && (
                            <button
                              onClick={() => handleDeleteInvite(invite.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                              title="Cancelar invitación"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
