import { useState, useEffect, useRef } from 'react'
import {
  Bell, Check, X, Loader2, Mail, Users,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'

export default function InviteNotifications() {
  const { user } = useAuth()
  const { fetchMyInvites, acceptInvite, declineInvite, fetchOrganizations } = useSupabase()
  const [invites, setInvites] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loadingId, setLoadingId] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (user?.email) {
      loadInvites()
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadInvites = async () => {
    const { data } = await fetchMyInvites(user.email)
    if (data) setInvites(data)
  }

  const handleAccept = async (invite) => {
    setLoadingId(invite.id)
    const userName = user.user_metadata?.full_name || user.email.split('@')[0]
    const { error } = await acceptInvite(
      invite.id,
      invite.org_id,
      user.id,
      userName,
      user.email,
    )
    if (!error) {
      setInvites(prev => prev.filter(i => i.id !== invite.id))
      await fetchOrganizations()
    }
    setLoadingId(null)
  }

  const handleDecline = async (invite) => {
    setLoadingId(invite.id)
    const { error } = await declineInvite(invite.id)
    if (!error) {
      setInvites(prev => prev.filter(i => i.id !== invite.id))
    }
    setLoadingId(null)
  }

  const pendingCount = invites.length

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors relative"
      >
        <Bell className="w-4 h-4" />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
            {pendingCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-80 rounded-xl border border-border bg-popover shadow-lg z-50 animate-scale-in overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
            {pendingCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {pendingCount} invitacion{pendingCount > 1 ? 'es' : ''} pendiente{pendingCount > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4">
                <Mail className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground text-center">
                  No tienes invitaciones pendientes
                </p>
              </div>
            ) : (
              invites.map(invite => (
                <div key={invite.id} className="px-4 py-3 border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                      style={{ backgroundColor: invite.organizations?.color || '#6c5ce7' }}
                    >
                      {invite.organizations?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        Te invitaron a{' '}
                        <span className="font-semibold">{invite.organizations?.name || 'Organizacion'}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Por: {invite.invited_by_name} · Rol: {invite.role}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => handleAccept(invite)}
                          disabled={loadingId === invite.id}
                          className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {loadingId === invite.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          Aceptar
                        </button>
                        <button
                          onClick={() => handleDecline(invite)}
                          disabled={loadingId === invite.id}
                          className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                          Rechazar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
