import { useState, useEffect } from 'react'
import {
  Sparkles, CreditCard, Check, Loader2, ExternalLink, LogOut,
  Sun, Moon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
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

export default function Paywall() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [paying, setPaying] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSubscription()
  }, [])

  const checkSubscription = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
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
          description: 'Pago de suscripción Mensual - WorkFlow',
          success_url: window.location.origin + '?payment=success',
        }),
      })

      const result = await response.json()

      if (result.success && result.data) {
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

        window.open(result.data.url, '_blank')
        checkSubscription()
      }
    } catch (err) {
      console.error('Payment error:', err)
    }
    setPaying(false)
  }

  const isPending = subscription?.status === 'pending'
  const isExpired = subscription && subscription.status === 'active' &&
    subscription.current_period_end &&
    new Date(subscription.current_period_end) < new Date()

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

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
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
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
        <div className="w-full max-w-md animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isExpired ? '¡Tu suscripción venció!' : `¡Hola, ${userName}!`}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isExpired
                ? 'Renueva tu suscripción para seguir usando WorkFlow.'
                : 'Suscríbete para comenzar a gestionar tus proyectos con WorkFlow.'
              }
            </p>
          </div>

          {/* Plan card */}
          <div className="rounded-xl border-2 border-foreground p-6 bg-card mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">WorkFlow Pro</h3>
                <p className="text-xs text-muted-foreground">Acceso completo por 30 días</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-foreground">$25.000</p>
                <p className="text-xs text-muted-foreground">CLP / mes</p>
              </div>
            </div>

            <div className="space-y-2.5 mb-6">
              {PLAN_FEATURES.map((feature, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-success shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>

            {isPending ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <div>
                    <p className="text-sm font-medium text-foreground">Pago pendiente</p>
                    <p className="text-xs text-muted-foreground">Completa tu pago para activar</p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning">
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

          <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" />
            Pagos procesados de forma segura por AlohaPay
          </p>
        </div>
      </div>
    </div>
  )
}
