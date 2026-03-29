import { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
  Flag,
  Zap,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Timer,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'
import { PRIORITY_CONFIG, STATUS_COLORS } from '../../lib/constants'
import HomeSkeleton from '../skeleton/HomeSkeleton'
import EmptyState from '../ui/EmptyState'

export default function HomePage() {
  const { state, dispatch, openTask } = useApp()
  const { user } = useAuth()
  const [upcomingTasks, setUpcomingTasks] = useState([])
  const [overdueTasks, setOverdueTasks] = useState([])
  const [recentBoards, setRecentBoards] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const carouselRef = useRef(null)

  const greeting = getGreeting()
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuario'

  // Get current member's workspace access
  const currentMember = state.orgMembers.find(m => m.user_id === user?.id)
  const isAdminOrOwner = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const accessibleWsIds = (isAdminOrOwner
    ? state.workspaces
    : state.workspaces.filter(ws => (currentMember?.workspace_ids || []).includes(ws.id))
  ).filter(ws => !ws.is_private || ws.owner_user_id === user?.id).map(w => w.id)

  // Fetch recent boards filtered by current org workspaces
  useEffect(() => {
    async function fetchBoards() {
      if (accessibleWsIds.length === 0) { setRecentBoards([]); return }
      const { data } = await supabase
        .from('boards')
        .select('*, workspaces(name, color)')
        .in('workspace_id', accessibleWsIds)
        .order('created_at', { ascending: false })
        .limit(15)
      if (data) setRecentBoards(data)
    }
    fetchBoards()
  }, [accessibleWsIds.join(',')])

  // Fetch upcoming and overdue tasks filtered by accessible workspaces
  useEffect(() => {
    async function fetchTasks() {
      setLoadingTasks(true)
      if (accessibleWsIds.length === 0) {
        setUpcomingTasks([])
        setOverdueTasks([])
        setLoadingTasks(false)
        return
      }

      // Get board IDs from accessible workspaces
      const { data: boards } = await supabase
        .from('boards')
        .select('id')
        .in('workspace_id', accessibleWsIds)
      const boardIds = (boards || []).map(b => b.id)
      if (boardIds.length === 0) {
        setUpcomingTasks([])
        setOverdueTasks([])
        setLoadingTasks(false)
        return
      }

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      // Fetch upcoming (today + future)
      const { data: upcoming } = await supabase
        .from('tasks')
        .select('*, boards(name, workspace_id, workspaces(name, color))')
        .in('board_id', boardIds)
        .gte('due_date', today)
        .neq('status', 'Completado')
        .order('due_date', { ascending: true })
        .limit(20)

      // Fetch overdue (past date, not completed)
      const { data: overdue } = await supabase
        .from('tasks')
        .select('*, boards(name, workspace_id, workspaces(name, color))')
        .in('board_id', boardIds)
        .lt('due_date', today)
        .neq('status', 'Completado')
        .order('due_date', { ascending: true })
        .limit(20)

      if (upcoming) setUpcomingTasks(upcoming)
      if (overdue) setOverdueTasks(overdue)
      setLoadingTasks(false)
    }
    fetchTasks()
  }, [accessibleWsIds.join(',')])

  const scrollCarousel = (direction) => {
    if (!carouselRef.current) return
    const amount = 280
    carouselRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  const selectBoard = (board) => {
    const workspace = state.workspaces.find(w => w.id === board.workspace_id)
    if (workspace) {
      dispatch({ type: 'SET_CURRENT_WORKSPACE', payload: workspace })
    }
    dispatch({ type: 'SET_CURRENT_BOARD', payload: board })
  }

  const getDaysUntil = (dateStr) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const date = new Date(dateStr + 'T00:00:00')
    const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const formatDueLabel = (dateStr) => {
    const days = getDaysUntil(dateStr)
    if (days === 0) return 'Hoy'
    if (days === 1) return 'Mañana'
    if (days < 7) return `En ${days} días`
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })
  }

  const getDueColor = (dateStr) => {
    const days = getDaysUntil(dateStr)
    if (days === 0) return 'text-red-500 bg-red-500/10'
    if (days === 1) return 'text-orange-500 bg-orange-500/10'
    if (days <= 3) return 'text-yellow-500 bg-yellow-500/10'
    return 'text-muted-foreground bg-muted'
  }

  if (loadingTasks && recentBoards.length === 0) {
    return <HomeSkeleton />
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold">
            <span className="text-foreground">{greeting}, </span>
            <span className="text-muted-foreground">{userName}</span>
          </h1>
        </div>

        {/* Recent Boards Carousel */}
        {recentBoards.length > 0 && (
          <section className="mb-10 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Tableros recientes</h3>
              </div>
              {recentBoards.length > 3 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => scrollCarousel('left')}
                    className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => scrollCarousel('right')}
                    className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div
              ref={carouselRef}
              className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {recentBoards.map(board => {
                const wsName = board.workspaces?.name || ''
                const wsColor = board.workspaces?.color || '#6c5ce7'
                return (
                  <button
                    key={board.id}
                    onClick={() => selectBoard(board)}
                    className="group relative flex-shrink-0 w-[200px] h-[120px] rounded-xl border border-border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-muted-foreground/30"
                  >
                    <div className="h-1.5 w-full" style={{ backgroundColor: wsColor }} />
                    <div className="p-3 flex flex-col justify-between h-[calc(100%-6px)] bg-card">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate text-left">
                            {board.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground text-left flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-sm shrink-0"
                              style={{ backgroundColor: wsColor }}
                            />
                            {wsName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          {board.created_at
                            ? new Date(board.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short' })
                            : ''}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <section className="mb-10 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <h3 className="text-sm font-semibold text-destructive">Tareas atrasadas</h3>
              <span className="text-xs text-destructive/70">
                ({overdueTasks.length})
              </span>
            </div>

            <div className="rounded-xl border border-destructive/30 overflow-hidden bg-card">
              <div className="grid grid-cols-[1fr_140px_100px_100px_90px] gap-0 bg-destructive/5 border-b border-destructive/20 text-[11px] font-semibold text-destructive/70 uppercase tracking-wider">
                <div className="px-4 py-2.5">Tarea</div>
                <div className="px-3 py-2.5">Workspace</div>
                <div className="px-3 py-2.5 text-center">Estado</div>
                <div className="px-3 py-2.5 text-center">Prioridad</div>
                <div className="px-3 py-2.5 text-center">Atraso</div>
              </div>

              {overdueTasks.map(task => {
                const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                const workspaceName = task.boards?.workspaces?.name || ''
                const workspaceColor = task.boards?.workspaces?.color || '#6c5ce7'
                const boardName = task.boards?.name || ''
                const daysOverdue = getDaysUntil(task.due_date)

                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-[1fr_140px_100px_100px_90px] gap-0 border-b border-border last:border-b-0 hover:bg-destructive/5 transition-colors text-sm cursor-pointer"
                    onClick={() => dispatch({ type: 'OPEN_SIDE_PANEL', payload: task })}
                  >
                    <div className="px-4 py-3 flex items-center gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-foreground truncate font-medium text-[13px] hover:text-primary transition-colors flex items-center gap-1.5">{task.parent_task_id && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">↳ sub</span>}{task.title}</p>
                        {boardName && (
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
                            {boardName}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="px-3 py-3 flex items-center gap-1.5 min-w-0">
                      <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: workspaceColor }}>
                        {workspaceName?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{workspaceName}</span>
                    </div>
                    <div className="px-3 py-3 flex items-center justify-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap', STATUS_COLORS[task.status] || 'bg-gray-400')}>
                        {task.status}
                      </span>
                    </div>
                    <div className="px-3 py-3 flex items-center justify-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap', priority.color, priority.text)}>
                        {priority.label}
                      </span>
                    </div>
                    <div className="px-3 py-3 flex items-center justify-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-destructive bg-destructive/10 whitespace-nowrap">
                        {Math.abs(daysOverdue)}d atraso
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Upcoming Tasks */}
        <section className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Próximas tareas</h3>
            {upcomingTasks.length > 0 && (
              <span className="text-xs text-muted-foreground">
                ({upcomingTasks.length})
              </span>
            )}
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {loadingTasks ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Timer className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Cargando tareas...</span>
                </div>
              </div>
            ) : upcomingTasks.length === 0 ? (
              <EmptyState compact soft title="Todo al día" description="No hay tareas pendientes con fecha próxima. Crea nuevas tareas desde un tablero." />
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[1fr_140px_100px_100px_90px] gap-0 bg-muted/50 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <div className="px-4 py-2.5">Tarea</div>
                  <div className="px-3 py-2.5">Workspace</div>
                  <div className="px-3 py-2.5 text-center">Estado</div>
                  <div className="px-3 py-2.5 text-center">Prioridad</div>
                  <div className="px-3 py-2.5 text-center">Fecha</div>
                </div>

                {/* Rows */}
                {upcomingTasks.map(task => {
                  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                  const workspaceName = task.boards?.workspaces?.name || ''
                  const workspaceColor = task.boards?.workspaces?.color || '#6c5ce7'
                  const boardName = task.boards?.name || ''
                  const dueLabel = task.due_date ? formatDueLabel(task.due_date) : ''
                  const dueColor = task.due_date ? getDueColor(task.due_date) : ''

                  return (
                    <div
                      key={task.id}
                      className="grid grid-cols-[1fr_140px_100px_100px_90px] gap-0 border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors text-sm cursor-pointer"
                      onClick={() => dispatch({ type: 'OPEN_SIDE_PANEL', payload: task })}
                    >
                      {/* Task title */}
                      <div className="px-4 py-3 flex items-center gap-2 min-w-0">
                        <div className="min-w-0">
                          <p className="text-foreground truncate font-medium text-[13px] hover:text-primary transition-colors flex items-center gap-1.5">{task.parent_task_id && <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">↳ sub</span>}{task.title}</p>
                          {boardName && (
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/></svg>
                              {boardName}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Workspace */}
                      <div className="px-3 py-3 flex items-center gap-1.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: workspaceColor }}
                        >
                          {workspaceName?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">{workspaceName}</span>
                      </div>

                      {/* Status */}
                      <div className="px-3 py-3 flex items-center justify-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium text-white whitespace-nowrap',
                          STATUS_COLORS[task.status] || 'bg-gray-400'
                        )}>
                          {task.status}
                        </span>
                      </div>

                      {/* Priority */}
                      <div className="px-3 py-3 flex items-center justify-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap',
                          priority.color,
                          priority.text
                        )}>
                          {priority.label}
                        </span>
                      </div>

                      {/* Due date */}
                      <div className="px-3 py-3 flex items-center justify-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap',
                          dueColor
                        )}>
                          {dueLabel}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Buenos días'
  if (hour < 18) return 'Buenas tardes'
  return 'Buenas noches'
}
