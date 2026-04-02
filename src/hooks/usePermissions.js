import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

// ─── Permission Categories & Definitions ─────────────────────────────────────

export const PERMISSION_CATEGORIES = [
  {
    id: 'workspaces',
    label: 'Espacios de trabajo',
    permissions: [
      { key: 'viewAllWorkspaces', label: 'Ver todos los espacios', description: 'Acceder a todos los espacios sin restricción' },
      { key: 'createWorkspace', label: 'Crear espacios', description: 'Crear nuevos espacios de trabajo' },
      { key: 'editWorkspace', label: 'Editar espacios', description: 'Modificar nombre, color y configuración' },
      { key: 'deleteWorkspace', label: 'Eliminar espacios', description: 'Eliminar espacios de trabajo' },
    ],
  },
  {
    id: 'boards',
    label: 'Tableros y Notas',
    permissions: [
      { key: 'createBoard', label: 'Crear tableros', description: 'Crear nuevos tableros' },
      { key: 'editBoard', label: 'Editar tableros', description: 'Modificar nombre y configuración' },
      { key: 'deleteBoard', label: 'Eliminar tableros', description: 'Eliminar tableros' },
      { key: 'createNote', label: 'Crear notas', description: 'Crear notas en espacios de trabajo' },
      { key: 'editNote', label: 'Editar notas', description: 'Modificar notas existentes' },
      { key: 'deleteNote', label: 'Eliminar notas', description: 'Eliminar notas' },
    ],
  },
  {
    id: 'tasks',
    label: 'Tareas',
    permissions: [
      { key: 'viewTasks', label: 'Ver tareas', description: 'Ver tareas y sus detalles' },
      { key: 'createTask', label: 'Crear tareas', description: 'Crear nuevas tareas' },
      { key: 'editTask', label: 'Editar tareas', description: 'Modificar tareas existentes' },
      { key: 'deleteTask', label: 'Eliminar tareas', description: 'Eliminar tareas' },
      { key: 'moveTask', label: 'Mover tareas', description: 'Arrastrar y reordenar tareas' },
    ],
  },
  {
    id: 'sprints',
    label: 'Sprints',
    permissions: [
      { key: 'createSprint', label: 'Crear sprints', description: 'Crear nuevos sprints' },
      { key: 'editSprint', label: 'Editar sprints', description: 'Modificar sprints existentes' },
      { key: 'deleteSprint', label: 'Eliminar sprints', description: 'Eliminar sprints' },
    ],
  },
  {
    id: 'customization',
    label: 'Personalización del tablero',
    permissions: [
      { key: 'editStatuses', label: 'Editar estados', description: 'Crear, editar y eliminar estados' },
      { key: 'manageCustomFields', label: 'Campos personalizados', description: 'Crear, editar y eliminar campos' },
    ],
  },
  {
    id: 'collaboration',
    label: 'Colaboración',
    permissions: [
      { key: 'comment', label: 'Comentar', description: 'Comentar en tareas' },
    ],
  },
  {
    id: 'settings',
    label: 'Configuración y administración',
    permissions: [
      { key: 'editOrgSettings', label: 'Configuración general', description: 'Ver y modificar configuración de la org' },
      { key: 'accessMembers', label: 'Ver miembros', description: 'Ver la lista de miembros' },
      { key: 'invite', label: 'Invitar usuarios', description: 'Enviar invitaciones' },
      { key: 'editMembers', label: 'Gestionar miembros', description: 'Cambiar roles y permisos' },
      { key: 'accessBilling', label: 'Facturación', description: 'Ver y gestionar facturación' },
      { key: 'accessPreferences', label: 'Preferencias', description: 'Acceder a preferencias y notificaciones' },
    ],
  },
  {
    id: 'danger',
    label: 'Zona de peligro',
    permissions: [
      { key: 'deleteOrg', label: 'Eliminar organización', description: 'Eliminar la organización permanentemente' },
    ],
  },
]

// Flat list of all permission keys
export const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap(c => c.permissions.map(p => p.key))

// ─── Role Presets ────────────────────────────────────────────────────────────

const allTrue = Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, true]))
const allFalse = Object.fromEntries(ALL_PERMISSION_KEYS.map(k => [k, false]))

export const ROLE_PRESETS = {
  owner: { ...allTrue },
  admin: { ...allTrue, deleteOrg: false },
  member: {
    ...allFalse,
    createWorkspace: true,
    createBoard: true,
    editBoard: true,
    createNote: true,
    editNote: true,
    viewTasks: true,
    createTask: true,
    editTask: true,
    deleteTask: true,
    moveTask: true,
    createSprint: true,
    editSprint: true,
    comment: true,
    accessPreferences: true,
  },
  viewer: {
    ...allFalse,
    viewTasks: true,
    comment: true,
    accessPreferences: true,
  },
}

// Legacy PERMISSIONS export (backward compatibility)
export const PERMISSIONS = ROLE_PRESETS

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get effective permissions for a member: custom_permissions > role preset */
export function getEffectivePermissions(member) {
  if (!member) return ROLE_PRESETS.viewer
  // If member has custom_permissions, merge with role defaults as base
  if (member.custom_permissions && typeof member.custom_permissions === 'object') {
    const base = ROLE_PRESETS[member.role] || ROLE_PRESETS.viewer
    return { ...base, ...member.custom_permissions }
  }
  return ROLE_PRESETS[member.role] || ROLE_PRESETS.viewer
}

/** Check if custom_permissions differ from the role preset */
export function isCustomized(role, customPermissions) {
  if (!customPermissions) return false
  const preset = ROLE_PRESETS[role] || ROLE_PRESETS.viewer
  return ALL_PERMISSION_KEYS.some(key => {
    const custom = customPermissions[key]
    return custom !== undefined && custom !== preset[key]
  })
}

/** Get the matching role preset name, or 'custom' if none match */
export function detectRole(permissions) {
  for (const [roleName, preset] of Object.entries(ROLE_PRESETS)) {
    if (roleName === 'owner') continue
    if (ALL_PERMISSION_KEYS.every(key => (permissions[key] || false) === (preset[key] || false))) {
      return roleName
    }
  }
  return 'custom'
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePermissions() {
  const { state } = useApp()
  const { user } = useAuth()

  const currentMember = useMemo(() => {
    return state.orgMembers.find(m => m.user_id === user?.id) || null
  }, [state.orgMembers, user?.id])

  const permissions = useMemo(() => {
    return getEffectivePermissions(currentMember)
  }, [currentMember])

  const role = currentMember?.role || 'viewer'

  const can = (permission) => permissions[permission] || false

  return { permissions, role, can }
}
