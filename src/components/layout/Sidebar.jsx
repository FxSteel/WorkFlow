import { useState, useRef, useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  Plus,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
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
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'
import SidebarSkeleton from '../skeleton/SidebarSkeleton'
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
    deleteBoard, updateBoard,
  } = useSupabase()
  const [expandedWorkspaces, setExpandedWorkspaces] = useState({})
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [showNewWorkspace, setShowNewWorkspace] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')
  const [showNewBoard, setShowNewBoard] = useState(null)

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

  // Track when workspaces fetch completes (loading: false→true→false)
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

  // --- Workspace CRUD ---
  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return
    const { data } = await createWorkspace({
      name: newWorkspaceName.trim(),
      owner_id: user.id,
      color: WORKSPACE_COLORS[Math.floor(Math.random() * WORKSPACE_COLORS.length)],
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

  const collapsed = state.sidebarCollapsed

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 shrink-0',
        collapsed ? 'w-[60px]' : 'w-[260px]'
      )}
    >
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm text-sidebar-foreground">WorkFlow</span>
          </div>
        )}
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      {!collapsed && (
        <div className="p-2 space-y-0.5">
          <SidebarItem icon={Home} label="Inicio" onClick={() => {
            dispatch({ type: 'SET_CURRENT_BOARD', payload: null })
          }} />
          <SidebarItem icon={Search} label="Buscar" onClick={onOpenSearch} shortcut="⌘L" />
        </div>
      )}

      {/* Workspaces */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {!collapsed && !workspacesLoaded && (
          <SidebarSkeleton />
        )}

        {!collapsed && workspacesLoaded && (
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Espacios de trabajo
            </span>
            <button
              onClick={() => setShowNewWorkspace(true)}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {showNewWorkspace && !collapsed && (
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

        {state.workspaces.map(workspace => (
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
                    {!collapsed && (
                      expandedWorkspaces[workspace.id]
                        ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: workspace.color || '#6c5ce7' }}
                    >
                      {workspace.name?.[0]?.toUpperCase()}
                    </div>
                    {!collapsed && (
                      <span className="truncate flex-1 text-left">{workspace.name}</span>
                    )}
                  </div>
                  {!collapsed && (
                    <button
                      onClick={(e) => { e.stopPropagation(); openCtxFromDots(e, 'workspace', workspace) }}
                      className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Boards */}
            {expandedWorkspaces[workspace.id] && !collapsed && (
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
                            <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
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

        {/* Collapsed view */}
        {collapsed && (
          <div className="flex flex-col items-center gap-1 mt-2">
            {state.workspaces.map(workspace => (
              <button
                key={workspace.id}
                onClick={() => selectWorkspace(workspace)}
                onContextMenu={(e) => openCtx(e, 'workspace', workspace)}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all',
                  state.currentWorkspace?.id === workspace.id && 'ring-2 ring-primary ring-offset-2 ring-offset-sidebar'
                )}
                style={{ backgroundColor: workspace.color || '#6c5ce7' }}
                title={workspace.name}
              >
                {workspace.name?.[0]?.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => {
                dispatch({ type: 'TOGGLE_SIDEBAR' })
                setTimeout(() => setShowNewWorkspace(true), 300)
              }}
              className="w-9 h-9 rounded-lg flex items-center justify-center border border-dashed border-muted-foreground text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

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
              <LayoutDashboard className="w-4 h-4 text-muted-foreground shrink-0" />
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
                  <div className="px-3 py-2 flex flex-wrap gap-1.5">
                    {WORKSPACE_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => handleChangeColor(ctxMenu.id, color)}
                        className={cn(
                          'w-6 h-6 rounded-full transition-all hover:scale-110',
                          ctxMenu.data.color === color && 'ring-2 ring-ring ring-offset-1 ring-offset-popover'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}
                <CtxMenuItem
                  icon={UserPlus}
                  label="Invitar miembros"
                  onClick={() => { onOpenInviteModal?.(ctxMenu.data); setCtxMenu(null) }}
                />
                <CtxMenuItem
                  icon={Copy}
                  label="Copiar ID"
                  onClick={() => { navigator.clipboard.writeText(ctxMenu.id); toast.success('ID copiado'); setCtxMenu(null) }}
                />
              </>
            )}

            {/* Board-only actions */}
            {ctxMenu.type === 'board' && (
              <CtxMenuItem
                icon={Copy}
                label="Copiar ID"
                onClick={() => { navigator.clipboard.writeText(ctxMenu.id); toast.success('ID copiado'); setCtxMenu(null) }}
              />
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
            <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          Se eliminará permanentemente {isWorkspace ? 'el espacio de trabajo' : 'el tablero'}{' '}
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
