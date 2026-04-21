import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSubscription(userId) {
  const [orgAccess, setOrgAccess] = useState({}) // { orgId: boolean }
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check if a specific org has access (owner has active subscription)
  const checkOrgAccess = useCallback(async (orgId) => {
    if (!orgId) return false
    const { data, error } = await supabase.rpc('check_org_has_access', { check_org_id: orgId })
    if (error) {
      console.error('checkOrgAccess error:', error.message)
      return false
    }
    setOrgAccess(prev => ({ ...prev, [orgId]: !!data }))
    return !!data
  }, [])

  // Check access for multiple orgs at once
  const checkAllOrgsAccess = useCallback(async (orgs) => {
    if (!orgs || orgs.length === 0) { setLoading(false); return }
    const results = {}
    for (const org of orgs) {
      const { data } = await supabase.rpc('check_org_has_access', { check_org_id: org.id })
      results[org.id] = !!data
    }
    // Merge with existing access instead of replacing, to avoid losing
    // current org access state while checking new orgs
    setOrgAccess(prev => ({ ...prev, ...results }))
    setLoading(false)
    return results
  }, [])

  // Fetch the subscription for a specific org (for display in paywall/settings)
  const fetchOrgSubscription = useCallback(async (orgId) => {
    if (!orgId) return null

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    setSubscription(sub)
    return sub
  }, [])

  // Re-check when window gets focus (user returns from payment)
  useEffect(() => {
    const handleFocus = () => {
      // Re-check all orgs that we've already checked
      const orgIds = Object.keys(orgAccess)
      orgIds.forEach(id => checkOrgAccess(id))
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [orgAccess, checkOrgAccess])

  // Check URL params for payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      window.history.replaceState({}, '', window.location.pathname)
      setTimeout(() => {
        const orgIds = Object.keys(orgAccess)
        orgIds.forEach(id => checkOrgAccess(id))
      }, 2000)
    }
  }, [])

  return {
    orgAccess,
    subscription,
    loading,
    checkOrgAccess,
    checkAllOrgsAccess,
    fetchOrgSubscription,
  }
}
