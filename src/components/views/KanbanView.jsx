import { useState, useRef } from 'react'
import { Plus } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'
import { PRIORITY_CONFIG } from '../../lib/constants'
import EmptyState from '../ui/EmptyState'

export default function KanbanView({ isColVisible = () => true }) {
  const { state, dispatch, openTask } = useApp()
  const { updateTask, createTask } = useSupabase()
  const [addingTo, setAddingTo] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverCol, setDragOverCol] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const dragCounter = useRef({})

  const handleQuickAdd = async (status) => {
    if (!newTitle.trim()) return
    await createTask({
      title: newTitle.trim(),
      board_id: state.currentBoard.id,
      sprint_id: state.sprints.length > 0 ? state.sprints[0].id : null,
      status,
      priority: 'medium',
      position: state.tasks.filter(t => t.status === status).length,
    })
    setNewTitle('')
    setAddingTo(null)
  }

  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    // Set a ghost image with slight transparency
    const el = e.currentTarget
    el.style.opacity = '0.5'
    setTimeout(() => { el.style.opacity = '1' }, 0)
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverCol(null)
    setDragOverIndex(null)
    dragCounter.current = {}
  }

  const handleColumnDragEnter = (e, status) => {
    e.preventDefault()
    dragCounter.current[status] = (dragCounter.current[status] || 0) + 1
    setDragOverCol(status)
  }

  const handleColumnDragLeave = (e, status) => {
    dragCounter.current[status] = (dragCounter.current[status] || 0) - 1
    if (dragCounter.current[status] <= 0) {
      dragCounter.current[status] = 0
      if (dragOverCol === status) setDragOverCol(null)
    }
  }

  const handleColumnDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleCardDragOver = (e, index, status) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const insertIdx = e.clientY < midY ? index : index + 1
    setDragOverIndex(insertIdx)
    setDragOverCol(status)
  }

  const handleDrop = async (e, status) => {
    e.preventDefault()
    if (!draggedTask) return handleDragEnd()

    const columnTasks = state.tasks
      .filter(t => t.status === status)
      .sort((a, b) => (a.position || 0) - (b.position || 0))

    const isSameCol = draggedTask.status === status
    const targetIdx = dragOverIndex !== null ? dragOverIndex : columnTasks.length

    if (isSameCol) {
      // Reorder within same column
      const oldIdx = columnTasks.findIndex(t => t.id === draggedTask.id)
      if (oldIdx === targetIdx || oldIdx === targetIdx - 1) return handleDragEnd()

      const reordered = columnTasks.filter(t => t.id !== draggedTask.id)
      const adjustedIdx = targetIdx > oldIdx ? targetIdx - 1 : targetIdx
      reordered.splice(adjustedIdx, 0, draggedTask)

      // Optimistic update
      const updates = reordered.map((t, i) => ({ id: t.id, position: i }))
      updates.forEach(u => {
        dispatch({ type: 'UPDATE_TASK', payload: u })
      })
      // Save to DB
      await Promise.all(updates.map(u => updateTask(u.id, { position: u.position })))
    } else {
      // Move to different column
      const adjustedIdx = targetIdx !== null ? targetIdx : columnTasks.length
      // Update position of tasks after insert point
      const updates = []
      columnTasks.forEach((t, i) => {
        if (i >= adjustedIdx) updates.push({ id: t.id, position: i + 1 })
      })
      updates.forEach(u => dispatch({ type: 'UPDATE_TASK', payload: u }))
      dispatch({ type: 'UPDATE_TASK', payload: { id: draggedTask.id, status, position: adjustedIdx } })

      await updateTask(draggedTask.id, { status, position: adjustedIdx })
      await Promise.all(updates.map(u => updateTask(u.id, { position: u.position })))
    }
    handleDragEnd()
  }

  if (state.tasks.length === 0) {
    return <EmptyState title="Sin tareas" description="Crea tu primera tarea para verla en el tablero Kanban." />
  }


  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="flex gap-4 min-w-max">
        {(state.boardStatuses || []).map(col => {
          const columnTasks = state.tasks
            .filter(t => t.status === col.name)
            .sort((a, b) => (a.position || 0) - (b.position || 0))
          const isOver = dragOverCol === col.name && draggedTask

          return (
            <div
              key={col.id}
              className="w-[280px] flex flex-col shrink-0"
              onDragEnter={(e) => handleColumnDragEnter(e, col.name)}
              onDragLeave={(e) => handleColumnDragLeave(e, col.name)}
              onDragOver={handleColumnDragOver}
              onDrop={(e) => handleDrop(e, col.name)}
            >
              {/* Column header */}
              <div
                className="rounded-t-lg border-t-[3px] bg-card border border-border px-3 py-2.5 flex items-center justify-between transition-colors"
                style={{ borderTopColor: col.color }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-sm font-semibold text-foreground">{col.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Cards area */}
              <div className={cn(
                'flex-1 space-y-2 pt-2 pb-4 min-h-[100px] rounded-b-lg transition-all duration-200',
                isOver && cn('ring-2 ring-dashed ring-muted-foreground/30', col.dropBg)
              )}>
                {columnTasks.map((task, index) => {
                  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                  const isDragging = draggedTask?.id === task.id
                  const showDropBefore = isOver && dragOverIndex === index && draggedTask?.id !== task.id

                  return (
                    <div key={task.id}>
                      {showDropBefore && (
                        <div className="h-1 bg-primary/50 rounded-full mx-1 mb-1 animate-pulse" />
                      )}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleCardDragOver(e, index, col.name)}
                      onClick={() => openTask(task)}
                      className={cn(
                        'bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all group',
                        isDragging
                          ? 'opacity-40 scale-95 rotate-1 shadow-none'
                          : 'hover:shadow-md hover:-translate-y-0.5'
                      )}
                    >
                      <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">{task.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isColVisible('priority') && (
                          <span className={cn(
                            'px-1.5 py-0.5 rounded text-[10px] font-medium',
                            priority.color, priority.text
                          )}>
                            {priority.label}
                          </span>
                        )}
                        {isColVisible('due_date') && task.due_date && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                        {isColVisible('sprint') && task.sprint_id && (() => {
                          const s = state.sprints.find(sp => sp.id === task.sprint_id)
                          return s ? (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color || '#6c5ce7' }} />
                              {s.name}
                            </span>
                          ) : null
                        })()}
                      </div>
                      {isColVisible('assignee') && task.assignee_name && (() => {
                        const member = state.orgMembers.find(m => m.id === task.assignee_id)
                        return (
                          <div className="flex items-center gap-1.5 mt-2">
                            {member?.avatar_url ? (
                              <img src={member.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                style={{ backgroundColor: member?.color || 'hsl(var(--primary))' }}
                              >
                                {task.assignee_name[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="text-[11px] text-muted-foreground">{task.assignee_name}</span>
                          </div>
                        )
                      })()}
                      {/* Custom Fields */}
                      {(state.customFields || []).filter(cf => isColVisible(`cf_${cf.id}`)).length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {(state.customFields || []).filter(cf => isColVisible(`cf_${cf.id}`)).map(cf => {
                            const vals = state.customFieldValues?.[task.id] || []
                            const cfVal = vals.find(v => v.custom_field_id === cf.id)
                            if (!cfVal) return null

                            if (cf.type === 'dropdown') {
                              const opt = (cf.custom_field_options || []).find(o => o.id === cfVal.value_option_id)
                              if (!opt) return null
                              return <span key={cf.id} className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white" style={{ backgroundColor: opt.color }}>{opt.label}</span>
                            }
                            const val = cfVal.value_text || cfVal.value_number || cfVal.value_price || cfVal.value_date
                            if (!val) return null
                            return (
                              <span key={cf.id} className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {cf.type === 'price' ? `$${val}` : cf.type === 'date' ? new Date(val + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' }) : val}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    </div>
                  )
                })}
                {/* Drop indicator at end of column */}
                {isOver && dragOverIndex === columnTasks.length && (
                  <div className="h-1 bg-primary/50 rounded-full mx-1 animate-pulse" />
                )}

                {/* Drop indicator when column is empty and being dragged over */}
                {isOver && columnTasks.length === 0 && (
                  <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg h-20 flex items-center justify-center mx-1 animate-fade-in">
                    <span className="text-xs text-muted-foreground">Soltar aquí</span>
                  </div>
                )}

                {/* Quick add */}
                {addingTo === col.name ? (
                  <div className="bg-card border border-border rounded-lg p-2">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQuickAdd(col.name)
                        if (e.key === 'Escape') { setAddingTo(null); setNewTitle('') }
                      }}
                      onBlur={() => { if (!newTitle.trim()) { setAddingTo(null); setNewTitle('') } }}
                      placeholder="Título de la tarea..."
                      className="w-full px-2 py-1 text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTo(col.name)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar tarea
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
