import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const HIDDEN_IDLE_TIMEOUT = 60 * 1000 // 1 min when tab hidden
const UPDATE_INTERVAL = 60 * 1000 // Heartbeat every 60 seconds
const ACTIVITY_THROTTLE = 5 * 1000 // Throttle activity detection

// Statuses set manually by the user — auto-presence must NOT override these
const MANUAL_STATUSES = new Set(['dnd', 'invisible'])

export function usePresence(userId) {
  const lastActivity = useRef(Date.now())
  const lastDbUpdate = useRef(0)
  const currentStatus = useRef(null)
  const idleTimer = useRef(null)
  const avatarSynced = useRef(false)
  const hiddenAt = useRef(null)
  const accessTokenRef = useRef(null)

  // Keep access token updated for use in beforeunload (can't do async there)
  const refreshToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    accessTokenRef.current = session?.access_token || null
  }, [])

  // Whether the current status was set manually and should not be auto-changed
  const isManualStatus = useCallback(() => {
    return MANUAL_STATUSES.has(currentStatus.current)
  }, [])

  // Sync avatar from auth metadata to org_members on first load
  const syncAvatar = useCallback(async () => {
    if (!userId || avatarSynced.current) return
    avatarSynced.current = true
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const avatar = user?.user_metadata?.avatar_url
      if (avatar) {
        await supabase
          .from('org_members')
          .update({ avatar_url: avatar })
          .eq('user_id', userId)
      }
    } catch (e) { /* silent */ }
  }, [userId])

  const updateStatus = useCallback(async (status) => {
    if (!userId || currentStatus.current === status) return
    currentStatus.current = status
    localStorage.setItem('workflow-user-status', status)

    await supabase
      .from('org_members')
      .update({ status, last_active: new Date().toISOString() })
      .eq('user_id', userId)
    window.dispatchEvent(new Event('presence-changed'))
  }, [userId])

  const updateLastActive = useCallback(async () => {
    if (!userId) return
    // Update last_active for online AND idle users (proves tab is still open)
    // Skip for offline/invisible/dnd — those users shouldn't appear "active"
    if (currentStatus.current !== 'online' && currentStatus.current !== 'idle') return
    const now = Date.now()
    if (now - lastDbUpdate.current < UPDATE_INTERVAL) return
    lastDbUpdate.current = now

    await supabase
      .from('org_members')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', userId)
  }, [userId])

  const handleActivity = useCallback(() => {
    // Never override manual statuses (dnd, invisible)
    if (MANUAL_STATUSES.has(currentStatus.current)) return

    const now = Date.now()
    lastActivity.current = now

    // If was idle (auto), go back online
    if (currentStatus.current === 'idle') {
      updateStatus('online')
    }

    // Throttle DB updates
    if (now - lastDbUpdate.current >= ACTIVITY_THROTTLE) {
      updateLastActive()
    }

    // Reset idle timer
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => {
      if (currentStatus.current === 'online') {
        updateStatus('idle')
      }
    }, IDLE_TIMEOUT)
  }, [updateStatus, updateLastActive])

  useEffect(() => {
    if (!userId) return

    // Read initial status — respect any manually-chosen status from previous session
    const savedStatus = localStorage.getItem('workflow-user-status')
    if (savedStatus && savedStatus !== 'online') {
      // User had a non-online status — keep it
      currentStatus.current = savedStatus
      // Still update last_active so the DB row isn't stale on reload
      supabase
        .from('org_members')
        .update({ status: savedStatus, last_active: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => window.dispatchEvent(new Event('presence-changed')))
    } else {
      // Default: set online on mount
      updateStatus('online')
    }

    syncAvatar()
    lastDbUpdate.current = Date.now()

    // Start idle timer (only matters if not manual status)
    idleTimer.current = setTimeout(() => {
      if (currentStatus.current === 'online') {
        updateStatus('idle')
      }
    }, IDLE_TIMEOUT)

    // Listen for activity
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => document.addEventListener(e, handleActivity, { passive: true }))

    // Periodic heartbeat
    const heartbeat = setInterval(() => {
      refreshToken()
      if (currentStatus.current === 'online' || currentStatus.current === 'idle') {
        updateLastActive()
      }
    }, UPDATE_INTERVAL)

    // Cache the access token for use in beforeunload
    refreshToken()

    // Listen for manual status changes from Topbar (via localStorage)
    const handleStorageChange = (e) => {
      if (e.key === 'workflow-user-status' && e.newValue) {
        const newStatus = e.newValue
        if (newStatus !== currentStatus.current) {
          currentStatus.current = newStatus
          // If user switched back to online, restart idle timer
          if (newStatus === 'online') {
            lastActivity.current = Date.now()
            clearTimeout(idleTimer.current)
            idleTimer.current = setTimeout(() => {
              if (currentStatus.current === 'online') {
                updateStatus('idle')
              }
            }, IDLE_TIMEOUT)
          }
        }
      }
    }

    // Listen for same-tab storage writes from Topbar
    // (storage event only fires cross-tab, so we also patch localStorage)
    const originalSetItem = localStorage.setItem.bind(localStorage)
    localStorage.setItem = function (key, value) {
      originalSetItem(key, value)
      if (key === 'workflow-user-status' && value !== currentStatus.current) {
        currentStatus.current = value
        if (value === 'online') {
          lastActivity.current = Date.now()
          clearTimeout(idleTimer.current)
          idleTimer.current = setTimeout(() => {
            if (currentStatus.current === 'online') {
              updateStatus('idle')
            }
          }, IDLE_TIMEOUT)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Set offline on tab close using fetch with keepalive (supports auth headers)
    const handleBeforeUnload = () => {
      const accessToken = accessTokenRef.current
      if (!accessToken) return

      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/org_members?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ status: 'offline', last_active: new Date().toISOString() }),
        keepalive: true,
      })
    }

    // Handle visibility change
    const handleVisibility = () => {
      if (MANUAL_STATUSES.has(currentStatus.current)) return

      if (document.hidden) {
        hiddenAt.current = Date.now()
        clearTimeout(idleTimer.current)
        idleTimer.current = setTimeout(() => {
          if (currentStatus.current === 'online') {
            updateStatus('idle')
          }
        }, HIDDEN_IDLE_TIMEOUT)
      } else {
        const hiddenDuration = hiddenAt.current ? Date.now() - hiddenAt.current : 0
        hiddenAt.current = null

        if (hiddenDuration > IDLE_TIMEOUT && currentStatus.current === 'online') {
          updateStatus('idle')
        }
        handleActivity()
      }
    }

    // pagehide is more reliable than beforeunload on mobile
    const handlePageHide = (e) => {
      if (e.persisted) return
      handleBeforeUnload()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(idleTimer.current)
      clearInterval(heartbeat)
      events.forEach(e => document.removeEventListener(e, handleActivity))
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibility)
      // Restore original setItem
      localStorage.setItem = originalSetItem
    }
  }, [userId, handleActivity, updateStatus, updateLastActive, syncAvatar, refreshToken])
}
