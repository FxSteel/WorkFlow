import { useState, useEffect } from 'react'
import {
  CreditCard, Check, Loader2, ExternalLink, LogOut,
  Sun, Moon, Lock, Unlock, ArrowRight, Mail,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

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

export default function Paywall({ currentOrg, organizations, orgAccess, isOwner }) {
  const { user, signOut } = useAuth()
  const { dispatch } = useApp()
  const { theme, toggleTheme } = useTheme()
  const [paying, setPaying] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ownerEmail, setOwnerEmail] = useState(null)

  useEffect(() => {
    checkSubscription()
    if (!isOwner && currentOrg) {
      // Fetch owner info for members to contact
      fetchOwnerInfo()
    }
  }, [currentOrg?.id])

  const fetchOwnerInfo = async () => {
    if (!currentOrg) return
    const { data } = await supabase
      .from('org_members')
      .select('email, name')
      .eq('org_id', currentOrg.id)
      .eq('role', 'owner')
      .limit(1)
      .single()
    if (data) setOwnerEmail(data.email || data.name)
  }

  const checkSubscription = async () => {
    if (!currentOrg) { setLoading(false); return }
    setLoading(true)

    // Get the subscription for this org
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Sync with AlohaPay if pending
    if (data?.status === 'pending' && data?.payment_link_id) {
      try {
        const res = await fetch(
          `https://api.alohapay.co/api/external/v1/payment-links/${data.payment_link_id}`,
          { headers: { 'X-API-KEY': import.meta.env.VITE_ALOHAPAY_API_KEY } }
        )
        const result = await res.json()
        if (result.success && result.data) {
          let newStatus = data.status
          if (result.data.status === 'completed') newStatus = 'active'
          else if (result.data.status === 'cancelled') newStatus = 'cancelled'
          else if (result.data.status === 'expired') newStatus = 'expired'
          if (newStatus !== data.status) {
            await supabase.from('subscriptions').update({ status: newStatus }).eq('id', data.id)
            data.status = newStatus
          }
        }
      } catch {}
    }

    setSubscription(data)
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
          description: `Suscripción WorkFlow - ${currentOrg?.name || 'Organización'}`,
          success_url: window.location.origin + '?payment=success',
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          org_id: currentOrg?.id,
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
        checkSubscription()
      }
    } catch (err) {
      console.error('Payment error:', err)
    }
    setPaying(false)
  }

  const handleSwitchOrg = (org) => {
    dispatch({ type: 'SET_CURRENT_ORG', payload: org })
    localStorage.setItem('workflow-current-org', org.id)
  }

  const isPending = subscription?.status === 'pending'
  const isExpired = subscription && subscription.status === 'active' &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) < new Date()

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

  // Separate orgs into active and blocked
  const activeOrgs = organizations?.filter(o => orgAccess[o.id]) || []
  const blockedOrgs = organizations?.filter(o => !orgAccess[o.id]) || []

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <img
            src={theme === 'dark'
              ? 'https://fkhukpqhmpudsarnusvf.supabase.co/storage/v1/object/public/attachments/w-icons/w4-blanco.png'
              : 'https://fkhukpqhmpudsarnusvf.supabase.co/storage/v1/object/public/attachments/w-icons/w-negro.png'
            }
            alt="WorkFlow"
            className="w-8 h-8 rounded-lg"
          />
          <span className="font-semibold text-foreground">WorkFlow</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg animate-fade-in">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isOwner
                ? (isExpired ? '¡Tu suscripción venció!' : 'Suscripción requerida')
                : `${currentOrg?.name || 'Organización'} está bloqueada`
              }
            </h1>
            <p className="text-muted-foreground text-sm">
              {isOwner
                ? `Activa la suscripción de ${currentOrg?.name || 'tu organización'} para que tú y tu equipo puedan trabajar.`
                : 'El administrador de esta organización necesita activar la suscripción.'
              }
            </p>
          </div>

          {/* Owner view: payment card */}
          {isOwner && (
            <div className="rounded-xl border-2 border-foreground p-6 bg-card mb-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-lg font-bold text-foreground">WorkFlow Pro</h3>
                  <p className="text-xs text-muted-foreground">Acceso completo para toda tu organización</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-foreground">$25.000</p>
                  <p className="text-xs text-muted-foreground">CLP / mes</p>
                </div>
              </div>

              <div className="space-y-2.5 mb-6">
                {PLAN_FEATURES.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              {isPending ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div>
                      <p className="text-sm font-medium text-foreground">Pago pendiente</p>
                      <p className="text-xs text-muted-foreground">Completa tu pago para activar</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      Pendiente
                    </span>
                  </div>
                  <a
                    href={subscription.payment_link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Completar pago
                  </a>
                  <button
                    onClick={checkSubscription}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    Ya pagué — verificar estado
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={paying}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {paying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      {isExpired ? 'Renovar suscripción' : 'Suscribirse ahora'}
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Member view: contact admin */}
          {!isOwner && (
            <div className="rounded-xl border border-border p-6 bg-card mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: currentOrg?.color || '#6c5ce7' }}
                >
                  {currentOrg?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{currentOrg?.name}</h3>
                  <p className="text-xs text-muted-foreground">Suscripción inactiva</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-muted/50 mb-4">
                <p className="text-sm text-foreground mb-1">
                  Contacta al administrador para reactivar el acceso:
                </p>
                {ownerEmail && (
                  <div className="flex items-center gap-2 mt-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-primary">{ownerEmail}</span>
                  </div>
                )}
              </div>

              <button
                onClick={checkSubscription}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Verificar si ya fue activada
              </button>
            </div>
          )}

          {/* Org switcher: show active orgs the user can access */}
          {activeOrgs.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Organizaciones activas — puedes acceder a:
              </p>
              <div className="space-y-2">
                {activeOrgs.map(org => (
                  <button
                    key={org.id}
                    onClick={() => handleSwitchOrg(org)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: org.color || '#6c5ce7' }}
                    >
                      {org.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{org.name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show blocked orgs list if there are multiple */}
          {blockedOrgs.length > 1 && (
            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Organizaciones bloqueadas por falta de pago:
              </p>
              <div className="space-y-1.5">
                {blockedOrgs.map(org => (
                  <div
                    key={org.id}
                    className={cn(
                      'flex items-center gap-3 p-2.5 rounded-lg border text-left',
                      org.id === currentOrg?.id
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border bg-card/50 opacity-60'
                    )}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: org.color || '#6c5ce7' }}
                    >
                      {org.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <p className="text-sm text-foreground truncate flex-1">{org.name}</p>
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Pagos procesados de forma segura por AlohaPay
          </p>
        </div>
      </div>
    </div>
  )
}
