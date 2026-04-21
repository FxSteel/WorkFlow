import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Search, LayoutDashboard, CheckSquare, Folder,
  ArrowRight, Command, CornerDownLeft,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import EmptyState from '../ui/EmptyState'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { PRIORITY_CONFIG, STATUS_COLORS } from '../../lib/constants'

export default function SearchModal({ isOpen, onClose }) {
  const { state, dispatch, openTask } = useApp()
  const { user } = useAuth()
  const { role } = usePermissions()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ workspaces: [], boards: [], tasks: [] })
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentTasks, setRecentTasks] = useState([])
  const [recentWorkspaces, setRecentWorkspaces] = useState([])
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Compute accessible workspace IDs (same logic as Sidebar)
  const accessibleWsIds = useMemo(() => {
    if (role === 'owner' || role === 'admin') {
      return state.workspaces.filter(ws => !ws.is_private).map(ws => ws.id)
    }
    const currentOrgMember = state.orgMembers.find(m => m.user_id === user?.id)
    const memberWsIds = currentOrgMember?.workspace_ids || []
    if (memberWsIds.length === 0) return []
    return state.workspaces
      .filter(ws => !ws.is_private && memberWsIds.includes(ws.id))
      .map(ws => ws.id)
  }, [state.workspaces, state.orgMembers, user?.id, role])

  // Focus input and load recents when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults({ workspaces: [], boards: [], tasks: [] })
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)

      // Load recent workspaces and tasks filtered by access
      if (accessibleWsIds.length > 0) {
        supabase
          .from('workspaces')
          .select('*')
          .in('id', accessibleWsIds)
          .eq('is_private', false)
          .order('created_at', { ascending: false })
          .limit(5)
          .then(({ data }) => { if (data) setRecentWorkspaces(data) })

        supabase
          .from('boards')
          .select('id')
          .in('workspace_id', accessibleWsIds)
          .then(({ data: boards }) => {
            const boardIds = (boards || []).map(b => b.id)
            if (boardIds.length > 0) {
              supabase
                .from('tasks')
                .select('*, boards(name, workspace_id, workspaces(name, color))')
                .in('board_id', boardIds)
                .order('updated_at', { ascending: false })
                .limit(5)
                .then(({ data }) => { if (data) setRecentTasks(data) })
            }
          })
      } else {
        setRecentWorkspaces([])
        setRecentTasks([])
      }
    }
  }, [isOpen, accessibleWsIds])

  // Search with debounce
  useEffect(() => {
    if (!query.trim()) {
      setResults({ workspaces: [], boards: [], tasks: [] })
      setSelectedIndex(0)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const searchTerm = `%${query.trim()}%`

      if (accessibleWsIds.length === 0) {
        setResults({ workspaces: [], boards: [], tasks: [] })
        setSelectedIndex(0)
        setLoading(false)
        return
      }

      // First get board IDs in accessible workspaces for task filtering
      const { data: accessibleBoards } = await supabase
        .from('boards')
        .select('id')
        .in('workspace_id', accessibleWsIds)

      const accessibleBoardIds = (accessibleBoards || []).map(b => b.id)

      const [wsRes, boardRes, taskRes] = await Promise.all([
        supabase
          .from('workspaces')
          .select('*')
          .in('id', accessibleWsIds)
          .ilike('name', searchTerm)
          .limit(5),
        supabase
          .from('boards')
          .select('*, workspaces(name, color)')
          .in('workspace_id', accessibleWsIds)
          .ilike('name', searchTerm)
          .limit(5),
        accessibleBoardIds.length > 0
          ? supabase
              .from('tasks')
              .select('*, boards(name, workspace_id, workspaces(name, color))')
              .in('board_id', accessibleBoardIds)
              .ilike('title', searchTerm)
              .limit(8)
          : Promise.resolve({ data: [] }),
      ])

      setResults({
        workspaces: wsRes.data || [],
        boards: boardRes.data || [],
        tasks: taskRes.data || [],
      })
      setSelectedIndex(0)
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  // Flatten results for keyboard nav
  const allItems = query.trim()
    ? [
        ...results.workspaces.map(w => ({ type: 'workspace', data: w })),
        ...results.boards.map(b => ({ type: 'board', data: b })),
        ...results.tasks.map(t => ({ type: 'task', data: t })),
      ]
    : [
        ...recentTasks.map(t => ({ type: 'task', data: t })),
        ...recentWorkspaces.map(w => ({ type: 'workspace', data: w })),
      ]

  const handleSelect = useCallback((item) => {
    // Guard: prevent navigating to inaccessible workspaces
    const checkAccess = (wsId) => accessibleWsIds.includes(wsId)

    if (item.type === 'workspace') {
      if (!checkAccess(item.data.id)) return
      dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: item.data })
      const firstBoard = state.boards.find(b => b.workspace_id === item.data.id && !b.is_notes_board)
      dispatch({ type: 'SET_CURRENT_BOARD', payload: firstBoard || null })
    } else if (item.type === 'board') {
      if (!checkAccess(item.data.workspace_id)) return
      const ws = state.workspaces.find(w => w.id === item.data.workspace_id)
      if (ws) dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: ws })
      dispatch({ type: 'SET_CURRENT_BOARD', payload: item.data })
    } else if (item.type === 'task') {
      const wsId = item.data.boards?.workspace_id
      if (wsId && !checkAccess(wsId)) return
      const ws = state.workspaces.find(w => w.id === wsId)
      if (ws) dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: ws })
      if (item.data.boards) {
        dispatch({ type: 'SET_CURRENT_BOARD', payload: { id: item.data.board_id, name: item.data.boards.name, workspace_id: wsId } })
      }
      openTask(item.data)
    }
    onClose()
  }, [dispatch, state.workspaces, accessibleWsIds, openTask, onClose])

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && allItems[selectedIndex]) {
      e.preventDefault()
      handleSelect(allItems[selectedIndex])
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  const hasResults = allItems.length > 0
  const showEmpty = query.trim() && !loading && !hasResults

  let flatIndex = -1

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-xl bg-popover rounded-xl shadow-2xl border border-border animate-scale-in overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar tableros, tareas, espacios de trabajo..."
            className="flex-1 bg-transparent text-foreground text-sm focus:outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground border border-border">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-6 text-center">
              <span className="text-sm text-muted-foreground">Buscando...</span>
            </div>
          )}

          {showEmpty && (
            <EmptyState title="Sin resultados" description={`No se encontraron resultados para "${query}"`} compact soft />
          )}

          {!loading && hasResults && (
            <>
              {/* Workspaces */}
              {results.workspaces.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Espacios de trabajo</span>
                  </div>
                  {results.workspaces.map(ws => {
                    flatIndex++
                    const idx = flatIndex
                    return (
                      <ResultItem
                        key={ws.id}
                        data-index={idx}
                        selected={selectedIndex === idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => handleSelect({ type: 'workspace', data: ws })}
                        icon={
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: ws.color || '#6c5ce7' }}
                          >
                            {ws.name?.[0]?.toUpperCase()}
                          </div>
                        }
                        title={ws.name}
                        subtitle="Espacio de trabajo"
                      />
                    )
                  })}
                </div>
              )}

              {/* Boards */}
              {results.boards.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tableros</span>
                  </div>
                  {results.boards.map(board => {
                    flatIndex++
                    const idx = flatIndex
                    const wsColor = board.workspaces?.color || '#6c5ce7'
                    return (
                      <ResultItem
                        key={board.id}
                        data-index={idx}
                        selected={selectedIndex === idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => handleSelect({ type: 'board', data: board })}
                        icon={
                          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                            <LayoutDashboard className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        }
                        title={board.name}
                        subtitle={
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: wsColor }} />
                            {board.workspaces?.name}
                          </span>
                        }
                      />
                    )
                  })}
                </div>
              )}

              {/* Tasks */}
              {results.tasks.length > 0 && (
                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tareas</span>
                  </div>
                  {results.tasks.map(task => {
                    flatIndex++
                    const idx = flatIndex
                    const priority = PRIORITY_CONFIG[task.priority]
                    return (
                      <ResultItem
                        key={task.id}
                        data-index={idx}
                        selected={selectedIndex === idx}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        onClick={() => handleSelect({ type: 'task', data: task })}
                        icon={
                          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                            <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        }
                        title={task.title}
                        subtitle={
                          <span className="flex items-center gap-2">
                            <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[task.status])} />
                            <span>{task.status}</span>
                            {task.boards?.name && (
                              <>
                                <span className="text-border">·</span>
                                <span>{task.boards.name}</span>
                              </>
                            )}
                          </span>
                        }
                      />
                    )
                  })}
                </div>
              )}
            </>
          )}

          {!query.trim() && !loading && (
            <RecentItems
              recentWorkspaces={recentWorkspaces}
              recentTasks={recentTasks}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
              handleSelect={handleSelect}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">↑↓</kbd>
            Navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">↵</kbd>
            Seleccionar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-muted border border-border font-medium">esc</kbd>
            Cerrar
          </span>
        </div>
      </div>
    </div>
  )
}

function RecentItems({ recentWorkspaces, recentTasks, selectedIndex, setSelectedIndex, handleSelect }) {
  if (recentWorkspaces.length === 0 && recentTasks.length === 0) {
    return <EmptyState title="Buscar en WorkFlow" description="Busca tableros, tareas y espacios de trabajo." compact soft />
  }

  let flatIndex = -1

  return (
    <>
      {recentTasks.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tareas recientes</span>
          </div>
          {recentTasks.map(task => {
            flatIndex++
            const idx = flatIndex
            return (
              <ResultItem
                key={task.id}
                data-index={idx}
                selected={selectedIndex === idx}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => handleSelect({ type: 'task', data: task })}
                icon={
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                    <CheckSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                }
                title={task.title}
                subtitle={
                  <span className="flex items-center gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_COLORS[task.status])} />
                    <span>{task.status}</span>
                    {task.boards?.name && (
                      <>
                        <span className="text-border">·</span>
                        <span>{task.boards.name}</span>
                      </>
                    )}
                  </span>
                }
              />
            )
          })}
        </div>
      )}

      {recentWorkspaces.length > 0 && (
        <div>
          <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Espacios de trabajo recientes</span>
          </div>
          {recentWorkspaces.map(ws => {
            flatIndex++
            const idx = flatIndex
            return (
              <ResultItem
                key={ws.id}
                data-index={idx}
                selected={selectedIndex === idx}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => handleSelect({ type: 'workspace', data: ws })}
                icon={
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: ws.color || '#6c5ce7' }}
                  >
                    {ws.name?.[0]?.toUpperCase()}
                  </div>
                }
                title={ws.name}
                subtitle="Espacio de trabajo"
              />
            )
          })}
        </div>
      )}
    </>
  )
}

function ResultItem({ selected, icon, title, subtitle, onClick, onMouseEnter, ...props }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/50'
      )}
      {...props}
    >
      {icon}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
      </div>
      {selected && (
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
    </button>
  )
}
