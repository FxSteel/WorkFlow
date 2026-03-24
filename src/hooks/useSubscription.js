import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSubscription(userId) {
  const [hasAccess, setHasAccess] = useState(null) // null = loading
  const [subscription, setSubscription] = useState(null)

  const checkAccess = useCallback(async () => {
    if (!userId) { setHasAccess(false); return }

    // Use SECURITY DEFINER function to check access (bypasses RLS issues)
    const { data, error } = await supabase.rpc('check_user_has_access', { check_user_id: userId })

    if (error) {
      console.error('checkAccess error:', error.message)
      setHasAccess(false)
      setSubscription(null)
      return
    }

    setHasAccess(!!data)

    // If has access, fetch own subscription for display purposes
    if (data) {
      const { data: ownSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      setSubscription(ownSub || { status: 'active', plan: 'pro' })
    } else {
      setSubscription(null)
    }
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
