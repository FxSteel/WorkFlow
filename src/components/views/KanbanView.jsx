import { useState } from 'react'
import { Plus, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'

const COLUMNS = [
  { status: 'Por hacer', color: 'bg-gray-400', border: 'border-t-gray-400' },
  { status: 'En progreso', color: 'bg-blue-500', border: 'border-t-blue-500' },
  { status: 'En revisión', color: 'bg-yellow-500', border: 'border-t-yellow-500' },
  { status: 'Completado', color: 'bg-emerald-500', border: 'border-t-emerald-500' },
  { status: 'Bloqueado', color: 'bg-red-500', border: 'border-t-red-500' },
]

const PRIORITY_CONFIG = {
  critical: { label: 'Crítica', color: 'bg-red-500', text: 'text-white' },
  high: { label: 'Alta', color: 'bg-orange-500', text: 'text-white' },
  medium: { label: 'Media', color: 'bg-yellow-500', text: 'text-black' },
  low: { label: 'Baja', color: 'bg-blue-500', text: 'text-white' },
}

export default function KanbanView() {
  const { state, openTaskModal, openSidePanel } = useApp()
  const { updateTask, createTask, deleteTask } = useSupabase()
  const [addingTo, setAddingTo] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [draggedTask, setDraggedTask] = useState(null)

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
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, status) => {
    e.preventDefault()
    if (draggedTask && draggedTask.status !== status) {
      await updateTask(draggedTask.id, { status })
    }
    setDraggedTask(null)
  }

  return (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-4 min-w-max h-full">
        {COLUMNS.map(col => {
          const columnTasks = state.tasks.filter(t => t.status === col.status)
          return (
            <div
              key={col.status}
              className="w-[280px] flex flex-col shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column header */}
              <div className={cn('rounded-t-lg border-t-[3px] bg-card border border-border px-3 py-2.5 flex items-center justify-between', col.border)}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-2.5 h-2.5 rounded-full', col.color)} />
                  <span className="text-sm font-semibold text-foreground">{col.status}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 pt-2 pb-4 min-h-[100px]">
                {columnTasks.map(task => {
                  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task)}
                      onClick={() => openSidePanel(task)}
                      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group"
                    >
                      <p className="text-sm font-medium text-foreground mb-2 line-clamp-2">{task.title}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'px-1.5 py-0.5 rounded text-[10px] font-medium',
                          priority.color, priority.text
                        )}>
                          {priority.label}
                        </span>
                        {task.due_date && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      {task.assignee_name && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-semibold text-primary">
                            {task.assignee_name[0]?.toUpperCase()}
                          </div>
                          <span className="text-[11px] text-muted-foreground">{task.assignee_name}</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Quick add */}
                {addingTo === col.status ? (
                  <div className="bg-card border border-border rounded-lg p-2">
                    <input
                      autoFocus
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQuickAdd(col.status)
                        if (e.key === 'Escape') { setAddingTo(null); setNewTitle('') }
                      }}
                      onBlur={() => { if (!newTitle.trim()) { setAddingTo(null); setNewTitle('') } }}
                      placeholder="Título de la tarea..."
                      className="w-full px-2 py-1 text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTo(col.status)}
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
