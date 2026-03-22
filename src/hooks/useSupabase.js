import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

export function useSupabase() {
  const { dispatch } = useApp()

  const fetchWorkspaces = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
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

  const fetchMembers = useCallback(async (workspaceId) => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('workspace_id', workspaceId)
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

      // Add owner as member of the workspace
      if (workspace.owner_id) {
        const { data: userData } = await supabase.auth.getUser()
        const ownerName = userData?.user?.user_metadata?.full_name
          || userData?.user?.email?.split('@')[0]
          || 'Admin'
        const ownerEmail = userData?.user?.email || ''
        await supabase
          .from('members')
          .insert({
            workspace_id: data.id,
            user_id: workspace.owner_id,
            name: ownerName,
            email: ownerEmail,
            role: 'admin',
            color: '#000000',
          })
      }
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

  // --- Invites ---

  const fetchInvites = useCallback(async (workspaceId) => {
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
    if (!error && data) dispatch({ type: 'SET_INVITES', payload: data })
    return { data, error }
  }, [dispatch])

  const createInvite = useCallback(async (invite) => {
    const { data, error } = await supabase
      .from('workspace_invites')
      .insert(invite)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'ADD_INVITE', payload: data })
    return { data, error }
  }, [dispatch])

  const deleteInvite = useCallback(async (id) => {
    const { error } = await supabase
      .from('workspace_invites')
      .delete()
      .eq('id', id)
    if (!error) dispatch({ type: 'DELETE_INVITE', payload: id })
    return { error }
  }, [dispatch])

  const acceptInvite = useCallback(async (inviteId, workspaceId, userId, userName, userEmail) => {
    // Add user as member
    const { error: memberError } = await supabase
      .from('members')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        name: userName,
        email: userEmail,
        role: 'member',
        color: ['#6c5ce7', '#00b894', '#0984e3', '#e17055', '#fdcb6e'][Math.floor(Math.random() * 5)],
      })
    if (memberError) return { error: memberError }

    // Update invite status
    const { error: inviteError } = await supabase
      .from('workspace_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId)
    return { error: inviteError }
  }, [])

  const declineInvite = useCallback(async (inviteId) => {
    const { error } = await supabase
      .from('workspace_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId)
    return { error }
  }, [])

  const fetchMyInvites = useCallback(async (email) => {
    const { data, error } = await supabase
      .from('workspace_invites')
      .select('*, workspaces(name, color)')
      .eq('email', email)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    return { data, error }
  }, [])

  return {
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
  }
}
