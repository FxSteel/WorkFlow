import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

export function useSupabase() {
  const { dispatch } = useApp()

  // --- Organizations ---

  const fetchOrganizations = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true })
    if (!error && data) dispatch({ type: 'SET_ORGANIZATIONS', payload: data })
    dispatch({ type: 'SET_LOADING', payload: false })
    return { data, error }
  }, [dispatch])

  const createOrganization = useCallback(async (org) => {
    const { data, error } = await supabase
      .from('organizations')
      .insert(org)
      .select()
      .single()
    if (!error && data) {
      dispatch({ type: 'ADD_ORGANIZATION', payload: data })

      // Add owner as org_member
      if (org.owner_id) {
        const { data: userData } = await supabase.auth.getUser()
        const ownerName = userData?.user?.user_metadata?.full_name
          || userData?.user?.email?.split('@')[0]
          || 'Admin'
        const ownerEmail = userData?.user?.email || ''
        await supabase
          .from('org_members')
          .insert({
            org_id: data.id,
            user_id: org.owner_id,
            name: ownerName,
            email: ownerEmail,
            role: 'owner',
            color: '#000000',
          })
      }

      // Create default workspace "General"
      const { data: wsData } = await supabase
        .from('workspaces')
        .insert({ name: 'General', owner_id: org.owner_id, color: org.color || '#6c5ce7', org_id: data.id })
        .select()
        .single()
      if (wsData) {
        dispatch({ type: 'ADD_WORKSPACE', payload: wsData })
        // Create default board "Tareas" in the workspace
        const { data: boardData } = await supabase
          .from('boards')
          .insert({ name: 'Tareas', workspace_id: wsData.id })
          .select()
          .single()
        if (boardData) dispatch({ type: 'ADD_BOARD', payload: boardData })
      }
    }
    return { data, error }
  }, [dispatch])

  const updateOrganization = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      dispatch({ type: 'UPDATE_ORGANIZATION', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const deleteOrganization = useCallback(async (id) => {
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', id)
    if (!error) dispatch({ type: 'DELETE_ORGANIZATION', payload: id })
    return { error }
  }, [dispatch])

  const fetchOrgMembers = useCallback(async (orgId) => {
    const { data, error } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true })
    if (!error && data) {
      dispatch({ type: 'SET_ORG_MEMBERS', payload: data })
    }
    return { data, error }
  }, [dispatch])

  // --- Workspaces ---

  const fetchWorkspaces = useCallback(async (orgId) => {
    if (!orgId) return { data: null, error: null }
    dispatch({ type: 'SET_LOADING', payload: true })
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
    if (!error && data) dispatch({ type: 'SET_WORKSPACES', payload: data })
    dispatch({ type: 'SET_LOADING', payload: false })
    return { data, error }
  }, [dispatch])

  const fetchBoards = useCallback(async (workspaceId) => {
    const { data, error } = await supabase
      .from('boards')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })
    if (!error && data) dispatch({ type: 'MERGE_BOARDS', payload: { workspaceId, boards: data } })
    return { data, error }
  }, [dispatch])

  const fetchSprints = useCallback(async (boardId) => {
    const { data, error } = await supabase
      .from('sprints')
      .select('*')
      .eq('board_id', boardId)
      .order('start_date', { ascending: true })
    if (!error && data) dispatch({ type: 'SET_SPRINTS', payload: data })
    return { data, error }
  }, [dispatch])

  const fetchTasks = useCallback(async (boardId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true })
    if (!error && data) dispatch({ type: 'SET_TASKS', payload: data })
    return { data, error }
  }, [dispatch])

  const fetchMembers = useCallback(async (orgId) => {
    // Now fetches from org_members instead of members
    const { data, error } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', orgId)
      .order('name', { ascending: true })

    if (!error && data) {
      dispatch({ type: 'SET_MEMBERS', payload: data })
    }
    return { data, error }
  }, [dispatch])

  // --- Workspaces ---

  const createWorkspace = useCallback(async (workspace) => {
    const { data, error } = await supabase
      .from('workspaces')
      .insert(workspace)
      .select()
      .single()
    if (!error && data) {
      dispatch({ type: 'ADD_WORKSPACE', payload: data })
      // Create default "Tareas" board
      const { data: boardData } = await supabase
        .from('boards')
        .insert({ name: 'Tareas', workspace_id: data.id })
        .select()
        .single()
      if (boardData) dispatch({ type: 'ADD_BOARD', payload: boardData })
    }
    return { data, error }
  }, [dispatch])

  const deleteWorkspace = useCallback(async (id) => {
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id)
    if (!error) dispatch({ type: 'DELETE_WORKSPACE', payload: id })
    return { error }
  }, [dispatch])

  const updateWorkspace = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      dispatch({ type: 'UPDATE_WORKSPACE', payload: data })
    }
    return { data, error }
  }, [dispatch])

  // --- Boards ---

  const createBoard = useCallback(async (board) => {
    const { data, error } = await supabase
      .from('boards')
      .insert(board)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'ADD_BOARD', payload: data })
    return { data, error }
  }, [dispatch])

  const deleteBoard = useCallback(async (id) => {
    const { error } = await supabase
      .from('boards')
      .delete()
      .eq('id', id)
    if (!error) dispatch({ type: 'DELETE_BOARD', payload: id })
    return { error }
  }, [dispatch])

  const updateBoard = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('boards')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'UPDATE_BOARD', payload: data })
    return { data, error }
  }, [dispatch])

  // --- Sprints ---

  const createSprint = useCallback(async (sprint) => {
    const { data, error } = await supabase
      .from('sprints')
      .insert(sprint)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'ADD_SPRINT', payload: data })
    return { data, error }
  }, [dispatch])

  const updateSprint = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('sprints')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'UPDATE_SPRINT', payload: data })
    return { data, error }
  }, [dispatch])

  const deleteSprint = useCallback(async (id) => {
    const { error } = await supabase
      .from('sprints')
      .delete()
      .eq('id', id)
    if (!error) dispatch({ type: 'DELETE_SPRINT', payload: id })
    return { error }
  }, [dispatch])

  // --- Tasks ---

  const createTask = useCallback(async (task) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'ADD_TASK', payload: data })
    return { data, error }
  }, [dispatch])

  const updateTask = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'UPDATE_TASK', payload: data })
    return { data, error }
  }, [dispatch])

  const deleteTask = useCallback(async (id) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    if (!error) dispatch({ type: 'DELETE_TASK', payload: id })
    return { error }
  }, [dispatch])

  // --- Invites (org_invites) ---

  const fetchInvites = useCallback(async (orgId) => {
    const { data, error } = await supabase
      .from('org_invites')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (!error && data) dispatch({ type: 'SET_INVITES', payload: data })
    return { data, error }
  }, [dispatch])

  const createInvite = useCallback(async (invite) => {
    const { data, error } = await supabase
      .from('org_invites')
      .insert(invite)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'ADD_INVITE', payload: data })
    return { data, error }
  }, [dispatch])

  const deleteInvite = useCallback(async (id) => {
    const { error } = await supabase
      .from('org_invites')
      .delete()
      .eq('id', id)
    if (!error) dispatch({ type: 'DELETE_INVITE', payload: id })
    return { error }
  }, [dispatch])

  const acceptInvite = useCallback(async (inviteId, orgId, userId, userName, userEmail) => {
    // Add user as org_member
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: orgId,
        user_id: userId,
        name: userName,
        email: userEmail,
        role: 'member',
        color: ['#6c5ce7', '#00b894', '#0984e3', '#e17055', '#fdcb6e'][Math.floor(Math.random() * 5)],
      })
    if (memberError) return { error: memberError }

    // Update invite status
    const { error: inviteError } = await supabase
      .from('org_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId)
    return { error: inviteError }
  }, [])

  const declineInvite = useCallback(async (inviteId) => {
    const { error } = await supabase
      .from('org_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId)
    return { error }
  }, [])

  const fetchMyInvites = useCallback(async (email) => {
    const { data, error } = await supabase
      .from('org_invites')
      .select('*, organizations(name, color)')
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    return { data, error }
  }, [])

  // --- Board Statuses ---

  const DEFAULT_STATUSES = [
    { name: 'Backlog', color: '#6b7280', position: 0 },
    { name: 'Por hacer', color: '#9ca3af', position: 1 },
    { name: 'En progreso', color: '#3b82f6', position: 2 },
    { name: 'En revisión', color: '#eab308', position: 3 },
    { name: 'Completado', color: '#22c55e', position: 4 },
    { name: 'Bloqueado', color: '#ef4444', position: 5 },
  ]

  const fetchBoardStatuses = useCallback(async (boardId) => {
    const { data, error } = await supabase
      .from('board_statuses')
      .select('*')
      .eq('board_id', boardId)
      .order('position', { ascending: true })
    if (!error && data) {
      dispatch({ type: 'SET_BOARD_STATUSES', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const initDefaultStatuses = useCallback(async (boardId) => {
    // Check if board already has statuses
    const { data: existing } = await supabase
      .from('board_statuses')
      .select('id')
      .eq('board_id', boardId)
      .limit(1)
    if (existing && existing.length > 0) return // Already has statuses

    const statuses = DEFAULT_STATUSES.map(s => ({ ...s, board_id: boardId }))
    const { data, error } = await supabase
      .from('board_statuses')
      .insert(statuses)
      .select()
    if (!error && data) {
      dispatch({ type: 'SET_BOARD_STATUSES', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const createBoardStatus = useCallback(async (boardId, name, color, position) => {
    const { data, error } = await supabase
      .from('board_statuses')
      .insert({ board_id: boardId, name, color, position })
      .select()
      .single()
    if (!error && data) {
      dispatch({ type: 'ADD_BOARD_STATUS', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const updateBoardStatus = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('board_statuses')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      dispatch({ type: 'UPDATE_BOARD_STATUS', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const deleteBoardStatus = useCallback(async (id) => {
    const { error } = await supabase
      .from('board_statuses')
      .delete()
      .eq('id', id)
    if (!error) {
      dispatch({ type: 'DELETE_BOARD_STATUS', payload: id })
    }
    return { error }
  }, [dispatch])

  return {
    fetchOrganizations,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    fetchOrgMembers,
    fetchWorkspaces,
    fetchBoards,
    fetchSprints,
    fetchTasks,
    fetchMembers,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    createBoard,
    deleteBoard,
    updateBoard,
    createSprint,
    updateSprint,
    deleteSprint,
    createTask,
    updateTask,
    deleteTask,
    fetchInvites,
    createInvite,
    deleteInvite,
    acceptInvite,
    declineInvite,
    fetchMyInvites,
    fetchBoardStatuses,
    createBoardStatus,
    updateBoardStatus,
    deleteBoardStatus,
    initDefaultStatuses,
  }
}
