import { useState, useEffect } from 'react'
import {
  X, Mail, UserPlus, Send, Loader2, CheckCircle2,
  AlertCircle, Clock, Trash2, Users, Shield, Check,
  LayoutDashboard, ChevronDown, ChevronRight, SlidersHorizontal,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'
import { ROLE_PRESETS, usePermissions } from '../../hooks/usePermissions'
import PermissionEditor from '../ui/PermissionEditor'

const STATUS_CONFIG = {
  pending: { label: 'Pendiente', color: 'bg-yellow-500', icon: Clock },
  accepted: { label: 'Aceptada', color: 'bg-emerald-500', icon: CheckCircle2 },
  declined: { label: 'Rechazada', color: 'bg-red-500', icon: AlertCircle },
}

export default function InviteModal({ isOpen, onClose }) {
  const { state } = useApp()
  const { user } = useAuth()
  const { fetchInvites, createInvite, deleteInvite, fetchMembers, removeOrgMember, updateOrgMember } = useSupabase()
  const publicWorkspaces = state.workspaces.filter(ws => !ws.is_private)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [selectedWorkspaces, setSelectedWorkspaces] = useState([])
  const [customPermissions, setCustomPermissions] = useState({ ...ROLE_PRESETS.member })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('invite')
  const [deleteMemberId, setDeleteMemberId] = useState(null)
  const [showPermissions, setShowPermissions] = useState(false)
  // Edit member state
  const [editingMember, setEditingMember] = useState(null)
  const [editRole, setEditRole] = useState('member')
  const [editPermissions, setEditPermissions] = useState({})
  const [editWsIds, setEditWsIds] = useState([])

  const currentOrg = state.currentOrg

  useEffect(() => {
    if (isOpen && currentOrg) {
      fetchInvites(currentOrg.id)
      fetchMembers(currentOrg.id)
      setError('')
      setSelectedWorkspaces([])
      setShowPermissions(false)
      setEditingMember(null)
    }
  }, [isOpen, currentOrg?.id])

  // Sync permissions when role changes
  useEffect(() => {
    const preset = ROLE_PRESETS[role]
    if (preset) setCustomPermissions({ ...preset })
    if (role === 'admin') {
      setSelectedWorkspaces(publicWorkspaces.map(w => w.id))
    } else {
      setSelectedWorkspaces([])
    }
  }, [role])

  if (!isOpen || !currentOrg) return null

  const { can } = usePermissions()
  const isOwner = currentOrg.owner_id === user?.id
  const currentMember = state.orgMembers.find(m => m.user_id === user?.id)
  const canInvite = can('invite') || isOwner

  const toggleWorkspace = (wsId) => {
    if (role === 'admin') return
    setSelectedWorkspaces(prev =>
      prev.includes(wsId) ? prev.filter(id => id !== wsId) : [...prev, wsId]
    )
  }

  const handleSendInvite = async () => {
    setError('')

    if (!email.trim()) { setError('Ingresa un correo electrónico'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) { setError('Ingresa un correo válido'); return }
    if (role !== 'admin' && selectedWorkspaces.length === 0) {
      setError('Selecciona al menos un espacio de trabajo'); return
    }

    const inviteEmail = email.trim().toLowerCase()
    if (state.invites.find(i => i.email === inviteEmail && i.status === 'pending')) {
      setError('Ya existe una invitación pendiente para este correo'); return
    }
    if (state.orgMembers.find(m => m.email === inviteEmail)) {
      setError('Este usuario ya es miembro de la organización'); return
    }

    setSending(true)
    const wsIds = role === 'admin' ? publicWorkspaces.map(w => w.id) : selectedWorkspaces

    const { error: inviteError } = await createInvite({
      org_id: currentOrg.id,
      email: inviteEmail,
      role,
      workspace_ids: wsIds,
      custom_permissions: customPermissions,
      invited_by: user.id,
      invited_by_name: user.user_metadata?.full_name || user.email,
      status: 'pending',
    })

    if (inviteError) { setError(inviteError.message); setSending(false); return }

    let emailSent = false
    if (supabaseAdmin) {
      const senderName = user.user_metadata?.full_name || user.email
      const senderInitials = senderName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

      const { error: inviteEmailError } = await supabaseAdmin.auth.admin.inviteUserByEmail(inviteEmail, {
        redirectTo: window.location.origin,
        data: {
          invited_to_org: currentOrg.name,
          invited_by: senderName,
          invited_by_initials: senderInitials,
        },
      })

      if (inviteEmailError) {
        if (inviteEmailError.message?.includes('already been registered')) {
          try {
            await supabaseAdmin.auth.admin.generateLink({
              type: 'magiclink',
              email: inviteEmail,
              options: { redirectTo: window.location.origin },
            })
          } catch {}
        }
      } else {
        emailSent = true
      }
    }

    toast.success(emailSent
      ? `Invitación enviada por email a ${inviteEmail}`
      : `Invitación enviada a ${inviteEmail}`
    )

    setEmail('')
    setRole('member')
    setCustomPermissions({ ...ROLE_PRESETS.member })
    setSelectedWorkspaces([])
    setShowPermissions(false)
    fetchInvites(currentOrg.id)
    setSending(false)
  }

  const handleDeleteInvite = async (inviteId) => {
    await deleteInvite(inviteId)
    fetchInvites(currentOrg.id)
    toast.success('Invitación cancelada')
  }

  const startEditMember = (member) => {
    setEditingMember(member.id)
    setEditRole(member.role)
    setEditPermissions(
      member.custom_permissions && typeof member.custom_permissions === 'object'
        ? { ...member.custom_permissions }
        : { ...(ROLE_PRESETS[member.role] || ROLE_PRESETS.viewer) }
    )
    setEditWsIds(member.workspace_ids || [])
  }

  const saveEditMember = async (memberId) => {
    const wsIds = editRole === 'admin' ? publicWorkspaces.map(w => w.id) : editWsIds
    await updateOrgMember(memberId, {
      role: editRole,
      workspace_ids: wsIds,
      custom_permissions: editPermissions,
    })
    setEditingMember(null)
    toast.success('Acceso actualizado')
    fetchMembers(currentOrg.id)
  }

  const pendingInvites = state.invites.filter(i => i.status === 'pending')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-card rounded-xl shadow-2xl border border-border animate-scale-in max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            {currentOrg.icon_url ? (
              <img src={currentOrg.icon_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: currentOrg.color || '#6c5ce7' }}>
                {currentOrg.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-base font-semibold text-card-foreground">{currentOrg.name}</h2>
              <p className="text-xs text-muted-foreground">Gestionar miembros e invitaciones</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {[
            { id: 'invite', label: 'Invitar', icon: UserPlus },
            { id: 'pending', label: `Pendientes (${pendingInvites.length})`, icon: Clock },
            { id: 'members', label: `Miembros (${state.orgMembers.length})`, icon: Users },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setEditingMember(null) }}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative',
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* ─── Invite Tab ───────────────────────────────────────── */}
          {activeTab === 'invite' && (
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 animate-scale-in">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  <span className="text-sm text-destructive">{error}</span>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSendInvite() }}
                    placeholder="usuario@ejemplo.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {/* Workspace Selection — for non-admin */}
              {role !== 'admin' && publicWorkspaces.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Espacios de trabajo
                  </label>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Selecciona a qué espacios tendrá acceso
                  </p>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto rounded-lg border border-border p-1">
                    {publicWorkspaces.map(ws => {
                      const isSelected = selectedWorkspaces.includes(ws.id)
                      return (
                        <button
                          key={ws.id}
                          onClick={() => toggleWorkspace(ws.id)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors',
                            isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
                          )}
                        >
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: ws.color || '#6c5ce7' }}>
                            {ws.name?.[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-foreground flex-1 truncate">{ws.name}</span>
                          {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                  {selectedWorkspaces.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {selectedWorkspaces.length} espacio{selectedWorkspaces.length !== 1 ? 's' : ''} seleccionado{selectedWorkspaces.length !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Admin info */}
              {role === 'admin' && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                  <Shield className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[11px] text-muted-foreground">
                    Los administradores tienen acceso a todos los espacios de trabajo
                  </span>
                </div>
              )}

              {/* Permission Editor */}
              <div>
                <button
                  onClick={() => setShowPermissions(!showPermissions)}
                  className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  {showPermissions ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Rol y permisos
                </button>
                {showPermissions && (
                  <div className="animate-scale-in">
                    <PermissionEditor
                      permissions={customPermissions}
                      onChange={setCustomPermissions}
                      role={role}
                      onRoleChange={setRole}
                    />
                  </div>
                )}
                {!showPermissions && (
                  <p className="text-[11px] text-muted-foreground ml-7">
                    Rol actual: <span className="font-medium text-foreground capitalize">{role === 'viewer' ? 'Visualizador' : role === 'member' ? 'Miembro' : 'Admin'}</span>
                    {' — '}Click para personalizar permisos
                  </p>
                )}
              </div>

              <button
                onClick={handleSendInvite}
                disabled={sending || !email.trim() || (role !== 'admin' && selectedWorkspaces.length === 0)}
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

          {/* ─── Members Tab ──────────────────────────────────────── */}
          {activeTab === 'members' && (
            <div className="px-6 py-4">
              {state.orgMembers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No hay miembros todavía</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {state.orgMembers.map(member => {
                    const isMemberOwner = member.role === 'owner'
                    const isMe = member.user_id === user?.id
                    const memberWsCount = member.role === 'admin' || member.role === 'owner'
                      ? publicWorkspaces.length
                      : (member.workspace_ids || []).length
                    const canEdit = canInvite && !isMemberOwner && !isMe
                    const isEditing = editingMember === member.id

                    return (
                      <div key={member.id}>
                        <div className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                          isMemberOwner ? 'bg-primary/5 border border-primary/10'
                            : isEditing ? 'bg-accent/50 border border-border'
                            : 'hover:bg-accent/50'
                        )}>
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
                            style={{ backgroundColor: member.color || '#6c5ce7' }}>
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              member.name?.[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {member.name}{isMe && ' (tú)'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                              {member.role !== 'owner' && member.role !== 'admin' && memberWsCount > 0 && (
                                <span> · {memberWsCount} espacio{memberWsCount !== 1 ? 's' : ''}</span>
                              )}
                            </p>
                          </div>
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-[10px] font-medium',
                            isMemberOwner ? 'bg-primary/10 text-primary font-semibold'
                              : member.role === 'admin' ? 'bg-blue-500/10 text-blue-500'
                              : member.role === 'viewer' ? 'bg-orange-500/10 text-orange-500'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : member.role === 'viewer' ? 'Visualizador' : 'Miembro'}
                            {member.custom_permissions && ' *'}
                          </span>
                          {canEdit && !isEditing && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditMember(member)}
                                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                                title="Editar acceso"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteMemberId(member.id)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Eliminar miembro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {deleteMemberId === member.id && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  await removeOrgMember(member.id)
                                  toast.success(`${member.name} eliminado`)
                                  setDeleteMemberId(null)
                                }}
                                className="text-[10px] px-2 py-0.5 rounded bg-destructive text-white hover:bg-destructive/90"
                              >
                                Confirmar
                              </button>
                              <button
                                onClick={() => setDeleteMemberId(null)}
                                className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent"
                              >
                                No
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Edit Panel */}
                        {isEditing && (
                          <div className="ml-11 mt-2 mb-3 p-4 rounded-lg border border-border bg-card space-y-4 animate-scale-in">
                            {/* Workspace access */}
                            {editRole !== 'admin' && publicWorkspaces.length > 0 && (
                              <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Espacios de trabajo</label>
                                <div className="space-y-1 max-h-[100px] overflow-y-auto rounded-lg border border-border p-1">
                                  {publicWorkspaces.map(ws => {
                                    const isSel = editWsIds.includes(ws.id)
                                    return (
                                      <button
                                        key={ws.id}
                                        onClick={() => setEditWsIds(prev => isSel ? prev.filter(id => id !== ws.id) : [...prev, ws.id])}
                                        className={cn(
                                          'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors',
                                          isSel ? 'bg-primary/10' : 'hover:bg-accent/50'
                                        )}
                                      >
                                        <div className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                                          style={{ backgroundColor: ws.color || '#6c5ce7' }}>
                                          {ws.name?.[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-xs text-foreground flex-1 truncate">{ws.name}</span>
                                        {isSel && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Permission Editor */}
                            <PermissionEditor
                              permissions={editPermissions}
                              onChange={setEditPermissions}
                              role={editRole}
                              onRoleChange={setEditRole}
                              compact
                            />

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => saveEditMember(member.id)}
                                className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                              >
                                Guardar cambios
                              </button>
                              <button
                                onClick={() => setEditingMember(null)}
                                className="px-3 py-2 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Pending Invites Tab ──────────────────────────────── */}
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
                    const wsCount = (invite.workspace_ids || []).length
                    return (
                      <div key={invite.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent/50 transition-colors group">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {invite.role === 'admin' ? 'Admin · Acceso total'
                              : invite.role === 'viewer' ? 'Visualizador'
                              : `Miembro · ${wsCount} espacio${wsCount !== 1 ? 's' : ''}`}
                            {invite.custom_permissions && ' · Permisos personalizados'}
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
                          {canInvite && invite.status === 'pending' && (
                            <button
                              onClick={() => handleDeleteInvite(invite.id)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
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
