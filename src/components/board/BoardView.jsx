import { useEffect, useState, useCallback } from 'react'
import { Plus, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import TaskRow from '../task/TaskRow'
import HomePage from '../home/HomePage'
import ViewTabs from '../views/ViewTabs'
import KanbanView from '../views/KanbanView'
import CalendarView from '../views/CalendarView'
import GanttView from '../views/GanttView'
import FichasView from '../views/FichasView'
import CronogramaView from '../views/CronogramaView'
import { cn } from '../../lib/utils'

export default function BoardView() {
  const { state, openTaskModal } = useApp()
  const { fetchTasks, fetchSprints, fetchMembers, createTask } = useSupabase()
  const [collapsedSprints, setCollapsedSprints] = useState({})
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingToSprint, setAddingToSprint] = useState(null)

  // Views state per board (persisted in localStorage)
  const [activeViews, setActiveViews] = useState(['tabla'])
  const [activeView, setActiveView] = useState('tabla')

  // Load views for current board
  useEffect(() => {
    if (state.currentBoard) {
      const stored = localStorage.getItem(`workflow-views-${state.currentBoard.id}`)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setActiveViews(parsed.views || ['tabla'])
          setActiveView(parsed.active || parsed.views?.[0] || 'tabla')
        } catch {
          setActiveViews(['tabla'])
          setActiveView('tabla')
        }
      } else {
        setActiveViews(['tabla'])
        setActiveView('tabla')
      }
    }
  }, [state.currentBoard?.id])

  // Save views when they change
  const saveViews = useCallback((views, active) => {
    if (state.currentBoard) {
      localStorage.setItem(
        `workflow-views-${state.currentBoard.id}`,
        JSON.stringify({ views, active })
      )
    }
  }, [state.currentBoard?.id])

  const handleAddView = (viewId) => {
    const newViews = [...activeViews, viewId]
    setActiveViews(newViews)
    setActiveView(viewId)
    saveViews(newViews, viewId)
  }

  const handleRemoveView = (viewId) => {
    const newViews = activeViews.filter(v => v !== viewId)
    const newActive = activeView === viewId ? newViews[0] : activeView
    setActiveViews(newViews)
    setActiveView(newActive)
    saveViews(newViews, newActive)
  }

  const handleChangeView = (viewId) => {
    setActiveView(viewId)
    saveViews(activeViews, viewId)
  }

  useEffect(() => {
    if (state.currentBoard) {
      fetchTasks(state.currentBoard.id)
      fetchSprints(state.currentBoard.id)
    }
    if (state.currentWorkspace) {
      fetchMembers(state.currentWorkspace.id)
    }
  }, [state.currentBoard, state.currentWorkspace])

  const toggleSprint = (id) => {
    setCollapsedSprints(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleQuickAddTask = async (sprintId) => {
    if (!newTaskTitle.trim()) return
    const taskCount = state.tasks.filter(t => t.sprint_id === sprintId).length
    await createTask({
      title: newTaskTitle.trim(),
      board_id: state.currentBoard.id,
      sprint_id: sprintId,
      status: 'Por hacer',
      priority: 'medium',
      position: taskCount,
    })
    setNewTaskTitle('')
    setAddingToSprint(null)
  }

  if (!state.currentBoard) {
    return <HomePage />
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* View Tabs */}
      <ViewTabs
        activeViews={activeViews}
        activeView={activeView}
        onChangeView={handleChangeView}
        onAddView={handleAddView}
        onRemoveView={handleRemoveView}
      />

      {/* Active View */}
      {activeView === 'tabla' && (
        <TableView
          state={state}
          collapsedSprints={collapsedSprints}
          toggleSprint={toggleSprint}
          addingToSprint={addingToSprint}
          setAddingToSprint={setAddingToSprint}
          newTaskTitle={newTaskTitle}
          setNewTaskTitle={setNewTaskTitle}
          handleQuickAddTask={handleQuickAddTask}
        />
      )}
      {activeView === 'kanban' && <KanbanView />}
      {activeView === 'calendario' && <CalendarView />}
      {activeView === 'gantt' && <GanttView />}
      {activeView === 'fichas' && <FichasView />}
      {activeView === 'cronograma' && <CronogramaView />}
    </div>
  )
}

function TableView({
  state, collapsedSprints, toggleSprint,
  addingToSprint, setAddingToSprint,
  newTaskTitle, setNewTaskTitle, handleQuickAddTask,
}) {
  const backlogTasks = state.tasks.filter(t => !t.sprint_id)

  return (
    <div className="flex-1 overflow-auto p-4">
      {state.sprints.map(sprint => {
        const sprintTasks = state.tasks.filter(t => t.sprint_id === sprint.id)
        const isCollapsed = collapsedSprints[sprint.id]
        const completedCount = sprintTasks.filter(t => t.status === 'Completado').length
        const progress = sprintTasks.length > 0 ? (completedCount / sprintTasks.length) * 100 : 0

        return (
          <div key={sprint.id} className="mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-2 group">
              <button
                onClick={() => toggleSprint(sprint.id)}
                className="p-0.5 rounded hover:bg-accent transition-colors"
              >
                {isCollapsed
                  ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                }
              </button>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: sprint.color || '#6c5ce7' }}
              />
              <h3 className="font-semibold text-sm text-foreground">{sprint.name}</h3>
              <span className="text-xs text-muted-foreground">
                {sprintTasks.length} tareas
              </span>
              <div className="flex-1" />
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">
                {Math.round(progress)}%
              </span>
              {sprint.start_date && sprint.end_date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(sprint.start_date).toLocaleDateString('es')} - {new Date(sprint.end_date).toLocaleDateString('es')}
                </span>
              )}
            </div>

            {!isCollapsed && (
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                <div className="grid grid-cols-[minmax(300px,2fr)_120px_100px_120px_100px_80px] gap-0 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="px-3 py-2">Tarea</div>
                  <div className="px-3 py-2 text-center">Responsable</div>
                  <div className="px-3 py-2 text-center">Estado</div>
                  <div className="px-3 py-2 text-center">Fecha</div>
                  <div className="px-3 py-2 text-center">Prioridad</div>
                  <div className="px-3 py-2 text-center"></div>
                </div>

                {sprintTasks.map(task => (
                  <TaskRow key={task.id} task={task} />
                ))}

                {addingToSprint === sprint.id ? (
                  <div className="px-3 py-2 border-t border-border">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQuickAddTask(sprint.id)
                        if (e.key === 'Escape') { setAddingToSprint(null); setNewTaskTitle('') }
                      }}
                      onBlur={() => { if (!newTaskTitle.trim()) { setAddingToSprint(null); setNewTaskTitle('') } }}
                      placeholder="Nombre de la tarea..."
                      className="w-full px-2 py-1 text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingToSprint(sprint.id)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-t border-border"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar tarea
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {backlogTasks.length > 0 && (
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <h3 className="font-semibold text-sm text-foreground">Backlog</h3>
            <span className="text-xs text-muted-foreground">
              {backlogTasks.length} tareas
            </span>
          </div>
          <div className="rounded-lg border border-border overflow-hidden bg-card">
            <div className="grid grid-cols-[minmax(300px,2fr)_120px_100px_120px_100px_80px] gap-0 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="px-3 py-2">Tarea</div>
              <div className="px-3 py-2 text-center">Responsable</div>
              <div className="px-3 py-2 text-center">Estado</div>
              <div className="px-3 py-2 text-center">Fecha</div>
              <div className="px-3 py-2 text-center">Prioridad</div>
              <div className="px-3 py-2 text-center"></div>
            </div>
            {backlogTasks.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {state.sprints.length === 0 && backlogTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No hay sprints todavía</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Crea un sprint para empezar a organizar tus tareas.
          </p>
        </div>
      )}
    </div>
  )
}
