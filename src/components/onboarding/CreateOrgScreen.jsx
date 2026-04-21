import { useState, useEffect } from 'react'
import { ArrowRight, Loader2, LogIn } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { toast } from 'sonner'

export default function CreateOrgScreen() {
  const { dispatch } = useApp()
  const { user, signOut } = useAuth()
  const { theme } = useTheme()
  const { createOrganization, fetchOrganizations } = useSupabase()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [invites, setInvites] = useState([])
  const [loadingInvites, setLoadingInvites] = useState(true)
  const [joiningId, setJoiningId] = useState(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

  // Fetch pending/accepted invites
  useEffect(() => {
    if (!user?.email) return

    const fetchInvites = async () => {
      // Wait for auth session to be fully established (critical on magic link redirect)
      await supabase.auth.getSession()

      const client = supabaseAdmin || supabase
      const { data } = await client
        .from('org_invites')
        .select('*, organizations(name, color, icon_url)')
        .eq('email', user.email)
        .in('status', ['pending', 'accepted'])

      setInvites(data || [])
      setLoadingInvites(false)
    }

    fetchInvites()
  }, [user?.email])

  const handleJoinOrg = async (invite) => {
    setJoiningId(invite.id)
    const client = supabaseAdmin || supabase
    const memberData = {
      org_id: invite.org_id,
      user_id: user.id,
      name: user.user_metadata?.full_name || user.email.split('@')[0],
      email: user.email,
      role: invite.role || 'member',
      workspace_ids: invite.workspace_ids || [],
      color: ['#6c5ce7', '#00b894', '#0984e3', '#e17055', '#fdcb6e'][Math.floor(Math.random() * 5)],
      avatar_url: user.user_metadata?.avatar_url || null,
    }
    if (invite.custom_permissions) memberData.custom_permissions = invite.custom_permissions

    const { error: memberErr } = await client.from('org_members').insert(memberData)
    if (memberErr) {
      // If duplicate, the member already exists — just proceed
      if (!memberErr.message?.includes('duplicate')) {
        toast.error('Error al unirse: ' + memberErr.message)
        setJoiningId(null)
        return
      }
    }

    // Mark invite as accepted
    if (invite.status === 'pending') {
      await client.from('org_invites').update({ status: 'accepted' }).eq('id', invite.id)
    }

    toast.success(`Te uniste a ${invite.org_name || invite.organizations?.name || 'la organización'}`)
    await fetchOrganizations()
    setJoiningId(null)
  }

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
    await fetchOrganizations()
    setLoading(false)
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <img
            src={theme === 'dark'
              ? 'https://fkhukpqhmpudsarnusvf.supabase.co/storage/v1/object/public/attachments/w-icons/w4-blanco.png'
              : 'https://fkhukpqhmpudsarnusvf.supabase.co/storage/v1/object/public/attachments/w-icons/w-negro.png'
            }
            alt="WorkFlow"
            className="w-10 h-10 rounded-lg"
          />
          <span className="text-xl font-semibold text-foreground">WorkFlow</span>
        </div>

        {/* Welcome */}
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Bienvenido, {userName}
        </h1>

        {/* Pending invites */}
        {loadingInvites ? (
          <div className="flex items-center gap-2 text-muted-foreground mb-8">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Verificando invitaciones...</span>
          </div>
        ) : invites.length > 0 ? (
          <div className="mb-8">
            <p className="text-muted-foreground mb-4">
              Tienes acceso a {invites.length === 1 ? 'una organización' : `${invites.length} organizaciones`}.
            </p>
            <div className="space-y-2">
              {invites.map(invite => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg overflow-hidden"
                      style={{ backgroundColor: invite.org_color || invite.organizations?.color || '#0a0a0a' }}
                    >
                      {(invite.org_icon_url || invite.organizations?.icon_url) ? (
                        <img src={invite.org_icon_url || invite.organizations?.icon_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (invite.org_name || invite.organizations?.name || '?')[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{invite.org_name || invite.organizations?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">Rol: {invite.role || 'member'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinOrg(invite)}
                    disabled={joiningId === invite.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {joiningId === invite.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        Entrar
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>

            {/* Create org button */}
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 w-full py-2.5 px-4 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              Crear mi propia organización
            </button>
          </div>
        ) : (
          <p className="text-muted-foreground mb-8">
            Crea tu organización para comenzar a gestionar tus proyectos y equipos.
          </p>
        )}

        {/* Create org form - always visible if no invites, or toggled if invites exist */}
        {(invites.length === 0 || showCreateForm) && (
          <div className="space-y-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
              placeholder="Nombre de la organización..."
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
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
        )}

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
