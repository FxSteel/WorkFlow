import { useState, useEffect } from 'react'
import {
  X, Settings, Bell, Link2, Building2, Trash2,
  AlertTriangle, Upload, CheckCircle2, Loader2,
  SlidersHorizontal, PanelRight, Maximize2, Layers,
  CreditCard, Sparkles, Check, ExternalLink,
  Mail, Send, Shield, UserPlus, Clock, Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'
import { useSupabase } from '../../hooks/useSupabase'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { usePermissions } from '../../hooks/usePermissions'

const TABS = [
  { id: 'general', label: 'Configuración general', icon: Settings },
  { id: 'members', label: 'Miembros', icon: Users },
  { id: 'preferences', label: 'Preferencias', icon: SlidersHorizontal },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'billing', label: 'Facturación', icon: CreditCard },
  { id: 'connections', label: 'Conexiones', icon: Link2, disabled: true },
]

export default function SettingsModal({ isOpen, onClose }) {
  const { can } = usePermissions()
  const [activeTab, setActiveTab] = useState('preferences')

  useEffect(() => {
    if (isOpen) setActiveTab(can('editOrgSettings') ? 'general' : 'preferences')
  }, [isOpen])

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'general' || tab.id === 'members') return can('editOrgSettings')
    return true
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl h-[85vh] max-h-[600px] bg-card rounded-xl shadow-2xl border border-border animate-scale-in overflow-hidden flex">
        {/* Sidebar */}
        <div className="w-[220px] bg-muted/30 border-r border-border flex flex-col shrink-0">
          <div className="px-4 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Configuración</h2>
          </div>
          <nav className="flex-1 p-2 space-y-0.5">
            {visibleTabs.map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                    tab.disabled && 'opacity-40 cursor-not-allowed',
                    !tab.disabled && activeTab === tab.id && 'bg-accent text-foreground font-medium',
                    !tab.disabled && activeTab !== tab.id && 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                  {tab.disabled && (
                    <span className="ml-auto text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">Pronto</span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h3 className="text-base font-semibold text-foreground">
              {TABS.find(t => t.id === activeTab)?.label}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {activeTab === 'general' && <GeneralSettings />}
            {activeTab === 'members' && <MembersSettings />}
            {activeTab === 'preferences' && <PreferencesSettings />}
            {activeTab === 'billing' && <BillingSettings />}
            {activeTab === 'notifications' && <NotificationSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  const { user, signOut } = useAuth()
  const { state, dispatch } = useApp()
  const org = state.currentOrg
  const isOwner = org?.owner_id === user?.id

  const [orgName, setOrgName] = useState(org?.name || '')
  const [orgIcon, setOrgIcon] = useState(org?.icon_url || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  useEffect(() => {
    setOrgName(org?.name || '')
    setOrgIcon(org?.icon_url || '')
  }, [org?.id])

  const handleSave = async () => {
    if (!org || !orgName.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('organizations')
      .update({ name: orgName.trim() })
      .eq('id', org.id)
      .select()
      .single()
    if (data) dispatch({ type: 'UPDATE_ORGANIZATION', payload: data })
    setSaving(false)
    toast.success('Organización actualizada')
  }

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !org) return
    e.target.value = ''
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `org-icons/${org.id}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('attachments').getPublicUrl(path)
      const url = data?.publicUrl
      if (url) {
        setOrgIcon(url)
        const { data: updated } = await supabase
          .from('organizations')
          .update({ icon_url: url })
          .eq('id', org.id)
          .select()
          .single()
        if (updated) dispatch({ type: 'UPDATE_ORGANIZATION', payload: updated })
        toast.success('Icono actualizado')
      }
    }
    setUploading(false)
  }

  const handleRemoveIcon = async () => {
    if (!org) return
    setOrgIcon('')
    const { data } = await supabase
      .from('organizations')
      .update({ icon_url: null })
      .eq('id', org.id)
      .select()
      .single()
    if (data) dispatch({ type: 'UPDATE_ORGANIZATION', payload: data })
    toast.success('Icono eliminado')
  }

  const handleDeleteOrg = async () => {
    if (deleteText !== 'ELIMINAR' || !org) return
    await supabase.from('organizations').delete().eq('id', org.id)
    dispatch({ type: 'DELETE_ORGANIZATION', payload: org.id })
    const remaining = state.organizations.filter(o => o.id !== org.id)
    if (remaining.length > 0) dispatch({ type: 'SET_CURRENT_ORG', payload: remaining[0] })
    toast.success('Organización eliminada')
    setShowDeleteConfirm(false)
    setDeleteText('')
  }

  if (!org) {
    return (
      <div className="px-6 py-12 text-center">
        <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Selecciona una organización</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-5 space-y-8">
      {/* Org Info */}
      <section>
        <h4 className="text-sm font-semibold text-foreground mb-1">Organización</h4>
        <p className="text-xs text-muted-foreground mb-4">Configura la información de tu organización</p>

        <div className="space-y-4">
          {/* Org Icon */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Icono</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden"
                style={{ backgroundColor: !orgIcon ? (org.color || '#6c5ce7') : undefined }}
              >
                {orgIcon ? (
                  <img src={orgIcon} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-2xl font-bold text-white">{org.name?.[0]?.toUpperCase()}</span>
                )}
              </div>
              {isOwner && (
                <div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {uploading ? 'Subiendo...' : orgIcon ? 'Cambiar' : 'Subir imagen'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleIconUpload} />
                  </label>
                  {orgIcon && (
                    <button onClick={handleRemoveIcon} className="ml-2 text-xs text-muted-foreground hover:text-destructive transition-colors">
                      Eliminar
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG. Máximo 1MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Org Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre de la organización</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              disabled={!isOwner}
              placeholder="Mi Organización"
              className="w-full max-w-sm px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground disabled:opacity-50"
            />
          </div>

          {isOwner && (
            <button
              onClick={handleSave}
              disabled={saving || !orgName.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Guardar cambios
            </button>
          )}
        </div>
      </section>

      {/* Org details */}
      <section>
        <h4 className="text-sm font-semibold text-foreground mb-1">Detalles</h4>
        <div className="space-y-1">
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-foreground">Propietario</p>
            <p className="text-xs text-muted-foreground">{isOwner ? `${user?.user_metadata?.full_name || user?.email} (tú)` : 'Otro usuario'}</p>
          </div>
          <div className="flex items-center justify-between py-2">
            <p className="text-sm text-foreground">Creada</p>
            <p className="text-xs text-muted-foreground">{org.created_at ? new Date(org.created_at).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
          </div>
        </div>
      </section>

      {/* Danger Zone — only owner */}
      {isOwner && (
        <section>
          <div className="rounded-xl border border-destructive/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h4 className="text-sm font-semibold text-destructive">Zona de riesgo</h4>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Al eliminar esta organización se borrarán permanentemente todos los espacios de trabajo, tableros, tareas, miembros y configuraciones. Esta acción no se puede deshacer.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
              >
                Eliminar organización
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-foreground font-medium">
                  Escribe <span className="font-bold text-destructive">ELIMINAR</span> para confirmar
                </p>
                <input
                  type="text"
                  value={deleteText}
                  onChange={(e) => setDeleteText(e.target.value)}
                  placeholder="ELIMINAR"
                  className="w-full max-w-xs px-3 py-2 rounded-lg border border-destructive/50 bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-destructive placeholder:text-muted-foreground"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteOrg}
                    disabled={deleteText !== 'ELIMINAR'}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirmar eliminación
                  </button>
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Visualizador', description: 'Solo puede ver, no editar' },
  { value: 'member', label: 'Miembro', description: 'Puede crear y editar tareas' },
  { value: 'admin', label: 'Admin', description: 'Acceso total a la organizacion' },
]

function MembersSettings() {
  const { user } = useAuth()
  const { state } = useApp()
  const { fetchInvites, createInvite, deleteInvite, fetchMembers, removeOrgMember, updateOrgMember } = useSupabase()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [selectedWorkspaces, setSelectedWorkspaces] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [editingMember, setEditingMember] = useState(null) // member id being edited
  const [editRole, setEditRole] = useState('')
  const [editWsIds, setEditWsIds] = useState([])
  const [deleteMemberId, setDeleteMemberId] = useState(null)

  const org = state.currentOrg
  const isOwner = org?.owner_id === user?.id
  const currentMember = state.orgMembers.find(m => m.user_id === user?.id)
  const canInvite = isOwner || currentMember?.role === 'admin'

  useEffect(() => {
    if (org) {
      fetchInvites(org.id)
      fetchMembers(org.id)
    }
  }, [org?.id])

  useEffect(() => {
    if (role === 'admin') {
      setSelectedWorkspaces(state.workspaces.map(w => w.id))
    } else {
      setSelectedWorkspaces([])
    }
  }, [role])

  const toggleWorkspace = (wsId) => {
    if (role === 'admin') return
    setSelectedWorkspaces(prev =>
      prev.includes(wsId) ? prev.filter(id => id !== wsId) : [...prev, wsId]
    )
  }

  const handleSendInvite = async () => {
    setError('')
    if (!email.trim()) { setError('Ingresa un correo'); return }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) { setError('Correo invalido'); return }
    if (role === 'member' && selectedWorkspaces.length === 0) { setError('Selecciona al menos un espacio'); return }

    const inviteEmail = email.trim().toLowerCase()
    if (state.invites.find(i => i.email === inviteEmail && i.status === 'pending')) { setError('Ya hay una invitacion pendiente'); return }
    if (state.orgMembers.find(m => m.email === inviteEmail)) { setError('Ya es miembro'); return }

    setSending(true)
    const wsIds = role === 'admin' ? state.workspaces.map(w => w.id) : selectedWorkspaces

    const { error: inviteError } = await createInvite({
      org_id: org.id, email: inviteEmail, role, workspace_ids: wsIds,
      invited_by: user.id, invited_by_name: user.user_metadata?.full_name || user.email, status: 'pending',
    })

    if (inviteError) { setError(inviteError.message); setSending(false); return }

    // Try to send email
    let emailSent = false
    if (supabaseAdmin) {
      const senderName = user.user_metadata?.full_name || user.email
      try {
        // First check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const userExists = existingUsers?.users?.find(u => u.email === inviteEmail)

        if (userExists) {
          // User exists — send magic link instead
          const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: inviteEmail,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: window.location.origin,
            }
          })
          if (!otpErr) emailSent = true
          else console.error('OTP error:', otpErr)
        } else {
          // New user — send invite
          const { error: emailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(inviteEmail, {
            redirectTo: window.location.origin,
            data: { invited_to_org: org.name, invited_by: senderName },
          })
          if (!emailErr) emailSent = true
          else console.error('Invite error:', emailErr)
        }
      } catch (err) {
        console.error('Email send error:', err)
      }
    } else {
      console.warn('supabaseAdmin not available — VITE_SUPABASE_SERVICE_ROLE_KEY missing')
    }

    toast.success(emailSent
      ? `Invitacion enviada a ${inviteEmail}`
      : `Invitacion guardada (el correo no pudo enviarse)`
    )
    setEmail(''); setRole('member'); setSelectedWorkspaces([])
    fetchInvites(org.id)
    setSending(false)
  }

  const pendingInvites = state.invites.filter(i => i.status === 'pending')

  if (!org) return null

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Invite Section */}
      {canInvite && (
        <section>
          <h4 className="text-sm font-semibold text-foreground mb-1">Invitar miembros</h4>
          <p className="text-xs text-muted-foreground mb-3">Invita personas a tu organización</p>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="text-xs text-destructive">{error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendInvite() }}
                placeholder="usuario@ejemplo.com"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={handleSendInvite}
              disabled={sending || !email.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Invitar
            </button>
          </div>

          {/* Role */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setRole(opt.value)}
                className={cn(
                  'flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all',
                  role === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Shield className={cn('w-3 h-3', role === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                  <span className={cn('text-xs font-medium', role === opt.value ? 'text-primary' : 'text-foreground')}>{opt.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</span>
              </button>
            ))}
          </div>

          {/* Workspace Selection for members */}
          {role === 'member' && state.workspaces.length > 0 && (
            <div className="space-y-1.5 max-h-[120px] overflow-y-auto rounded-lg border border-border p-1">
              {state.workspaces.map(ws => {
                const sel = selectedWorkspaces.includes(ws.id)
                return (
                  <button key={ws.id} onClick={() => toggleWorkspace(ws.id)}
                    className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors', sel ? 'bg-primary/10' : 'hover:bg-accent/50')}>
                    <div className="w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: ws.color || '#6c5ce7' }}>
                      {ws.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-xs text-foreground flex-1 truncate">{ws.name}</span>
                    {sel && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}
          {role === 'admin' && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Acceso total a todos los espacios</p>
          )}
        </section>
      )}

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-foreground mb-2">Invitaciones pendientes ({pendingInvites.length})</h4>
          <div className="space-y-1">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors group">
                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{invite.email}</p>
                  <p className="text-[10px] text-muted-foreground">{invite.role === 'admin' ? 'Admin' : invite.role === 'viewer' ? 'Visualizador' : 'Miembro'}</p>
                </div>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-yellow-500 text-white">Pendiente</span>
                {canInvite && (
                  <button onClick={async () => { await deleteInvite(invite.id); fetchInvites(org.id); toast.success('Invitacion cancelada') }}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Members List */}
      <section>
        <h4 className="text-sm font-semibold text-foreground mb-2">Miembros ({state.orgMembers.length})</h4>
        <div className="space-y-1">
          {state.orgMembers.map(member => {
            const isMemberOwner = member.role === 'owner'
            const isMe = member.user_id === user?.id
            const canEdit = canInvite && !isMemberOwner && !isMe
            const isEditing = editingMember === member.id
            const memberWsIds = member.workspace_ids || []
            return (
              <div key={member.id} className={cn(
                'rounded-lg transition-colors',
                isMemberOwner ? 'bg-primary/5 border border-primary/10' : isEditing ? 'bg-accent/30 border border-border' : 'hover:bg-accent/50'
              )}>
                {/* Member row */}
                <div className="flex items-center gap-3 px-3 py-2 group">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white overflow-hidden"
                    style={{ backgroundColor: member.color || '#6c5ce7' }}>
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : member.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{member.name}{isMe && ' (tú)'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {member.email}
                      {member.role === 'member' && memberWsIds.length > 0 && (
                        <span> · {memberWsIds.length} espacio{memberWsIds.length !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                  <span className={cn(
                    'px-1.5 py-0.5 rounded-full text-[9px] font-medium',
                    isMemberOwner ? 'bg-primary/10 text-primary' : member.role === 'admin' ? 'bg-blue-500/10 text-blue-500' : member.role === 'viewer' ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'
                  )}>
                    {member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : member.role === 'viewer' ? 'Visualizador' : 'Miembro'}
                  </span>
                  {canEdit && !isEditing && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => {
                        setEditingMember(member.id)
                        setEditRole(member.role)
                        setEditWsIds(member.workspace_ids || [])
                        setDeleteMemberId(null)
                      }} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Editar acceso">
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                      <button onClick={() => { setDeleteMemberId(member.id); setEditingMember(null) }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  {deleteMemberId === member.id && (
                    <div className="flex items-center gap-1">
                      <button onClick={async () => { await removeOrgMember(member.id); toast.success(`${member.name} eliminado`); setDeleteMemberId(null) }}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-destructive text-white">Eliminar</button>
                      <button onClick={() => setDeleteMemberId(null)}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-border">Cancelar</button>
                    </div>
                  )}
                </div>

                {/* Edit panel */}
                {isEditing && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-3">
                    {/* Role selector */}
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block">Rol</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {ROLE_OPTIONS.map(opt => (
                          <button key={opt.value} onClick={() => {
                            setEditRole(opt.value)
                            if (opt.value === 'admin') setEditWsIds(state.workspaces.map(w => w.id))
                          }} className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-all',
                            editRole === opt.value ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-muted-foreground/40'
                          )}>
                            <Shield className={cn('w-3 h-3', editRole === opt.value ? 'text-primary' : 'text-muted-foreground')} />
                            <span className={cn('text-[11px] font-medium', editRole === opt.value ? 'text-primary' : 'text-foreground')}>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Workspace access — only for member role */}
                    {editRole === 'member' && state.workspaces.length > 0 && (
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground mb-1.5 block">Espacios de trabajo</label>
                        <div className="space-y-1 max-h-[100px] overflow-y-auto rounded-md border border-border p-1">
                          {state.workspaces.map(ws => {
                            const sel = editWsIds.includes(ws.id)
                            return (
                              <button key={ws.id} onClick={() => setEditWsIds(prev => sel ? prev.filter(id => id !== ws.id) : [...prev, ws.id])}
                                className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors', sel ? 'bg-primary/10' : 'hover:bg-accent/50')}>
                                <div className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold text-white shrink-0" style={{ backgroundColor: ws.color || '#6c5ce7' }}>
                                  {ws.name?.[0]?.toUpperCase()}
                                </div>
                                <span className="text-[11px] text-foreground flex-1 truncate">{ws.name}</span>
                                {sel && <Check className="w-3 h-3 text-primary shrink-0" />}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {editRole === 'admin' && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Acceso total a todos los espacios</p>
                    )}

                    {/* Save / Cancel */}
                    <div className="flex items-center gap-2">
                      <button onClick={async () => {
                        const wsIds = editRole === 'admin' ? state.workspaces.map(w => w.id) : editWsIds
                        await updateOrgMember(member.id, { role: editRole, workspace_ids: wsIds })
                        toast.success(`Acceso de ${member.name} actualizado`)
                        setEditingMember(null)
                      }} className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        Guardar
                      </button>
                      <button onClick={() => setEditingMember(null)}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function PreferencesSettings() {
  const [taskView, setTaskView] = useState(() =>
    localStorage.getItem('workflow-task-editor-view') || 'sidebar'
  )

  const changeView = (view) => {
    setTaskView(view)
    localStorage.setItem('workflow-task-editor-view', view)
    toast.success('Preferencia guardada')
  }

  const VIEW_OPTIONS = [
    {
      id: 'sidebar',
      label: 'Ventana lateral',
      description: 'Se abre un panel en el lado derecho de la pantalla',
      icon: PanelRight,
    },
    {
      id: 'modal',
      label: 'Ventana central',
      description: 'Se abre un modal en el centro de la pantalla',
      icon: Layers,
    },
    {
      id: 'fullpage',
      label: 'Página completa',
      description: 'Se abre como una página completa estilo Notion',
      icon: Maximize2,
    },
  ]

  return (
    <div className="px-6 py-5 space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-1">Vista de edición de tareas</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Elige cómo quieres abrir las tareas al crearlas o editarlas. Esta preferencia solo afecta tu cuenta.
        </p>

        <div className="space-y-2">
          {VIEW_OPTIONS.map(opt => {
            const Icon = opt.icon
            const isSelected = taskView === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => changeView(opt.id)}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                  isSelected
                    ? 'border-foreground bg-foreground/5'
                    : 'border-border hover:border-muted-foreground/40 hover:bg-accent/30'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  isSelected ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-sm font-medium',
                    isSelected ? 'text-foreground' : 'text-foreground'
                  )}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  isSelected ? 'border-foreground' : 'border-border'
                )}>
                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function BillingSettings() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    fetchSubscription()
  }, [])

  const fetchSubscription = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Sync status with AlohaPay if pending
    if (data?.status === 'pending' && data?.payment_link_id) {
      try {
        const res = await fetch(
          `https://api.alohapay.co/api/external/v1/payment-links/${data.payment_link_id}`,
          { headers: { 'X-API-KEY': import.meta.env.VITE_ALOHAPAY_API_KEY } }
        )
        const result = await res.json()
        if (result.success && result.data) {
          const alohapayStatus = result.data.status // active, completed, cancelled, expired
          let newStatus = data.status
          if (alohapayStatus === 'completed') newStatus = 'active'
          else if (alohapayStatus === 'cancelled') newStatus = 'cancelled'
          else if (alohapayStatus === 'expired') newStatus = 'expired'

          if (newStatus !== data.status) {
            await supabase
              .from('subscriptions')
              .update({ status: newStatus })
              .eq('id', data.id)
            data.status = newStatus
          }
        }
      } catch {}
    }

    if (data) setSubscription(data)
    setLoading(false)
  }

  const handleSubscribe = async () => {
    setPaying(true)
    try {
      const response = await fetch('https://api.alohapay.co/api/external/v1/payment-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': import.meta.env.VITE_ALOHAPAY_API_KEY,
        },
        body: JSON.stringify({
          amount: 25000,
          currency: 'CLP',
          description: 'Pago de suscripción Mensual - WorkFlow',
          success_url: window.location.origin + '?payment=success',
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        // Save payment link to DB
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan: 'pro',
          status: 'pending',
          payment_link_id: result.data.id,
          payment_link_url: result.data.url,
          amount: 25000,
          currency: 'CLP',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })

        // Redirect to checkout
        window.open(result.data.url, '_blank')
        fetchSubscription()
      }
    } catch (err) {
      console.error('Payment error:', err)
    }
    setPaying(false)
  }

  const isPro = subscription?.status === 'active'
  const isPending = subscription?.status === 'pending'
  const isCancelled = subscription?.status === 'cancelled'
  const isExpired = subscription?.status === 'expired'
  const canSubscribe = !subscription || isCancelled || isExpired

  const formatDate = (date) => {
    if (!date) return ''
    return new Date(date).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const PLAN_FEATURES = [
    'Espacios de trabajo ilimitados',
    'Tareas y sprints ilimitados',
    'Miembros ilimitados',
    'Todas las vistas (Kanban, Calendario, Gantt, etc.)',
    'Editor de bloques con multimedia',
    'Comentarios y @menciones',
    'Notificaciones en tiempo real',
    'Soporte prioritario',
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Current plan */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-1">Tu plan actual</h4>
        <p className="text-xs text-muted-foreground mb-4">
          {isPro ? 'Tienes acceso completo a WorkFlow Pro.' : 'Estás usando el plan gratuito.'}
        </p>

        {/* Plan card */}
        <div className={cn(
          'rounded-xl border-2 p-5 transition-all',
          isPro ? 'border-foreground bg-foreground/5' : 'border-border'
        )}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isPro ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
              )}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">WorkFlow Pro</h3>
                <p className="text-xs text-muted-foreground">
                  {isPro ? 'Plan activo' : isPending ? 'Pago pendiente' : isCancelled ? 'Pago cancelado' : isExpired ? 'Link expirado' : 'Plan recomendado'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">$25.000</p>
              <p className="text-xs text-muted-foreground">CLP / mes</p>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2 mb-5">
            {PLAN_FEATURES.map((feature, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-success shrink-0" />
                <span className="text-sm text-foreground">{feature}</span>
              </div>
            ))}
          </div>

          {/* Action */}
          {isPro ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium text-foreground">Plan activo</p>
                <p className="text-xs text-muted-foreground">
                  Próximo cobro: {formatDate(subscription?.current_period_end)}
                </p>
              </div>
              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Activo
              </span>
            </div>
          ) : isPending ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                <div>
                  <p className="text-sm font-medium text-foreground">Pago pendiente</p>
                  <p className="text-xs text-muted-foreground">Completa tu pago para activar el plan</p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                  Pendiente
                </span>
              </div>
              <a
                href={subscription.payment_link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Completar pago
              </a>
            </div>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={paying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {paying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Suscribirse por $25.000 CLP/mes
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Payment history */}
      {subscription && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Historial de pagos</h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors">
              <div>
                <p className="text-sm text-foreground">WorkFlow Pro</p>
                <p className="text-xs text-muted-foreground">{formatDate(subscription.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">$25.000 CLP</span>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  subscription.status === 'active' ? 'bg-success/10 text-success'
                    : subscription.status === 'pending' ? 'bg-warning/10 text-warning'
                    : subscription.status === 'cancelled' ? 'bg-destructive/10 text-destructive'
                    : subscription.status === 'expired' ? 'bg-muted text-muted-foreground'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {subscription.status === 'active' ? 'Pagado'
                    : subscription.status === 'pending' ? 'Pendiente'
                    : subscription.status === 'cancelled' ? 'Cancelado'
                    : subscription.status === 'expired' ? 'Expirado'
                    : subscription.status}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Powered by */}
      <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <CreditCard className="w-3.5 h-3.5" />
        Pagos procesados por AlohaPay
      </div>
    </div>
  )
}

function NotificationSettings() {
  const [prefs, setPrefs] = useState(() => {
    const stored = localStorage.getItem('workflow-notification-prefs')
    return stored ? JSON.parse(stored) : {
      pushEnabled: true,
      taskAssigned: true,
      taskCompleted: true,
      mentions: true,
      dueDateReminder: true,
      sprintUpdates: false,
      weeklyDigest: false,
    }
  })
  const toggle = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    localStorage.setItem('workflow-notification-prefs', JSON.stringify(updated))
    toast.success('Notificación actualizada')
  }

  const NOTIFICATION_OPTIONS = [
    { key: 'pushEnabled', label: 'Notificaciones push', description: 'Activa o desactiva todas las notificaciones push', isMain: true },
    { key: 'taskAssigned', label: 'Tareas asignadas', description: 'Cuando te asignan una nueva tarea' },
    { key: 'taskCompleted', label: 'Tareas completadas', description: 'Cuando una tarea asignada a ti se marca como completada' },
    { key: 'mentions', label: 'Menciones', description: 'Cuando alguien te menciona en un comentario' },
    { key: 'dueDateReminder', label: 'Recordatorio de fecha límite', description: 'Un día antes de la fecha de vencimiento' },
    { key: 'sprintUpdates', label: 'Actualizaciones de sprint', description: 'Cuando un sprint inicia o finaliza' },
    { key: 'weeklyDigest', label: 'Resumen semanal', description: 'Recibe un resumen de actividad cada lunes' },
  ]

  return (
    <div className="px-6 py-5 space-y-6">
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-1">Preferencias de notificaciones</h4>
        <p className="text-xs text-muted-foreground mb-4">Elige qué notificaciones quieres recibir</p>

        <div className="space-y-1">
          {NOTIFICATION_OPTIONS.map(opt => (
            <div
              key={opt.key}
              className={cn(
                'flex items-center justify-between py-3 px-3 rounded-lg transition-colors',
                opt.isMain ? 'bg-muted/50 mb-2' : 'hover:bg-muted/30',
                !prefs.pushEnabled && !opt.isMain && 'opacity-40 pointer-events-none'
              )}
            >
              <div>
                <p className={cn('text-sm text-foreground', opt.isMain && 'font-semibold')}>{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
              <button
                onClick={() => toggle(opt.key)}
                className={cn(
                  'relative inline-flex items-center w-9 h-5 rounded-full transition-colors shrink-0',
                  prefs[opt.key] ? 'bg-foreground' : 'bg-border'
                )}
              >
                <span
                  className={cn(
                    'inline-block w-3.5 h-3.5 rounded-full bg-background shadow-sm transition-transform',
                    prefs[opt.key] ? 'translate-x-[18px]' : 'translate-x-[3px]'
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
