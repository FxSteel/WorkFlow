import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

// Role hierarchy: owner > admin > member > viewer
const PERMISSIONS = {
  owner: {
    viewAllWorkspaces: true,
    createWorkspace: true,
    editWorkspace: true,
    deleteWorkspace: true,
    createBoard: true,
    editBoard: true,
    deleteBoard: true,
    createTask: true,
    editTask: true,
    deleteTask: true,
    moveTask: true,
    createSprint: true,
    editSprint: true,
    deleteSprint: true,
    comment: true,
    invite: true,
    editMembers: true,
    editOrgSettings: true,
    deleteOrg: true,
    editStatuses: true,
  },
  admin: {
    viewAllWorkspaces: true,
    createWorkspace: true,
    editWorkspace: true,
    deleteWorkspace: true,
    createBoard: true,
    editBoard: true,
    deleteBoard: true,
    createTask: true,
    editTask: true,
    deleteTask: true,
    moveTask: true,
    createSprint: true,
    editSprint: true,
    deleteSprint: true,
    comment: true,
    invite: true,
    editMembers: true,
    editOrgSettings: true,
    deleteOrg: false,
    editStatuses: true,
  },
  member: {
    viewAllWorkspaces: false,
    createWorkspace: true,
    editWorkspace: false,
    deleteWorkspace: false,
    createBoard: true,
    editBoard: true,
    deleteBoard: false,
    createTask: true,
    editTask: true,
    deleteTask: true,
    moveTask: true,
    createSprint: true,
    editSprint: true,
    deleteSprint: false,
    comment: true,
    invite: false,
    editMembers: false,
    editOrgSettings: false,
    deleteOrg: false,
    editStatuses: false,
  },
  viewer: {
    viewAllWorkspaces: false,
    createWorkspace: false,
    editWorkspace: false,
    deleteWorkspace: false,
    createBoard: false,
    editBoard: false,
    deleteBoard: false,
    createTask: false,
    editTask: false,
    deleteTask: false,
    moveTask: false,
    createSprint: false,
    editSprint: false,
    deleteSprint: false,
    comment: true,
    invite: false,
    editMembers: false,
    editOrgSettings: false,
    deleteOrg: false,
    editStatuses: false,
  },
}

export function usePermissions() {
  const { state } = useApp()
  const { user } = useAuth()

  const permissions = useMemo(() => {
    const currentMember = state.orgMembers.find(m => m.user_id === user?.id)
    const role = currentMember?.role || 'viewer'
    return PERMISSIONS[role] || PERMISSIONS.viewer
  }, [state.orgMembers, user?.id])

  const role = useMemo(() => {
    const currentMember = state.orgMembers.find(m => m.user_id === user?.id)
    return currentMember?.role || 'viewer'
  }, [state.orgMembers, user?.id])

  const can = (permission) => permissions[permission] || false

  return { permissions, role, can }
}

export { PERMISSIONS }
