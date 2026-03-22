import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSubscription(userId) {
  const [hasAccess, setHasAccess] = useState(null) // null = loading
  const [subscription, setSubscription] = useState(null)

  const checkAccess = useCallback(async () => {
    if (!userId) { setHasAccess(false); return }

    // 1. Check if the user has their own active subscription
    const { data: ownSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (ownSub) {
      const now = new Date()
      const end = ownSub.current_period_end ? new Date(ownSub.current_period_end) : null
      if (!end || now <= end) {
        setHasAccess(true)
        setSubscription(ownSub)
        return
      } else {
        await supabase.from('subscriptions').update({ status: 'expired' }).eq('id', ownSub.id)
      }
    }

    // 2. Check if user is a member of any organization whose OWNER has an active subscription
    const { data: memberships } = await supabase
      .from('org_members')
      .select('org_id, organizations(owner_id)')
      .eq('user_id', userId)

    if (memberships && memberships.length > 0) {
      const ownerIds = [...new Set(memberships.map(m => m.organizations?.owner_id).filter(Boolean))]

      for (const ownerId of ownerIds) {
        if (ownerId === userId) continue // Already checked own sub

        const { data: ownerSub } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', ownerId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (ownerSub) {
          const now = new Date()
          const end = ownerSub.current_period_end ? new Date(ownerSub.current_period_end) : null
          if (!end || now <= end) {
            setHasAccess(true)
            setSubscription(ownerSub)
            return
          }
        }
      }
    }

    // No access
    setHasAccess(false)
    setSubscription(null)
  }, [userId])

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  // Re-check when window gets focus (user returns from payment)
  useEffect(() => {
    const handleFocus = () => checkAccess()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [checkAccess])

  // Check URL params for payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(checkAccess, 2000)
    }
  }, [checkAccess])

  return { hasAccess, subscription, checkAccess }
}
