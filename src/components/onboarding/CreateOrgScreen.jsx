import { useState } from 'react'
import { Building2, ArrowRight, Sparkles } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'sonner'

export default function CreateOrgScreen() {
  const { dispatch } = useApp()
  const { user, signOut } = useAuth()
  const { createOrganization, fetchOrganizations } = useSupabase()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { data, error } = await createOrganization({
      name: name.trim(),
      owner_id: user.id,
      color: '#000000',
    })
    if (error) {
      toast.error('Error al crear la organización')
      setLoading(false)
      return
    }
    toast.success('Organización creada')
    // Re-fetch to ensure everything is in sync
    await fetchOrganizations()
    setLoading(false)
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold text-foreground">WorkFlow</span>
        </div>

        {/* Welcome */}
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Bienvenido, {userName}
        </h1>
        <p className="text-muted-foreground mb-8">
          Crea tu organización para comenzar a gestionar tus proyectos y equipos.
        </p>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              Nombre de la organización
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Mi empresa, Mi equipo..."
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando...' : (
              <>
                Crear organización
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Sign out */}
        <div className="mt-6 text-center">
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
