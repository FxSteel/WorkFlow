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
        if (boardData) {
          dispatch({ type: 'ADD_BOARD', payload: boardData })
          // Init default statuses
          const defaultStatuses = [
            { name: 'Backlog', color: '#6b7280', position: 0, board_id: boardData.id },
            { name: 'Por hacer', color: '#9ca3af', position: 1, board_id: boardData.id },
            { name: 'En progreso', color: '#3b82f6', position: 2, board_id: boardData.id },
            { name: 'En revisión', color: '#eab308', position: 3, board_id: boardData.id },
            { name: 'Completado', color: '#22c55e', position: 4, board_id: boardData.id },
            { name: 'Bloqueado', color: '#ef4444', position: 5, board_id: boardData.id },
          ]
          await supabase.from('board_statuses').insert(defaultStatuses)
        }
      }

      // Set as current org and fetch members immediately
      dispatch({ type: 'SET_CURRENT_ORG', payload: data })

      // Fetch org members (the owner we just inserted)
      const { data: membersData } = await supabase
        .from('org_members')
        .select('*')
        .eq('org_id', data.id)
        .order('name', { ascending: true })
      if (membersData) {
        dispatch({ type: 'SET_ORG_MEMBERS', payload: membersData })
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
    if (error) {
      console.error('fetchOrgMembers error:', error.message, error.code)
      // Retry once after a short delay (RLS might need time after org creation)
      await new Promise(r => setTimeout(r, 1000))
      const { data: retryData, error: retryError } = await supabase
        .from('org_members')
        .select('*')
        .eq('org_id', orgId)
        .order('name', { ascending: true })
      if (!retryError && retryData) {
        dispatch({ type: 'SET_ORG_MEMBERS', payload: retryData })
        return { data: retryData, error: null }
      }
    }
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
    if (!error && data) {
      dispatch({ type: 'ADD_BOARD', payload: data })
      // Init default statuses for the new board
      const statuses = [
        { name: 'Backlog', color: '#6b7280', position: 0, board_id: data.id },
        { name: 'Por hacer', color: '#9ca3af', position: 1, board_id: data.id },
        { name: 'En progreso', color: '#3b82f6', position: 2, board_id: data.id },
        { name: 'En revisión', color: '#eab308', position: 3, board_id: data.id },
        { name: 'Completado', color: '#22c55e', position: 4, board_id: data.id },
        { name: 'Bloqueado', color: '#ef4444', position: 5, board_id: data.id },
      ]
      await supabase.from('board_statuses').insert(statuses)
    }
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
    if (error) {
      console.error('createTask error:', error.message, error.code, task)
    }
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
    if (error) {
      console.error('updateTask error:', error.message, error.code, { id, updates })
    }
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
    if (error) console.error('createInvite error:', error.message, error.code, invite)
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

  const acceptInvite = useCallback(async (inviteId, orgId, userId, userName, userEmail, inviteRole, workspaceIds, customPermissions) => {
    // Add user as org_member with role, workspace access and custom permissions from invite
    const memberData = {
      org_id: orgId,
      user_id: userId,
      name: userName,
      email: userEmail,
      role: inviteRole || 'member',
      workspace_ids: workspaceIds || [],
      color: ['#6c5ce7', '#00b894', '#0984e3', '#e17055', '#fdcb6e'][Math.floor(Math.random() * 5)],
    }
    if (customPermissions) memberData.custom_permissions = customPermissions
    const { error: memberError } = await supabase
      .from('org_members')
      .insert(memberData)
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

  const updateOrgMember = useCallback(async (memberId, updates) => {
    const { data, error } = await supabase
      .from('org_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single()
    if (!error && data) {
      dispatch({ type: 'UPDATE_ORG_MEMBER', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const removeOrgMember = useCallback(async (memberId) => {
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('id', memberId)
    if (!error) {
      dispatch({ type: 'REMOVE_ORG_MEMBER', payload: memberId })
    }
    return { error }
  }, [dispatch])

  // --- Custom Fields ---
  const fetchCustomFields = useCallback(async (boardId) => {
    const { data, error } = await supabase
      .from('custom_fields')
      .select('*, custom_field_options(*)')
      .eq('board_id', boardId)
      .order('position', { ascending: true })
    if (!error && data) {
      dispatch({ type: 'SET_CUSTOM_FIELDS', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const createCustomField = useCallback(async (boardId, field) => {
    const { data, error } = await supabase
      .from('custom_fields')
      .insert({ board_id: boardId, name: field.name, type: field.type, position: field.position || 0, icon: field.icon || null })
      .select('*, custom_field_options(*)')
      .single()
    if (!error && data) {
      // If dropdown, create options
      if (field.type === 'dropdown' && field.options?.length > 0) {
        const opts = field.options.map((o, i) => ({ custom_field_id: data.id, label: o.label, color: o.color || '#6b7280', position: i }))
        const { data: optsData } = await supabase.from('custom_field_options').insert(opts).select()
        data.custom_field_options = optsData || []
      }
      dispatch({ type: 'ADD_CUSTOM_FIELD', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const updateCustomField = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('custom_fields')
      .update(updates)
      .eq('id', id)
      .select('*, custom_field_options(*)')
      .single()
    if (!error && data) {
      dispatch({ type: 'UPDATE_CUSTOM_FIELD', payload: data })
    }
    return { data, error }
  }, [dispatch])

  const deleteCustomField = useCallback(async (id) => {
    const { error } = await supabase.from('custom_fields').delete().eq('id', id)
    if (!error) {
      dispatch({ type: 'DELETE_CUSTOM_FIELD', payload: id })
    }
    return { error }
  }, [dispatch])

  const addCustomFieldOption = useCallback(async (fieldId, label, color, position) => {
    const { data, error } = await supabase
      .from('custom_field_options')
      .insert({ custom_field_id: fieldId, label, color: color || '#6b7280', position: position || 0 })
      .select()
      .single()
    return { data, error }
  }, [])

  const deleteCustomFieldOption = useCallback(async (optionId) => {
    const { error } = await supabase.from('custom_field_options').delete().eq('id', optionId)
    return { error }
  }, [])

  const fetchCustomFieldValues = useCallback(async (boardId) => {
    // Get field IDs for this board, then fetch values for those fields
    const { data: fields } = await supabase.from('custom_fields').select('id').eq('board_id', boardId)
    if (!fields?.length) { dispatch({ type: 'SET_CUSTOM_FIELD_VALUES', payload: {} }); return }
    const fieldIds = fields.map(f => f.id)
    const { data, error } = await supabase
      .from('task_custom_field_values')
      .select('*')
      .in('custom_field_id', fieldIds)
    if (!error) {
      const grouped = {}
      ;(data || []).forEach(v => {
        if (!grouped[v.task_id]) grouped[v.task_id] = []
        grouped[v.task_id].push(v)
      })
      dispatch({ type: 'SET_CUSTOM_FIELD_VALUES', payload: grouped })
    }
    return { data, error }
  }, [dispatch])

  const setCustomFieldValue = useCallback(async (taskId, fieldId, fieldType, value) => {
    const valueCol = fieldType === 'text' ? 'value_text'
      : fieldType === 'number' ? 'value_number'
      : fieldType === 'date' ? 'value_date'
      : fieldType === 'dropdown' ? 'value_option_id'
      : fieldType === 'price' ? 'value_price' : 'value_text'

    // Optimistic update — update local state immediately
    dispatch({ type: 'UPSERT_CUSTOM_FIELD_VALUE', payload: { taskId, fieldId, valueCol, value } })

    const insertData = { task_id: taskId, custom_field_id: fieldId, [valueCol]: value }

    // Upsert: try update first, then insert
    const { data: existing } = await supabase
      .from('task_custom_field_values')
      .select('id')
      .eq('task_id', taskId)
      .eq('custom_field_id', fieldId)
      .single()

    let result
    if (existing) {
      result = await supabase
        .from('task_custom_field_values')
        .update({ [valueCol]: value })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('task_custom_field_values')
        .insert(insertData)
        .select()
        .single()
    }

    return result
  }, [dispatch])

  // --- Task Activity Log ---

  const logTaskActivity = useCallback(async ({ taskId, userId, userName, userAvatar, action, oldValue, newValue }) => {
    if (!taskId || !userId) return
    await supabase.from('task_activity').insert({
      task_id: taskId,
      user_id: userId,
      user_name: userName || '',
      user_avatar: userAvatar || null,
      action,
      old_value: oldValue || null,
      new_value: newValue || null,
    })
  }, [])

  const fetchTaskActivity = useCallback(async (taskId) => {
    const { data, error } = await supabase
      .from('task_activity')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
      .limit(50)
    return { data: data || [], error }
  }, [])

  // --- Subtasks ---

  const fetchSubtasks = useCallback(async (parentTaskId) => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('parent_task_id', parentTaskId)
      .order('position', { ascending: true })
    return { data: data || [], error }
  }, [])

  const createSubtask = useCallback(async (subtask) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert(subtask)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'ADD_TASK', payload: data })
    return { data, error }
  }, [dispatch])

  const updateSubtask = useCallback(async (id, updates) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) dispatch({ type: 'UPDATE_TASK', payload: data })
    return { data, error }
  }, [dispatch])

  const deleteSubtask = useCallback(async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) dispatch({ type: 'DELETE_TASK', payload: id })
    return { error }
  }, [dispatch])

  // --- Private Workspace ---

  const ensurePrivateWorkspace = useCallback(async (orgId, userId) => {
    if (!orgId || !userId) return null
    // Check if private workspace already exists
    const { data: existing } = await supabase
      .from('workspaces')
      .select('*, boards(*)')
      .eq('org_id', orgId)
      .eq('is_private', true)
      .eq('owner_user_id', userId)
      .single()
    if (existing) {
      const defaultStatuses = [
        { name: 'Backlog', color: '#6b7280', position: 0 },
        { name: 'Por hacer', color: '#9ca3af', position: 1 },
        { name: 'En progreso', color: '#3b82f6', position: 2 },
        { name: 'En revisión', color: '#eab308', position: 3 },
        { name: 'Completado', color: '#22c55e', position: 4 },
        { name: 'Bloqueado', color: '#ef4444', position: 5 },
      ]
      // If workspace exists but has no boards, recreate the default board
      if (!existing.boards || existing.boards.length === 0) {
        const { data: board } = await supabase
          .from('boards')
          .insert({ name: 'Mi tablero', workspace_id: existing.id })
          .select()
          .single()
        if (board) {
          await supabase.from('board_statuses').insert(defaultStatuses.map(s => ({ ...s, board_id: board.id })))
          existing.boards = [board]
        }
      } else {
        // Ensure all 6 default statuses exist on existing private boards
        for (const board of existing.boards) {
          const { data: statuses } = await supabase.from('board_statuses').select('name').eq('board_id', board.id)
          const existingNames = (statuses || []).map(s => s.name)
          const missing = defaultStatuses.filter(s => !existingNames.includes(s.name))
          if (missing.length > 0) {
            await supabase.from('board_statuses').insert(missing.map(s => ({ ...s, board_id: board.id })))
          }
        }
      }
      return existing
    }

    // Create private workspace
    const { data: ws } = await supabase
      .from('workspaces')
      .insert({ name: 'Privado', org_id: orgId, is_private: true, owner_user_id: userId, color: '#636e72' })
      .select()
      .single()
    if (!ws) return null

    // Create default board
    const { data: board } = await supabase
      .from('boards')
      .insert({ name: 'Mi tablero', workspace_id: ws.id })
      .select()
      .single()
    if (board) {
      // Init default statuses
      await supabase.from('board_statuses').insert([
        { name: 'Backlog', color: '#6b7280', position: 0, board_id: board.id },
        { name: 'Por hacer', color: '#9ca3af', position: 1, board_id: board.id },
        { name: 'En progreso', color: '#3b82f6', position: 2, board_id: board.id },
        { name: 'En revisión', color: '#eab308', position: 3, board_id: board.id },
        { name: 'Completado', color: '#22c55e', position: 4, board_id: board.id },
        { name: 'Bloqueado', color: '#ef4444', position: 5, board_id: board.id },
      ])
      ws.boards = [board]
    }
    return ws
  }, [])

  // --- User Notes ---

  const fetchWorkspaceNotes = useCallback(async (userId, orgId, workspaceId = null, isPrivate = false) => {
    let query = supabase
      .from('user_notes')
      .select('id, title, updated_at, user_id')
      .eq('org_id', orgId)
    if (isPrivate) {
      // Private workspace: only show own notes
      query = query.eq('user_id', userId)
    }
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    } else {
      query = query.is('workspace_id', null)
    }
    const { data } = await query.order('updated_at', { ascending: true })
    return data || []
  }, [])

  const fetchNote = useCallback(async (noteId) => {
    const { data } = await supabase
      .from('user_notes')
      .select('*')
      .eq('id', noteId)
      .single()
    return data
  }, [])

  const createNote = useCallback(async (userId, orgId, workspaceId = null, title = 'Sin título') => {
    const row = { user_id: userId, org_id: orgId, title, content: '' }
    if (workspaceId) row.workspace_id = workspaceId
    const { data, error } = await supabase
      .from('user_notes')
      .insert(row)
      .select()
      .single()
    if (error) console.error('createNote error:', error)
    return data
  }, [])

  const saveNote = useCallback(async (noteId, content) => {
    const { data } = await supabase
      .from('user_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .select()
      .single()
    return data
  }, [])

  const updateNote = useCallback(async (noteId, updates) => {
    const { data } = await supabase
      .from('user_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .select()
      .single()
    return data
  }, [])

  const deleteNote = useCallback(async (noteId) => {
    await supabase
      .from('user_notes')
      .delete()
      .eq('id', noteId)
  }, [])

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
    removeOrgMember,
    updateOrgMember,
    fetchCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    addCustomFieldOption,
    deleteCustomFieldOption,
    fetchCustomFieldValues,
    setCustomFieldValue,
    logTaskActivity,
    fetchTaskActivity,
    fetchSubtasks,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    ensurePrivateWorkspace,
    fetchWorkspaceNotes,
    fetchNote,
    createNote,
    saveNote,
    updateNote,
    deleteNote,
  }
}
