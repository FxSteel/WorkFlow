import { useState, useEffect, useRef } from 'react'
import {
  X, Settings, Bell, Link2, Building2, Trash2,
  AlertTriangle, Upload, CheckCircle2, Loader2,
  SlidersHorizontal, PanelRight, Maximize2, Layers,
  CreditCard, Sparkles, Check, ExternalLink,
  Mail, Send, Shield, UserPlus, Clock, Users, MoreHorizontal,
  Copy, Bot,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'
import { useSupabase } from '../../hooks/useSupabase'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { usePermissions, ROLE_PRESETS } from '../../hooks/usePermissions'
import PermissionEditor from '../ui/PermissionEditor'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Acceso total a la organización' },
  { value: 'member', label: 'Miembro', description: 'Crear y editar tareas' },
  { value: 'viewer', label: 'Visualizador', description: 'Solo puede ver y comentar' },
]

const TABS = [
  { id: 'general', label: 'Configuración general', icon: Settings },
  { id: 'members', label: 'Miembros', icon: Users },
  { id: 'preferences', label: 'Preferencias', icon: SlidersHorizontal },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'billing', label: 'Facturación', icon: CreditCard },
  { id: 'connections', label: 'Conexiones', icon: Link2 },
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
            {activeTab === 'connections' && <ConnectionsSettings />}
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

function MembersSettings() {
  const { user } = useAuth()
  const { state } = useApp()
  const { fetchInvites, createInvite, deleteInvite, fetchMembers, removeOrgMember, updateOrgMember } = useSupabase()
  const publicWorkspaces = state.workspaces.filter(ws => !ws.is_private)

  const [showInviteForm, setShowInviteForm] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [selectedWorkspaces, setSelectedWorkspaces] = useState([])
  const [customPermissions, setCustomPermissions] = useState({ ...ROLE_PRESETS.member })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [editingMember, setEditingMember] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editWsIds, setEditWsIds] = useState([])
  const [editPermissions, setEditPermissions] = useState({})
  const [deleteMemberId, setDeleteMemberId] = useState(null)
  const [memberMenu, setMemberMenu] = useState(null)
  const [memberMenuPos, setMemberMenuPos] = useState({ top: 0, left: 0 })
  const memberMenuRef = useRef(null)

  const { can } = usePermissions()
  const org = state.currentOrg
  const isOwner = org?.owner_id === user?.id
  const currentMember = state.orgMembers.find(m => m.user_id === user?.id)
  const canInvite = can('invite') || isOwner

  useEffect(() => {
    if (org) {
      fetchInvites(org.id)
      fetchMembers(org.id)
    }
  }, [org?.id])

  useEffect(() => {
    if (!memberMenu) return
    const close = (e) => {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) setMemberMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [memberMenu])

  useEffect(() => {
    const preset = ROLE_PRESETS[role]
    if (preset) setCustomPermissions({ ...preset })
    if (role === 'admin') {
      setSelectedWorkspaces(publicWorkspaces.map(w => w.id))
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
    const wsIds = role === 'admin' ? publicWorkspaces.map(w => w.id) : selectedWorkspaces

    const { error: inviteError } = await createInvite({
      org_id: org.id, email: inviteEmail, role, workspace_ids: wsIds,
      custom_permissions: customPermissions,
      invited_by: user.id, invited_by_name: user.user_metadata?.full_name || user.email, status: 'pending',
    })

    if (inviteError) { setError(inviteError.message); setSending(false); return }

    let emailSent = false
    if (supabaseAdmin) {
      const senderName = user.user_metadata?.full_name || user.email
      try {
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const userExists = existingUsers?.users?.find(u => u.email === inviteEmail)

        if (userExists) {
          const { error: otpErr } = await supabase.auth.signInWithOtp({
            email: inviteEmail,
            options: { shouldCreateUser: false, emailRedirectTo: window.location.origin }
          })
          if (!otpErr) emailSent = true
          else console.error('OTP error:', otpErr)
        } else {
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
    setCustomPermissions({ ...ROLE_PRESETS.member })
    setShowInviteForm(false)
    fetchInvites(org.id)
    setSending(false)
  }

  const pendingInvites = state.invites.filter(i => i.status === 'pending')

  // Sort members: owner first, then admins, then members, then viewers
  const roleOrder = { owner: 0, admin: 1, member: 2, viewer: 3 }
  const sortedMembers = [...state.orgMembers].sort((a, b) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4))

  if (!org) return null

  return (
    <div className="px-6 py-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Miembros</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{state.orgMembers.length} miembro{state.orgMembers.length !== 1 ? 's' : ''} en {org.name}</p>
        </div>
        {canInvite && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              showInviteForm
                ? 'bg-muted text-muted-foreground hover:bg-accent'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            <UserPlus className="w-3.5 h-3.5" />
            {showInviteForm ? 'Cancelar' : 'Invitar'}
          </button>
        )}
      </div>

      {/* Invite Form — collapsible */}
      {showInviteForm && canInvite && (
        <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="text-xs text-destructive">{error}</span>
            </div>
          )}

          {/* Step 1: Email */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Correo electrónico</label>
            <div className="flex items-center gap-2">
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
            </div>
          </div>

          {/* Step 2: Workspaces (only for member/viewer) */}
          {role !== 'admin' && publicWorkspaces.length > 0 && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Espacios de trabajo</label>
              <div className="space-y-1 max-h-[120px] overflow-y-auto rounded-lg border border-border bg-background p-1">
                {publicWorkspaces.map(ws => {
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
            </div>
          )}
          {role === 'admin' && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Shield className="w-3 h-3" /> Acceso total a todos los espacios</p>
          )}

          {/* Step 3: Role & Permissions */}
          <PermissionEditor
            permissions={customPermissions}
            onChange={setCustomPermissions}
            role={role}
            onRoleChange={setRole}
            compact
          />

          {/* Send */}
          <button
            onClick={handleSendInvite}
            disabled={sending || !email.trim()}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar invitación
          </button>
        </section>
      )}

      {/* Members List */}
      <section>
        <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
          {sortedMembers.map(member => {
            const isMemberOwner = member.role === 'owner'
            const isMe = member.user_id === user?.id
            const canEdit = canInvite && !isMemberOwner && !isMe
            const isEditing = editingMember === member.id
            const memberWsIds = member.workspace_ids || []
            return (
              <div key={member.id} className={cn(
                'transition-colors',
                isEditing && 'bg-accent/20'
              )}>
                {/* Member row */}
                <div className="flex items-center gap-3 px-4 py-3 group">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white overflow-hidden shrink-0"
                    style={{ backgroundColor: member.color || '#6c5ce7' }}>
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt="" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                    ) : member.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                      {isMe && <span className="text-[10px] text-muted-foreground">(tú)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {member.role === 'member' && memberWsIds.length > 0 && (
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">
                        {memberWsIds.length} espacio{memberWsIds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium',
                      isMemberOwner ? 'bg-primary/10 text-primary' : member.role === 'admin' ? 'bg-blue-500/10 text-blue-500' : member.role === 'viewer' ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'
                    )}>
                      {member.role === 'owner' ? 'Owner' : member.role === 'admin' ? 'Admin' : member.role === 'viewer' ? 'Viewer' : 'Miembro'}
                    </span>
                    {canEdit && !isEditing && (
                      <button
                        onClick={(e) => {
                          if (memberMenu === member.id) { setMemberMenu(null); return }
                          const rect = e.currentTarget.getBoundingClientRect()
                          setMemberMenuPos({ top: rect.bottom + 4, left: rect.right - 160 })
                          setMemberMenu(member.id)
                        }}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    )}
                    {!canEdit && <div className="w-6" />}
                  </div>
                  {deleteMemberId === member.id && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={async () => { await removeOrgMember(member.id); toast.success(`${member.name} eliminado`); setDeleteMemberId(null) }}
                        className="text-[10px] px-2 py-1 rounded-md bg-destructive text-white font-medium">Eliminar</button>
                      <button onClick={() => setDeleteMemberId(null)}
                        className="text-[10px] px-2 py-1 rounded-md border border-border font-medium">Cancelar</button>
                    </div>
                  )}
                </div>

                {/* Edit panel */}
                {isEditing && (
                  <div className="px-4 pb-4 pt-2 border-t border-border/50 space-y-4 bg-accent/10">
                    {/* Role + Permissions */}
                    <PermissionEditor
                      permissions={editPermissions}
                      onChange={setEditPermissions}
                      role={editRole}
                      onRoleChange={(newRole) => {
                        setEditRole(newRole)
                        if (newRole === 'admin') setEditWsIds(publicWorkspaces.map(w => w.id))
                      }}
                      compact
                    />

                    {/* Workspace access — only for non-admin */}
                    {editRole !== 'admin' && publicWorkspaces.length > 0 && (
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Espacios de trabajo asignados</label>
                        <div className="space-y-1 max-h-[100px] overflow-y-auto rounded-lg border border-border bg-background p-1">
                          {publicWorkspaces.map(ws => {
                            const sel = editWsIds.includes(ws.id)
                            return (
                              <button key={ws.id} onClick={() => setEditWsIds(prev => sel ? prev.filter(id => id !== ws.id) : [...prev, ws.id])}
                                className={cn('w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors', sel ? 'bg-primary/10' : 'hover:bg-accent/50')}>
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
                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={async () => {
                        const wsIds = editRole === 'admin' ? publicWorkspaces.map(w => w.id) : editWsIds
                        await updateOrgMember(member.id, { role: editRole, workspace_ids: wsIds, custom_permissions: editPermissions })
                        toast.success(`Acceso de ${member.name} actualizado`)
                        setEditingMember(null)
                      }} className="px-4 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        Guardar cambios
                      </button>
                      <button onClick={() => setEditingMember(null)}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors">
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

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <section>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Invitaciones pendientes ({pendingInvites.length})</h4>
          <div className="rounded-xl border border-dashed border-border divide-y divide-border overflow-hidden">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 px-4 py-3 group">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invite.role === 'admin' ? 'Admin' : invite.role === 'viewer' ? 'Visualizador' : 'Miembro'}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/10 text-yellow-600">Pendiente</span>
                {canInvite && (
                  <button onClick={async () => { await deleteInvite(invite.id); fetchInvites(org.id); toast.success('Invitación cancelada') }}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Member action menu — fixed position */}
      {memberMenu && (
        <div
          ref={memberMenuRef}
          className="fixed w-44 rounded-xl border border-border bg-popover shadow-lg py-1 z-[200] animate-scale-in"
          style={{ top: memberMenuPos.top, left: memberMenuPos.left }}
        >
          <button
            onClick={() => {
              const member = state.orgMembers.find(m => m.id === memberMenu)
              if (member) {
                setEditingMember(member.id)
                setEditRole(member.role)
                setEditWsIds(member.workspace_ids || [])
                setEditPermissions(
                  member.custom_permissions && typeof member.custom_permissions === 'object'
                    ? { ...member.custom_permissions }
                    : { ...(ROLE_PRESETS[member.role] || ROLE_PRESETS.viewer) }
                )
                setDeleteMemberId(null)
              }
              setMemberMenu(null)
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            Editar acceso
          </button>
          <button
            onClick={() => { setDeleteMemberId(memberMenu); setEditingMember(null); setMemberMenu(null) }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar miembro
          </button>
        </div>
      )}
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
  const { state } = useApp()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)

  const org = state.currentOrg
  const isOwner = org?.owner_id === user?.id

  useEffect(() => {
    fetchSubscription()
  }, [org?.id])

  const fetchSubscription = async () => {
    if (!org) { setLoading(false); return }
    setLoading(true)

    // Fetch the subscription for this org
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Sync status with AlohaPay if pending (only if owner)
    if (isOwner && data?.status === 'pending' && data?.payment_link_id) {
      try {
        const res = await fetch(
          `https://api.alohapay.co/api/external/v1/payment-links/${data.payment_link_id}`,
          { headers: { 'X-API-KEY': import.meta.env.VITE_ALOHAPAY_API_KEY } }
        )
        const result = await res.json()
        if (result.success && result.data) {
          const alohapayStatus = result.data.status
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
    if (!isOwner) return
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
          description: `Suscripción WorkFlow - ${org?.name || 'Organización'}`,
          success_url: window.location.origin + '?payment=success',
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          org_id: org.id,
          plan: 'pro',
          status: 'pending',
          payment_link_id: result.data.id,
          payment_link_url: result.data.url,
          amount: 25000,
          currency: 'CLP',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })

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
        <h4 className="text-sm font-semibold text-foreground mb-1">
          {isOwner ? 'Plan de tu organización' : 'Plan de la organización'}
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          {isPro
            ? `${org?.name || 'Tu organización'} tiene acceso completo a WorkFlow Pro.`
            : isOwner
              ? 'Suscríbete para habilitar el acceso a tu equipo.'
              : 'Solo el administrador de la organización puede gestionar la suscripción.'
          }
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
          ) : isPending && isOwner ? (
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
          ) : isOwner && canSubscribe ? (
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
          ) : null}

          {/* Non-owner message */}
          {!isOwner && !isPro && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm text-foreground">
                Contacta al administrador de la organización para activar la suscripción.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      {subscription && isOwner && (
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

function ConnectionsSettings() {
  const { user } = useAuth()
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [tokenGenerated, setTokenGenerated] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [mcpUrl, setMcpUrl] = useState('')

  const MCP_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`

  const handleGenerateToken = async () => {
    setGenerating(true)
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error || !session) {
        toast.error('No se pudo obtener la sesión. Intenta cerrar sesión y volver a entrar.')
        return
      }
      // Use refresh_token for persistent connection (doesn't expire on its own)
      setMcpUrl(`${MCP_BASE_URL}?refresh_token=${session.refresh_token}`)
      setTokenGenerated(true)
      if (tokenGenerated) {
        toast.success('URL regenerada correctamente')
      }
    } catch (err) {
      toast.error('Error al generar la URL. Intenta de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopyUrl = () => {
    if (!mcpUrl) return
    navigator.clipboard.writeText(mcpUrl)
    setCopiedUrl(true)
    toast.success('URL copiada al portapapeles')
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Claude MCP */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <Bot className="w-5 h-5 text-[#D97706]" />
          <h4 className="text-sm font-semibold text-foreground">Claude AI</h4>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Conecta tu cuenta a Claude para gestionar tareas, boards, sprints y notas con lenguaje natural.
          Funciona con cualquier método de inicio de sesión (Google, email, etc.).
        </p>

        {/* Steps */}
        <div className="space-y-3 mb-4">
          <div className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <div>
              <p className="text-sm text-foreground font-medium">Genera tu URL de conexión</p>
              <p className="text-xs text-muted-foreground">
                Haz clic en el botón de abajo para generar una URL única con tu sesión
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center mt-0.5">2</span>
            <div>
              <p className="text-sm text-foreground font-medium">Pega la URL en Claude</p>
              <p className="text-xs text-muted-foreground">
                Ve a{' '}
                <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  claude.ai <ExternalLink className="w-3 h-3" />
                </a>
                {' '}→ Configuración → Conectores → Agregar conector → pega la URL
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="shrink-0 w-5 h-5 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center mt-0.5">3</span>
            <div>
              <p className="text-sm text-foreground font-medium">Listo, habla con Claude</p>
              <p className="text-xs text-muted-foreground">
                Pídele que cree tareas, boards, sprints o notas en lenguaje natural
              </p>
            </div>
          </div>
        </div>

        {/* Generate / URL block */}
        {!tokenGenerated ? (
          <button
            onClick={handleGenerateToken}
            disabled={generating}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                Generar URL de conexión
              </>
            )}
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 bg-muted/60 border border-border rounded-lg px-3 py-2.5 font-mono text-[11px] text-foreground truncate">
                {mcpUrl}
              </div>
              <button
                onClick={handleCopyUrl}
                className={cn(
                  'shrink-0 px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all',
                  copiedUrl
                    ? 'bg-green-500/10 border-green-500/30 text-green-600'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? 'Copiada' : 'Copiar'}
              </button>
            </div>

            <div className="mt-2 flex items-start gap-2 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-700 dark:text-yellow-400">
                Esta URL contiene tu token personal. No la compartas con nadie.
                Si cierras sesión, necesitarás generar una nueva.
              </p>
            </div>

            <button
              type="button"
              onClick={handleGenerateToken}
              disabled={generating}
              className="mt-3 w-full py-2 px-4 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Regenerando...
                </>
              ) : (
                'Regenerar URL'
              )}
            </button>
          </>
        )}

        {/* Capabilities */}
        <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border">
          <p className="text-xs font-medium text-foreground mb-2">Lo que puedes hacer desde Claude:</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              'Crear y editar tareas',
              'Gestionar boards',
              'Crear sprints',
              'Escribir notas',
              'Buscar tareas',
              'Crear tareas en lote',
              'Ver miembros del equipo',
              'Asignar tareas',
            ].map(cap => (
              <p key={cap} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Check className="w-3 h-3 text-green-500 shrink-0" />
                {cap}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
