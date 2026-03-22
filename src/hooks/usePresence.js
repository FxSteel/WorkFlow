import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const IDLE_TIMEOUT = 10 * 60 * 1000 // 10 minutes
const UPDATE_INTERVAL = 60 * 1000 // Update DB every 60 seconds
const ACTIVITY_THROTTLE = 5 * 1000 // Throttle activity detection

export function usePresence(userId) {
  const lastActivity = useRef(Date.now())
  const lastDbUpdate = useRef(0)
  const currentStatus = useRef('online')
  const idleTimer = useRef(null)

  const updateStatus = useCallback(async (status) => {
    if (!userId || currentStatus.current === status) return
    currentStatus.current = status
    localStorage.setItem('workflow-user-status', status)

    await supabase
      .from('members')
      .update({ status, last_active: new Date().toISOString() })
      .eq('user_id', userId)
  }, [userId])

  const updateLastActive = useCallback(async () => {
    if (!userId) return
    const now = Date.now()
    if (now - lastDbUpdate.current < UPDATE_INTERVAL) return
    lastDbUpdate.current = now

    await supabase
      .from('members')
      .update({ last_active: new Date().toISOString() })
      .eq('user_id', userId)
  }, [userId])

  const handleActivity = useCallback(() => {
    const now = Date.now()
    lastActivity.current = now

    // If was idle, go back online
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
      // Only auto-idle if currently online (not dnd/invisible)
      if (currentStatus.current === 'online') {
        updateStatus('idle')
      }
    }, IDLE_TIMEOUT)
  }, [updateStatus, updateLastActive])

  useEffect(() => {
    if (!userId) return

    // Set online on mount
    updateStatus('online')
    lastDbUpdate.current = Date.now()

    // Start idle timer
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
      if (currentStatus.current === 'online' || currentStatus.current === 'idle') {
        updateLastActive()
      }
    }, UPDATE_INTERVAL)

    // Set offline/invisible on tab close
    const handleBeforeUnload = () => {
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/members?user_id=eq.${userId}`,
        JSON.stringify({ status: 'invisible', last_active: new Date().toISOString() })
      )
    }

    // Handle visibility change (tab hidden = idle after timeout)
    const handleVisibility = () => {
      if (document.hidden) {
        // Start shorter idle timer when tab is hidden
        clearTimeout(idleTimer.current)
        idleTimer.current = setTimeout(() => {
          if (currentStatus.current === 'online') {
            updateStatus('idle')
          }
        }, 60 * 1000) // 1 min when tab hidden
      } else {
        handleActivity()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimeout(idleTimer.current)
      clearInterval(heartbeat)
      events.forEach(e => document.removeEventListener(e, handleActivity))
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [userId, handleActivity, updateStatus, updateLastActive])
}
