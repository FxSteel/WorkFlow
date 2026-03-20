import { useState, useEffect } from 'react'
import {
  X, Settings, Bell, Link2, Building2, Trash2,
  AlertTriangle, Upload, CheckCircle2, Loader2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

const TABS = [
  { id: 'general', label: 'Configuración general', icon: Settings },
  { id: 'notifications', label: 'Notificaciones', icon: Bell },
  { id: 'connections', label: 'Conexiones', icon: Link2, disabled: true },
]

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('general')

  useEffect(() => {
    if (isOpen) setActiveTab('general')
  }, [isOpen])

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
            {TABS.map(tab => {
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
            {activeTab === 'notifications' && <NotificationSettings />}
          </div>
        </div>
      </div>
    </div>
  )
}

function GeneralSettings() {
  const { user, signOut } = useAuth()
  const [companyName, setCompanyName] = useState(() =>
    localStorage.getItem('workflow-company-name') || ''
  )
  const [companyIcon, setCompanyIcon] = useState(() =>
    localStorage.getItem('workflow-company-icon') || ''
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  const handleSave = () => {
    setSaving(true)
    localStorage.setItem('workflow-company-name', companyName)
    localStorage.setItem('workflow-company-icon', companyIcon)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 500)
  }

  const handleDeleteAccount = async () => {
    if (deleteText !== 'ELIMINAR') return
    await signOut()
  }

  const handleIconUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result
      setCompanyIcon(dataUrl)
      localStorage.setItem('workflow-company-icon', dataUrl)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="px-6 py-5 space-y-8">
      {/* Company Info */}
      <section>
        <h4 className="text-sm font-semibold text-foreground mb-1">Empresa</h4>
        <p className="text-xs text-muted-foreground mb-4">Configura la información de tu organización</p>

        <div className="space-y-4">
          {/* Company Icon */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Icono de la empresa</label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/50 overflow-hidden">
                {companyIcon ? (
                  <img src={companyIcon} alt="" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  Subir imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleIconUpload}
                  />
                </label>
                {companyIcon && (
                  <button
                    onClick={() => { setCompanyIcon(''); localStorage.removeItem('workflow-company-icon') }}
                    className="ml-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Eliminar
                  </button>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG. Máximo 1MB</p>
              </div>
            </div>
          </div>

          {/* Company Name */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nombre de la empresa</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Mi Empresa"
              className="w-full max-w-sm px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : null}
            {saved ? 'Guardado' : 'Guardar cambios'}
          </button>
        </div>
      </section>

      {/* Account info */}
      <section>
        <h4 className="text-sm font-semibold text-foreground mb-1">Cuenta</h4>
        <p className="text-xs text-muted-foreground mb-4">Información de tu cuenta</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-foreground">Correo electrónico</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-foreground">Nombre</p>
              <p className="text-xs text-muted-foreground">{user?.user_metadata?.full_name || 'No definido'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-foreground">Proveedor de autenticación</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.app_metadata?.provider || 'email'}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <div className="rounded-xl border border-destructive/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <h4 className="text-sm font-semibold text-destructive">Zona de riesgo</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Al eliminar tu cuenta se borrarán permanentemente todos tus datos, espacios de trabajo, tableros, tareas y configuraciones. Esta acción no se puede deshacer.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              Eliminar mi cuenta
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
                  onClick={handleDeleteAccount}
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
  const [saved, setSaved] = useState(false)

  const toggle = (key) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    localStorage.setItem('workflow-notification-prefs', JSON.stringify(updated))
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
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

        {saved && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-success animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Guardado automáticamente
          </div>
        )}

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
