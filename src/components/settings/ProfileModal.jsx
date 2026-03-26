import { useState, useRef } from 'react'
import {
  X, Camera, Upload, Loader2, CheckCircle2, Trash2, User, Mail, Shield,
  Link2, Lock, Eye, EyeOff,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

export default function ProfileModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState(user?.user_metadata?.full_name || '')
  const [avatar, setAvatar] = useState(user?.user_metadata?.avatar_url || '')
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  if (!isOpen || !user) return null

  const userInitial = (name || user.email)?.[0]?.toUpperCase() || 'U'

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Validate
    if (!file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) return // 5MB max

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}_${Date.now()}.${ext}`

    const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('attachments').getPublicUrl(path)
      const url = data?.publicUrl
      if (url) {
        setAvatar(url)
        // Update auth user metadata
        await supabase.auth.updateUser({ data: { avatar_url: url } })
        // Update member records
        await supabase.from('org_members').update({ avatar_url: url }).eq('user_id', user.id)
        toast.success('Foto actualizada')
        showSaved()
      }
    }
    setUploading(false)
  }

  const handleRemoveAvatar = async () => {
    setAvatar('')
    await supabase.auth.updateUser({ data: { avatar_url: '' } })
    await supabase.from('org_members').update({ avatar_url: null }).eq('user_id', user.id)
    toast.success('Foto eliminada')
    showSaved()
  }

  const handleSaveName = async () => {
    if (!name.trim()) return
    setSaving(true)
    await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    await supabase.from('org_members').update({ name: name.trim() }).eq('user_id', user.id)
    setSaving(false)
    toast.success('Nombre actualizado')
    showSaved()
  }

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-card rounded-xl shadow-2xl border border-border animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Mi perfil</h2>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-success animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Guardado
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Avatar section */}
          <div className="flex flex-col items-center">
            <div className="relative group mb-3">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
                {avatar ? (
                  <img src={avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">{userInitial}</span>
                )}
              </div>

              {/* Upload overlay */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                {avatar ? 'Cambiar foto' : 'Subir foto'}
              </button>
              {avatar && (
                <button
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar
                </button>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground mt-2">JPG, PNG o GIF. Máximo 5MB.</p>
          </div>

          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
              <User className="w-3.5 h-3.5" />
              Nombre completo
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName() }}
                placeholder="Tu nombre"
                className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
              <button
                onClick={handleSaveName}
                disabled={saving || !name.trim()}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
              </button>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
              <Mail className="w-3.5 h-3.5" />
              Correo electrónico
            </label>
            <div className="px-3 py-2 rounded-lg border border-input bg-muted/50 text-sm text-muted-foreground">
              {user.email}
            </div>
          </div>

          {/* Connected accounts */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
              <Link2 className="w-3.5 h-3.5" />
              Cuentas conectadas
            </label>
            <div className="space-y-2">
              <GoogleConnect user={user} onSaved={showSaved} />
              <PasswordSection user={user} onSaved={showSaved} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleConnect({ user, onSaved }) {
  const isGoogleLinked = user?.app_metadata?.provider === 'google'
    || user?.app_metadata?.providers?.includes('google')
  const [loading, setLoading] = useState(false)

  const handleConnect = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) {
      toast.error('Error al conectar con Google')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between px-3 py-3 rounded-lg border border-border">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        <div>
          <p className="text-sm font-medium text-foreground">Google</p>
          <p className="text-[11px] text-muted-foreground">
            {isGoogleLinked ? 'Cuenta vinculada' : 'No vinculada'}
          </p>
        </div>
      </div>
      {isGoogleLinked ? (
        <span className="flex items-center gap-1 text-xs text-success">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Conectado
        </span>
      ) : (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Conectar'}
        </button>
      )}
    </div>
  )
}

function PasswordSection({ user, onSaved }) {
  const [showForm, setShowForm] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasPassword = user?.user_metadata?.password_set

  const handleSave = async () => {
    setError('')
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (password !== confirmPassword) { setError('No coinciden'); return }

    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { password_set: true },
    })
    if (err) {
      setError(err.message)
    } else {
      onSaved?.()
      setShowForm(false)
      setPassword('')
      setConfirmPassword('')
    }
    setLoading(false)
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-3">
          <Lock className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">Contraseña</p>
            <p className="text-[11px] text-muted-foreground">
              {hasPassword ? 'Contraseña configurada' : 'Sin contraseña'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
        >
          {hasPassword ? 'Cambiar' : 'Configurar'}
        </button>
      </div>

      {showForm && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border">
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Nueva contraseña"
              className="w-full px-3 py-2 pr-9 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
            placeholder="Confirmar contraseña"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => { setShowForm(false); setPassword(''); setConfirmPassword(''); setError('') }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !password}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
