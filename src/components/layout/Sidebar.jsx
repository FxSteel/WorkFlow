import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Home,
  Search,
  Trash2,
  UserPlus,
  AlertTriangle,
  Pencil,
  Palette,
  Copy,
  MoreHorizontal,
  Building2,
  Check,
  Settings2,
  Puzzle,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'
import SidebarSkeleton from '../skeleton/SidebarSkeleton'
import TeamPresence from '../workspace/TeamPresence'
import ColorPicker from '../ui/ColorPicker'
import { toast } from 'sonner'

const WORKSPACE_COLORS = [
  '#6c5ce7', '#0984e3', '#00b894', '#e17055', '#fdcb6e',
  '#a29bfe', '#74b9ff', '#55efc4', '#fab1a0', '#636e72',
]

export default function Sidebar({ onOpenInviteModal, onOpenSearch }) {
  const { state, dispatch } = useApp()
  const { user } = useAuth()
  const {
    createWorkspace, createBoard, deleteWorkspace, updateWorkspace, fetchBoards,
    deleteBoard, updateBoard, createOrganization, updateOrganization, deleteOrganization, fetchWorkspaces,
  } = useSupabase()
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({})
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [showNewBoard, setShowNewBoard] = useState(null)
  const [showOrgDropdown, setShowOrgDropdown] = useState(false)
  const [showNewOrg, setShowNewOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [editingOrgId, setEditingOrgId] = useState(null)
  const [editOrgName, setEditOrgName] = useState('')
  const [deleteOrgConfirm, setDeleteOrgConfirm] = useState(null)

  // Context menu state: { type: 'workspace'|'board', id, x, y, data }
  const [ctxMenu, setCtxMenu] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null) // { type, id, name }
  const [editingId, setEditingId] = useState(null) // id being renamed
  const [editingType, setEditingType] = useState(null) // 'workspace' | 'board'
  const [editName, setEditName] = useState('')
  const [colorPicker, setColorPicker] = useState(null)
  const [workspacesLoaded, setWorkspacesLoaded] = useState(false)
  const loadingStarted = useRef(false)
  const ctxRef = useRef(null)
  const orgDropdownRef = useRef(null)

  // Permissions
  const currentOrgMember = state.orgMembers.find(m => m.user_id === user?.id)
  const userRole = currentOrgMember?.role || 'viewer'
  const canCreateWorkspace = userRole === 'owner' || userRole === 'admin' || userRole === 'member'
  const canEditWorkspace = userRole === 'owner' || userRole === 'admin'
  const canCreateBoard = userRole !== 'viewer'
  const canManageWorkspaces = canEditWorkspace // for context menu

  // Filter workspaces based on member access
  const visibleWorkspaces = (userRole === 'owner' || userRole === 'admin')
    ? state.workspaces
    : state.workspaces.filter(ws => {
        const memberWsIds = currentOrgMember?.workspace_ids || []
        if (memberWsIds.length === 0) return false
        return memberWsIds.includes(ws.id)
      })

  // Track when workspaces fetch completes (loading: false->true->false)
  useEffect(() => {
    if (state.loading) {
      loadingStarted.current = true
    }
    if (!state.loading && loadingStarted.current) {
      setWorkspacesLoaded(true)
    }
  }, [state.loading])

  // Close context menu
  useEffect(() => {
    const close = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) {
        setCtxMenu(null)
        setColorPicker(null)
      }
    }
    const closeOnScroll = () => { setCtxMenu(null); setColorPicker(null) }
    const closeOnKey = (e) => { if (e.key === 'Escape') { setCtxMenu(null); setColorPicker(null) } }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', closeOnScroll, true)
    document.addEventListener('keydown', closeOnKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', closeOnScroll, true)
      document.removeEventListener('keydown', closeOnKey)
    }
  }, [])

  // Close org dropdown on outside click
  useEffect(() => {
    const close = (e) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target)) {
        setShowOrgDropdown(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const openCtx = useCallback((e, type, data) => {
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ type, id: data.id, x: e.clientX, y: e.clientY, data })
    setColorPicker(null)
  }, [])

  const openCtxFromDots = useCallback((e, type, data) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setCtxMenu({ type, id: data.id, x: rect.right, y: rect.top, data })
    setColorPicker(null)
  }, [])

  const toggleWorkspace = (id) => {
    setExpandedWorkspaces(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // --- Org CRUD ---
  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return
    const { data } = await createOrganization({
      name: newOrgName.trim(),
      owner_id: user.id,
      color: WORKSPACE_COLORS[Math.floor(Math.random() * WORKSPACE_COLORS.length)],
    })
    if (data) {
      setNewOrgName('')
      setShowNewOrg(false)
      // Switch to the new org
      dispatch({ type: 'SET_CURRENT_ORG', payload: data })
    }
  }

  const handleSwitchOrg = (org) => {
    dispatch({ type: 'SET_CURRENT_ORG', payload: org })
    setShowOrgDropdown(false)
    setWorkspacesLoaded(false)
    loadingStarted.current = false
  }

  const handleRenameOrg = async (orgId) => {
    if (editOrgName.trim()) {
      await updateOrganization(orgId, { name: editOrgName.trim() })
      toast.success('Organización renombrada')
    }
    setEditingOrgId(null)
    setEditOrgName('')
  }

  const handleDeleteOrg = async (orgId) => {
    await deleteOrganization(orgId)
    toast.success('Organización eliminada')
    setDeleteOrgConfirm(null)
    setShowOrgDropdown(false)
    // Switch to another org if available
    const remaining = state.organizations.filter(o => o.id !== orgId)
    if (remaining.length > 0) {
      dispatch({ type: 'SET_CURRENT_ORG', payload: remaining[0] })
    }
  }

  // --- Workspace CRUD ---
  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || !state.currentOrg) return
    const { data } = await createWorkspace({
      name: newWorkspaceName.trim(),
      owner_id: user.id,
      color: WORKSPACE_COLORS[Math.floor(Math.random() * WORKSPACE_COLORS.length)],
      org_id: state.currentOrg.id,
    })
    if (data) { setNewWorkspaceName(''); setShowNewWorkspace(false) }
  }

  const handleDeleteWorkspace = async (id) => {
    await deleteWorkspace(id)
    toast.success('Espacio eliminado')
    setDeleteConfirm(null)
    setCtxMenu(null)
  }

  const handleChangeColor = async (id, color) => {
    await updateWorkspace(id, { color })
    setColorPicker(null)
    setCtxMenu(null)
  }

  // --- Board CRUD ---
  const handleCreateBoard = async (workspaceId) => {
    if (!newBoardName.trim()) return
    const { data } = await createBoard({ name: newBoardName.trim(), workspace_id: workspaceId })
    if (data) { setNewBoardName(''); setShowNewBoard(null) }
  }

  const handleDeleteBoard = async (id) => {
    await deleteBoard(id)
    toast.success('Tablero eliminado')
    setDeleteConfirm(null)
    setCtxMenu(null)
  }

  // --- Rename (shared for workspace & board) ---
  const handleStartRename = (type, item) => {
    setEditingType(type)
    setEditingId(item.id)
    setEditName(item.name)
    setCtxMenu(null)
  }

  const handleFinishRename = async () => {
    if (!editName.trim() || !editingId) { setEditingId(null); return }
    if (editingType === 'workspace') {
      await updateWorkspace(editingId, { name: editName.trim() })
    } else {
      await updateBoard(editingId, { name: editName.trim() })
    }
    toast.success('Nombre actualizado')
    setEditingId(null)
    setEditingType(null)
    setEditName('')
  }

  const toggleAndFetchWorkspace = (workspace) => {
    toggleWorkspace(workspace.id)
    // Fetch boards for this workspace when expanding
    if (!expandedWorkspaces[workspace.id]) {
      fetchBoards(workspace.id)
    }
  }

  const selectWorkspace = (workspace) => {
    dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: workspace })
    dispatch({ type: 'SET_CURRENT_BOARD', payload: null })
  }

  const selectBoard = (board) => {
    // Also set the workspace when selecting a board
    const workspace = state.workspaces.find(w => w.id === board.workspace_id)
    if (workspace) dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: workspace })
    dispatch({ type: 'SET_CURRENT_BOARD', payload: board })
  }

  return (
    <aside className="h-screen w-[260px] bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      {/* Header */}
      <div className="p-3 flex items-center border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-sidebar-foreground">WorkFlow</span>
        </div>
      </div>

      {/* Organization Selector */}
      {state.currentOrg && (
        <div className="px-2 pt-2 pb-1" ref={orgDropdownRef}>
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-accent transition-colors"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ backgroundColor: state.currentOrg.color || '#6c5ce7' }}
            >
              {state.currentOrg.icon_url ? (
                <img src={state.currentOrg.icon_url} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                state.currentOrg.name?.[0]?.toUpperCase()
              )}
            </div>
            <span className="text-sm font-semibold text-sidebar-foreground truncate flex-1 text-left">
              {state.currentOrg.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </button>

          {showOrgDropdown && (
            <div className="mt-1 rounded-lg border border-border bg-popover shadow-lg py-1 z-50 animate-scale-in">
              {state.organizations.map(org => {
                const isOwner = org.owner_id === user?.id
                return (
                <div key={org.id} className="group/org relative">
                  {editingOrgId === org.id ? (
                    <div className="px-2 py-1">
                      <input
                        autoFocus
                        value={editOrgName}
                        onChange={(e) => setEditOrgName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameOrg(org.id)
                          if (e.key === 'Escape') { setEditingOrgId(null); setEditOrgName('') }
                        }}
                        onBlur={() => handleRenameOrg(org.id)}
                        className="w-full px-2 py-1 text-sm rounded border border-ring bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  ) : (
                    <div className={cn(
                      'flex items-center px-3 py-2 transition-colors',
                      state.currentOrg?.id === org.id ? 'bg-accent' : 'hover:bg-accent/50'
                    )}>
                      <button
                        onClick={() => handleSwitchOrg(org)}
                        className="flex-1 flex items-center gap-2 text-sm min-w-0"
                      >
                        {org.icon_url ? (
                          <img src={org.icon_url} alt="" className="w-6 h-6 rounded object-cover shrink-0" />
                        ) : (
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: org.color || '#6c5ce7' }}
                          >
                            {org.name?.[0]?.toUpperCase()}
                          </div>
                        )}
                        <span className="truncate flex-1 text-left text-foreground">{org.name}</span>
                      </button>
                      {/* Org actions — hover to show */}
                      {isOwner && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/org:opacity-100 transition-opacity ml-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingOrgId(org.id)
                              setEditOrgName(org.name)
                            }}
                            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                            title="Renombrar"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteOrgConfirm(org)
                              setShowOrgDropdown(false)
                            }}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                )
              })}

              <div className="h-px bg-border my-1" />
              {showNewOrg ? (
                <div className="px-2 py-1">
                  <input
                    autoFocus
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateOrg()
                      if (e.key === 'Escape') { setShowNewOrg(false); setNewOrgName('') }
                    }}
                    onBlur={() => { if (!newOrgName.trim()) setShowNewOrg(false) }}
                    placeholder="Nombre de la organización..."
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setShowNewOrg(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear organización
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {(
        <div className="p-2 space-y-0.5">
          <SidebarItem icon={Home} label="Inicio" onClick={() => {
            dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: null })
            dispatch({ type: 'SET_CURRENT_BOARD', payload: null })
          }} />
          <SidebarItem icon={Search} label="Buscar" onClick={onOpenSearch} shortcut="⌘L" />
        </div>
      )}

      {/* Workspaces */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!workspacesLoaded && (
          <SidebarSkeleton />
        )}

        {workspacesLoaded && (
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Espacios de trabajo
            </span>
            {canCreateWorkspace && (
              <button
                onClick={() => setShowNewWorkspace(true)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {showNewWorkspace && (
          <div className="px-2 mb-2">
            <input
              autoFocus
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateWorkspace()
                if (e.key === 'Escape') setShowNewWorkspace(false)
              }}
              onBlur={() => { if (!newWorkspaceName.trim()) setShowNewWorkspace(false) }}
              placeholder="Nombre del espacio..."
              className="w-full px-2 py-1.5 text-sm rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}

        {visibleWorkspaces.map(workspace => (
          <div key={workspace.id} className="mb-1">
            {/* Workspace row */}
            <div
              className="flex items-center group"
              onContextMenu={(e) => openCtx(e, 'workspace', workspace)}
            >
              {editingId === workspace.id && editingType === 'workspace' ? (
                <div className="flex-1 px-1">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename()
                      if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                    }}
                    onBlur={handleFinishRename}
                    className="w-full px-2 py-1 text-sm rounded-md border border-ring bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors min-w-0 cursor-pointer',
                    state.currentWorkspace?.id === workspace.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-sidebar-foreground hover:bg-accent'
                  )}
                >
                  <div
                    className="flex-1 flex items-center gap-2 min-w-0"
                    onClick={() => toggleAndFetchWorkspace(workspace)}
                  >
                    {expandedWorkspaces[workspace.id]
                        ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    }
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: workspace.color || '#6c5ce7' }}
                    >
                      {workspace.name?.[0]?.toUpperCase()}
                    </div>
                    <span className="truncate flex-1 text-left">{workspace.name}</span>
                  </div>
                  <button
                      onClick={(e) => { e.stopPropagation(); openCtxFromDots(e, 'workspace', workspace) }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                </div>
              )}
            </div>

            {/* Boards */}
            {expandedWorkspaces[workspace.id] && (
              <div className="ml-4 mt-0.5 space-y-0.5">
                {state.boards
                  .filter(b => b.workspace_id === workspace.id)
                  .map(board => (
                    <div
                      key={board.id}
                      className="flex items-center group/board"
                      onContextMenu={(e) => openCtx(e, 'board', board)}
                    >
                      {editingId === board.id && editingType === 'board' ? (
                        <div className="flex-1 px-1">
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleFinishRename()
                              if (e.key === 'Escape') { setEditingId(null); setEditName('') }
                            }}
                            onBlur={handleFinishRename}
                            className="w-full px-2 py-0.5 text-xs rounded border border-ring bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors min-w-0 cursor-pointer',
                            state.currentBoard?.id === board.id
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          )}
                        >
                          <div
                            className="flex-1 flex items-center gap-2 min-w-0"
                            onClick={() => selectBoard(board)}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
                            <span className="truncate">{board.name}</span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); openCtxFromDots(e, 'board', board) }}
                            className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            <MoreHorizontal className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                }
                {showNewBoard === workspace.id ? (
                  <div className="px-1">
                    <input
                      autoFocus
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateBoard(workspace.id)
                        if (e.key === 'Escape') setShowNewBoard(null)
                      }}
                      onBlur={() => { if (!newBoardName.trim()) setShowNewBoard(null) }}
                      placeholder="Nombre del tablero..."
                      className="w-full px-2 py-1 text-xs rounded border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewBoard(workspace.id)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar tablero</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

      </div>

      {/* Team Presence — show when org is selected */}
      {state.currentOrg && <TeamPresence />}

      {/* ========== CONTEXT MENU ========== */}
      {ctxMenu && ctxMenu.data && (
        <div
          ref={ctxRef}
          className="fixed z-[100] w-52 rounded-xl border border-border bg-popover shadow-xl py-1.5 animate-scale-in"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 220),
            top: Math.min(ctxMenu.y, window.innerHeight - 280),
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            {ctxMenu.type === 'workspace' ? (
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: ctxMenu.data.color || '#6c5ce7' }}
              >
                {ctxMenu.data.name?.[0]?.toUpperCase()}
              </div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
            )}
            <span className="text-xs font-semibold text-foreground truncate">{ctxMenu.data.name}</span>
          </div>

          {/* Common actions */}
          <div className="py-1">
            <CtxMenuItem
              icon={Pencil}
              label="Renombrar"
              onClick={() => handleStartRename(ctxMenu.type, ctxMenu.data)}
            />

            {/* Workspace-only actions */}
            {ctxMenu.type === 'workspace' && (
              <>
                <CtxMenuItem
                  icon={Palette}
                  label="Cambiar color"
                  onClick={() => setColorPicker(colorPicker === ctxMenu.id ? null : ctxMenu.id)}
                  hasSubmenu
                />
                {colorPicker === ctxMenu.id && (
                  <div className="px-3 py-2">
                    <ColorPicker
                      value={ctxMenu.data.color}
                      onChange={(c) => handleChangeColor(ctxMenu.id, c)}
                      size="sm"
                    />
                  </div>
                )}
                <CtxMenuItem
                  icon={Copy}
                  label="Copiar ID"
                  onClick={() => { navigator.clipboard.writeText(ctxMenu.id); toast.success('ID copiado'); setCtxMenu(null) }}
                />
              </>
            )}

            {/* Board-only actions */}
            {ctxMenu.type === 'board' && (
              <>
                <CtxMenuItem
                  icon={Settings2}
                  label="Configurar estados"
                  onClick={() => { dispatch({ type: 'SHOW_STATUS_CONFIG', payload: true }); setCtxMenu(null) }}
                />
                <CtxMenuItem
                  icon={Puzzle}
                  label="Campos personalizados"
                  onClick={() => { dispatch({ type: 'SHOW_CUSTOM_FIELDS', payload: true }); setCtxMenu(null) }}
                />
                <CtxMenuItem
                  icon={Copy}
                  label="Copiar ID"
                  onClick={() => { navigator.clipboard.writeText(ctxMenu.id); toast.success('ID copiado'); setCtxMenu(null) }}
                />
              </>
            )}
          </div>

          {/* Destructive zone — always visible */}
          <div className="h-px bg-border mx-2 my-1" />
          <div className="py-1">
            <button
              onClick={() => {
                setDeleteConfirm({
                  type: ctxMenu.type,
                  id: ctxMenu.id,
                  name: ctxMenu.data.name,
                })
                setCtxMenu(null)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar {ctxMenu.type === 'workspace' ? 'espacio de trabajo' : 'tablero'}
            </button>
          </div>
        </div>
      )}

      {/* ========== DELETE ORG CONFIRMATION ========== */}
      {deleteOrgConfirm && (
        <DeleteConfirmModal
          type="organización"
          name={deleteOrgConfirm.name}
          onConfirm={() => handleDeleteOrg(deleteOrgConfirm.id)}
          onCancel={() => setDeleteOrgConfirm(null)}
        />
      )}

      {/* ========== DELETE CONFIRMATION ========== */}
      {deleteConfirm && (
        <DeleteConfirmModal
          type={deleteConfirm.type}
          name={deleteConfirm.name}
          onConfirm={() => {
            if (deleteConfirm.type === 'workspace') handleDeleteWorkspace(deleteConfirm.id)
            else handleDeleteBoard(deleteConfirm.id)
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </aside>
  )
}

function CtxMenuItem({ icon: Icon, label, onClick, hasSubmenu }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="flex-1 text-left">{label}</span>
      {hasSubmenu && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
    </button>
  )
}

function DeleteConfirmModal({ type, name, onConfirm, onCancel }) {
  const isWorkspace = type === 'workspace'
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm bg-card rounded-xl shadow-2xl border border-border animate-scale-in p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">
              Eliminar {isWorkspace ? 'espacio' : 'tablero'}
            </h3>
            <p className="text-xs text-muted-foreground">Esta accion no se puede deshacer</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Se eliminara permanentemente {isWorkspace ? 'el espacio de trabajo' : 'el tablero'}{' '}
          <span className="font-semibold text-foreground">"{name}"</span>
          {isWorkspace
            ? ' junto con todos sus tableros, sprints, tareas y miembros.'
            : ' junto con todos sus sprints y tareas.'
          }
        </p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({ icon: Icon, label, active, onClick, shortcut }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-sidebar-foreground hover:bg-accent'
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {shortcut && (
        <kbd className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted h-5 px-1.5 rounded border border-border font-medium leading-none">
          <span className="text-[12px]">⌘</span><span>L</span>
        </kbd>
      )}
    </button>
  )
}
