import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, ChevronDown, ChevronRight, Zap, MoreHorizontal, Pencil, Trash2, Calendar, Palette, AlertTriangle } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { usePermissions } from '../../hooks/usePermissions'
import TaskRow from '../task/TaskRow'
import DatePicker from '../ui/DatePicker'
import HomePage from '../home/HomePage'
import ViewTabs from '../views/ViewTabs'
import KanbanView from '../views/KanbanView'
import CalendarView from '../views/CalendarView'
import GanttView from '../views/GanttView'
import FichasView from '../views/FichasView'
import CronogramaView from '../views/CronogramaView'
import { cn } from '../../lib/utils'
import BoardSkeleton from '../skeleton/BoardSkeleton'
import { toast } from 'sonner'
import EmptyState from '../ui/EmptyState'
import ColorPicker from '../ui/ColorPicker'
import ColumnToggle from './ColumnToggle'

export default function BoardView() {
  const { state, dispatch, openTaskModal } = useApp()
  const { fetchTasks, fetchSprints, fetchMembers, createTask, fetchBoardStatuses, initDefaultStatuses, fetchCustomFields, fetchCustomFieldValues } = useSupabase()
  const { can } = usePermissions()
  const [collapsedSprints, setCollapsedSprints] = useState({})
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingToSprint, setAddingToSprint] = useState(null)
  const [boardLoading, setBoardLoading] = useState(false)

  // Column visibility per board (persisted in localStorage)
  const [visibleColumns, setVisibleColumns] = useState({})

  useEffect(() => {
    if (state.currentBoard) {
      const stored = localStorage.getItem(`workflow-columns-${state.currentBoard.id}`)
      if (stored) try { setVisibleColumns(JSON.parse(stored)) } catch { setVisibleColumns({}) }
      else setVisibleColumns({})
    }
  }, [state.currentBoard?.id])

  const handleToggleColumn = (key, visible) => {
    const updated = { ...visibleColumns, [key]: visible }
    setVisibleColumns(updated)
    if (state.currentBoard) {
      localStorage.setItem(`workflow-columns-${state.currentBoard.id}`, JSON.stringify(updated))
    }
  }

  const isColVisible = (key) => visibleColumns[key] !== false

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
      setBoardLoading(true)
      Promise.all([
        fetchTasks(state.currentBoard.id),
        fetchSprints(state.currentBoard.id),
        initDefaultStatuses(state.currentBoard.id).then(() => fetchBoardStatuses(state.currentBoard.id)),
        fetchCustomFields(state.currentBoard.id),
        fetchCustomFieldValues(state.currentBoard.id),
      ]).finally(() => setBoardLoading(false))
    }
    if (state.currentOrg) {
      fetchMembers(state.currentOrg.id)
    }
  }, [state.currentBoard, state.currentOrg])

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
      status: state.boardStatuses?.[1]?.name || state.boardStatuses?.[0]?.name || 'Por hacer',
      priority: 'medium',
      position: taskCount,
    })
    setNewTaskTitle('')
    setAddingToSprint(null)
  }

  if (!state.currentBoard) {
    return <HomePage />
  }

  if (boardLoading || state.loading) {
    return <BoardSkeleton />
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
        columnToggle={
          ['tabla', 'kanban', 'fichas'].includes(activeView) ? (
            <ColumnToggle
              customFields={state.customFields || []}
              visibleColumns={visibleColumns}
              onToggle={handleToggleColumn}
            />
          ) : null
        }
      />

      {/* Active View */}
      <div className="flex-1 relative min-h-0 flex flex-col">
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
          isColVisible={isColVisible}
        />
      )}
      {activeView === 'kanban' && <KanbanView isColVisible={isColVisible} />}
      {activeView === 'calendario' && <CalendarView />}
      {activeView === 'gantt' && <GanttView />}
      {activeView === 'fichas' && <FichasView isColVisible={isColVisible} />}
      {activeView === 'cronograma' && <CronogramaView />}
      </div>

    </div>
  )
}

function TableView({
  state, collapsedSprints, toggleSprint,
  addingToSprint, setAddingToSprint,
  newTaskTitle, setNewTaskTitle, handleQuickAddTask,
  isColVisible,
}) {
  const { dispatch } = useApp()
  const { updateSprint, deleteSprint, updateTask, setCustomFieldValue } = useSupabase()
  const customFields = state.customFields || []
  const visibleCF = customFields.filter(cf => isColVisible(`cf_${cf.id}`))

  const gridTemplate = [
    'minmax(250px,2fr)',
    isColVisible('assignee') ? '150px' : '0px',
    isColVisible('status') ? '120px' : '0px',
    isColVisible('due_date') ? '120px' : '0px',
    isColVisible('priority') ? '100px' : '0px',
    isColVisible('sprint') ? '150px' : '0px',
    ...customFields.map(cf => isColVisible(`cf_${cf.id}`) ? `${Math.max(cf.name.length * 9 + 24, 140)}px` : '0px'),
    '50px',
  ].join(' ')
  const { can } = usePermissions()
  const [sprintMenu, setSprintMenu] = useState(null)
  const [editingSprint, setEditingSprint] = useState(null)
  const [editSprintName, setEditSprintName] = useState('')
  const [deleteSprintConfirm, setDeleteSprintConfirm] = useState(null)
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverSprint, setDragOverSprint] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [dragOverSprintKey, setDragOverSprintKey] = useState(null)
  const dragCounters = useRef({})
  const menuRef = useRef(null)

  const handleTaskDragStart = (task) => setDraggedTask(task)
  const handleTaskDragEnd = () => {
    setDraggedTask(null)
    setDragOverSprint(null)
    setDragOverIndex(null)
    setDragOverSprintKey(null)
    dragCounters.current = {}
  }

  const handleSprintDragEnter = (sprintId) => {
    const key = sprintId || '_backlog'
    dragCounters.current[key] = (dragCounters.current[key] || 0) + 1
    setDragOverSprint(key)
  }
  const handleSprintDragLeave = (sprintId) => {
    const key = sprintId || '_backlog'
    dragCounters.current[key] = (dragCounters.current[key] || 0) - 1
    if (dragCounters.current[key] <= 0) {
      dragCounters.current[key] = 0
      if (dragOverSprint === key) setDragOverSprint(null)
    }
  }
  const handleRowDragOver = (e, index, sprintKey) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const insertIdx = e.clientY < midY ? index : index + 1
    setDragOverIndex(insertIdx)
    setDragOverSprintKey(sprintKey)
  }
  const handleSprintDrop = async (e, sprintId) => {
    e.preventDefault()
    if (!draggedTask) return handleTaskDragEnd()

    const sprintKey = sprintId || '_nosprint'
    const sprintTasks = state.tasks
      .filter(t => sprintId ? t.sprint_id === sprintId : !t.sprint_id)
      .sort((a, b) => (a.position || 0) - (b.position || 0))

    const isSameSprint = sprintId ? draggedTask.sprint_id === sprintId : !draggedTask.sprint_id
    const targetIdx = (dragOverSprintKey === sprintKey && dragOverIndex !== null) ? dragOverIndex : sprintTasks.length

    if (isSameSprint) {
      const oldIdx = sprintTasks.findIndex(t => t.id === draggedTask.id)
      if (oldIdx === targetIdx || oldIdx === targetIdx - 1) return handleTaskDragEnd()

      const reordered = sprintTasks.filter(t => t.id !== draggedTask.id)
      const adjustedIdx = targetIdx > oldIdx ? targetIdx - 1 : targetIdx
      reordered.splice(adjustedIdx, 0, draggedTask)

      const updates = reordered.map((t, i) => ({ id: t.id, position: i }))
      updates.forEach(u => dispatch({ type: 'UPDATE_TASK', payload: u }))
      await Promise.all(updates.map(u => updateTask(u.id, { position: u.position })))
    } else {
      const adjustedIdx = targetIdx !== null ? targetIdx : sprintTasks.length
      dispatch({ type: 'UPDATE_TASK', payload: { id: draggedTask.id, sprint_id: sprintId, position: adjustedIdx } })
      await updateTask(draggedTask.id, { sprint_id: sprintId, position: adjustedIdx })
    }
    handleTaskDragEnd()
  }

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setSprintMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const handleRenameSprint = async (sprintId) => {
    if (editSprintName.trim()) {
      await updateSprint(sprintId, { name: editSprintName.trim() })
      toast.success('Sprint renombrado')
    }
    setEditingSprint(null)
    setEditSprintName('')
  }

  const handleDeleteSprint = async (sprintId) => {
    await deleteSprint(sprintId)
    toast.success('Sprint eliminado')
    setDeleteSprintConfirm(null)
  }

  const handleSprintDateChange = async (sprintId, field, value) => {
    await updateSprint(sprintId, { [field]: value || null })
  }

  const unassignedTasks = state.tasks.filter(t => !t.sprint_id).sort((a, b) => (a.position || 0) - (b.position || 0))

  if (state.sprints.length === 0 && state.tasks.length === 0) {
    return <EmptyState title="Sin tareas" description="Crea tu primera tarea o sprint para comenzar a organizar tu trabajo." />
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4">
      {state.sprints.map(sprint => {
        const sprintTasks = state.tasks.filter(t => t.sprint_id === sprint.id).sort((a, b) => (a.position || 0) - (b.position || 0))
        const isCollapsed = collapsedSprints[sprint.id]
        const completedCount = sprintTasks.filter(t => t.status === 'Completado').length
        const progress = sprintTasks.length > 0 ? (completedCount / sprintTasks.length) * 100 : 0

        return (
          <div
            key={sprint.id}
            className={cn(
              'mb-6 animate-fade-in rounded-lg transition-all',
              dragOverSprint === sprint.id && draggedTask?.sprint_id !== sprint.id && 'ring-2 ring-primary/30 bg-primary/5'
            )}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => handleSprintDragEnter(sprint.id)}
            onDragLeave={() => handleSprintDragLeave(sprint.id)}
            onDrop={(e) => handleSprintDrop(e, sprint.id)}
          >
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
              {editingSprint === sprint.id ? (
                <input
                  autoFocus
                  value={editSprintName}
                  onChange={(e) => setEditSprintName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSprint(sprint.id)
                    if (e.key === 'Escape') { setEditingSprint(null); setEditSprintName('') }
                  }}
                  onBlur={() => handleRenameSprint(sprint.id)}
                  className="px-2 py-0.5 text-sm font-semibold rounded border border-ring bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ) : (
                <h3 className="font-semibold text-sm text-foreground">{sprint.name}</h3>
              )}
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

              {/* Sprint menu trigger */}
              {can('editSprint') && <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSprintMenu(sprintMenu === sprint.id ? null : sprint.id)
                  }}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {sprintMenu === sprint.id && (
                  <div
                    ref={menuRef}
                    className="absolute top-full right-0 mt-1 w-52 rounded-xl border border-border bg-popover shadow-lg py-1.5 z-50 animate-scale-in"
                  >
                    <div className="px-3 py-1.5 border-b border-border">
                      <span className="text-xs font-semibold text-foreground">{sprint.name}</span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setEditingSprint(sprint.id)
                          setEditSprintName(sprint.name)
                          setSprintMenu(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        Renombrar
                      </button>
                      <div className="px-3 py-1.5">
                        <p className="text-[10px] text-muted-foreground mb-1">Fecha inicio</p>
                        <DatePicker
                          value={sprint.start_date || ''}
                          onChange={(val) => handleSprintDateChange(sprint.id, 'start_date', val)}
                          placeholder="Sin fecha"
                          size="sm"
                        />
                      </div>
                      <div className="px-3 py-1.5">
                        <p className="text-[10px] text-muted-foreground mb-1">Fecha fin</p>
                        <DatePicker
                          value={sprint.end_date || ''}
                          onChange={(val) => handleSprintDateChange(sprint.id, 'end_date', val)}
                          placeholder="Sin fecha"
                          size="sm"
                        />
                      </div>
                    </div>
                      <div className="px-3 py-1.5">
                        <p className="text-[10px] text-muted-foreground mb-1.5">Color</p>
                        <ColorPicker
                          value={sprint.color || '#6c5ce7'}
                          onChange={(c) => updateSprint(sprint.id, { color: c })}
                          size="sm"
                        />
                      </div>
                    <div className="h-px bg-border mx-2 my-1" />
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setDeleteSprintConfirm(sprint)
                          setSprintMenu(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Eliminar sprint
                      </button>
                    </div>
                  </div>
                )}
              </div>}
            </div>

            {!isCollapsed && (
              <div className="rounded-lg border border-border bg-card overflow-x-auto">
                <div className="min-w-fit">
                <div className="grid gap-0 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ gridTemplateColumns: gridTemplate }}>
                  <div className="px-3 py-2">Tarea</div>
                  <div className={`px-3 py-2 text-center ${!isColVisible('assignee') ? 'overflow-hidden' : ''}`}>{isColVisible('assignee') ? 'Responsable' : ''}</div>
                  <div className={`px-3 py-2 text-center ${!isColVisible('status') ? 'overflow-hidden' : ''}`}>{isColVisible('status') ? 'Estado' : ''}</div>
                  <div className={`px-3 py-2 text-center ${!isColVisible('due_date') ? 'overflow-hidden' : ''}`}>{isColVisible('due_date') ? 'Fecha' : ''}</div>
                  <div className={`px-3 py-2 text-center ${!isColVisible('priority') ? 'overflow-hidden' : ''}`}>{isColVisible('priority') ? 'Prioridad' : ''}</div>
                  <div className={`px-3 py-2 text-center ${!isColVisible('sprint') ? 'overflow-hidden' : ''}`}>{isColVisible('sprint') ? 'Sprint' : ''}</div>
                  {customFields.map(cf => (
                    <div key={cf.id} className={`px-3 py-2 text-center whitespace-nowrap ${!isColVisible(`cf_${cf.id}`) ? 'overflow-hidden' : ''}`}>{isColVisible(`cf_${cf.id}`) ? cf.name : ''}</div>
                  ))}
                  <div className="px-3 py-2 text-center"></div>
                </div>

                {sprintTasks.map((task, idx) => (
                  <div key={task.id}>
                    {draggedTask && dragOverSprintKey === sprint.id && dragOverIndex === idx && draggedTask.id !== task.id && (
                      <div className="h-0.5 bg-primary/60 mx-2" />
                    )}
                    <TaskRow
                      task={task}
                      onDragStart={handleTaskDragStart}
                      onDragEnd={handleTaskDragEnd}
                      onDragOver={(e) => handleRowDragOver(e, idx, sprint.id)}
                      isDragging={draggedTask?.id === task.id}
                      gridTemplate={gridTemplate}
                      customFields={customFields}
                      isColVisible={isColVisible}
                    />
                  </div>
                ))}
                {draggedTask && dragOverSprintKey === sprint.id && dragOverIndex === sprintTasks.length && (
                  <div className="h-0.5 bg-primary/60 mx-2" />
                )}

                </div>
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
                ) : can('createTask') ? (
                  <button
                    onClick={() => setAddingToSprint(sprint.id)}
                    className="w-full px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-t border-border"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar tarea
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )
      })}

      {/* Tasks without sprint */}
      {unassignedTasks.length > 0 && (
        <div
          className={cn(
            'mb-6 animate-fade-in rounded-lg transition-all',
            dragOverSprint === '_nosprint' && draggedTask?.sprint_id !== null && 'ring-2 ring-primary/30 bg-primary/5'
          )}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={() => handleSprintDragEnter(null)}
          onDragLeave={() => handleSprintDragLeave(null)}
          onDrop={(e) => handleSprintDrop(e, null)}
        >
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => toggleSprint('_nosprint')}
              className="p-0.5 rounded hover:bg-accent transition-colors"
            >
              {collapsedSprints._nosprint
                ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
              }
            </button>
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <h3 className="font-semibold text-sm text-foreground">Sin sprint</h3>
            <span className="text-xs text-muted-foreground">
              {unassignedTasks.length} tareas
            </span>
          </div>
          {!collapsedSprints._nosprint && (
          <div className="rounded-lg border border-border bg-card overflow-x-auto">
            <div className="min-w-fit">
            <div className="grid gap-0 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="px-3 py-2">Tarea</div>
              <div className={`px-3 py-2 text-center ${!isColVisible('assignee') ? 'overflow-hidden' : ''}`}>{isColVisible('assignee') ? 'Responsable' : ''}</div>
              <div className={`px-3 py-2 text-center ${!isColVisible('status') ? 'overflow-hidden' : ''}`}>{isColVisible('status') ? 'Estado' : ''}</div>
              <div className={`px-3 py-2 text-center ${!isColVisible('due_date') ? 'overflow-hidden' : ''}`}>{isColVisible('due_date') ? 'Fecha' : ''}</div>
              <div className={`px-3 py-2 text-center ${!isColVisible('priority') ? 'overflow-hidden' : ''}`}>{isColVisible('priority') ? 'Prioridad' : ''}</div>
              <div className={`px-3 py-2 text-center ${!isColVisible('sprint') ? 'overflow-hidden' : ''}`}>{isColVisible('sprint') ? 'Sprint' : ''}</div>
              {customFields.map(cf => (
                <div key={cf.id} className={`px-3 py-2 text-center whitespace-nowrap ${!isColVisible(`cf_${cf.id}`) ? 'overflow-hidden' : ''}`}>{isColVisible(`cf_${cf.id}`) ? cf.name : ''}</div>
              ))}
              <div className="px-3 py-2 text-center"></div>
            </div>
            {unassignedTasks.map((task, idx) => (
              <div key={task.id}>
                {draggedTask && dragOverSprintKey === '_nosprint' && dragOverIndex === idx && draggedTask.id !== task.id && (
                  <div className="h-0.5 bg-primary/60 mx-2" />
                )}
                <TaskRow
                  task={task}
                  onDragStart={handleTaskDragStart}
                  onDragEnd={handleTaskDragEnd}
                  onDragOver={(e) => handleRowDragOver(e, idx, '_nosprint')}
                  isDragging={draggedTask?.id === task.id}
                  gridTemplate={gridTemplate}
                  customFields={customFields}
                  isColVisible={isColVisible}
                />
              </div>
            ))}
            {draggedTask && dragOverSprintKey === '_nosprint' && dragOverIndex === unassignedTasks.length && (
              <div className="h-0.5 bg-primary/60 mx-2" />
            )}
            </div>
            {addingToSprint === '_nosprint' ? (
              <div className="px-3 py-2 border-t border-border">
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleQuickAddTask(null)
                    if (e.key === 'Escape') { setAddingToSprint(null); setNewTaskTitle('') }
                  }}
                  onBlur={() => { if (!newTaskTitle.trim()) { setAddingToSprint(null); setNewTaskTitle('') } }}
                  placeholder="Nombre de la tarea..."
                  className="w-full px-2 py-1 text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground"
                />
              </div>
            ) : can('createTask') ? (
              <button
                onClick={() => setAddingToSprint('_nosprint')}
                className="w-full px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-t border-border"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar tarea
              </button>
            ) : null}
          </div>
          )}
        </div>
      )}

      {/* Delete Sprint Confirmation */}
      {deleteSprintConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setDeleteSprintConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm bg-card rounded-xl shadow-2xl border border-border animate-scale-in p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Eliminar sprint</h3>
                <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Se eliminará el sprint{' '}
              <span className="font-semibold text-foreground">"{deleteSprintConfirm.name}"</span>.
              Las tareas asociadas quedarán sin sprint asignado.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setDeleteSprintConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteSprint(deleteSprintConfirm.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
