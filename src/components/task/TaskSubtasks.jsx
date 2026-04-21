import { useState, useEffect } from 'react'
import { Plus, CheckCircle2, Circle, Trash2, GripVertical, User } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import { usePermissions } from '../../hooks/usePermissions'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

export default function TaskSubtasks({ taskId, boardId, onActivity }) {
  const { state, openTask } = useApp()
  const { user } = useAuth()
  const { can } = usePermissions()
  const canEdit = can('editTask')
  const canCreate = can('createTask')
  const canDelete = can('deleteTask')
  const { fetchSubtasks, createSubtask, updateSubtask, deleteSubtask } = useSupabase()
  const [subtasks, setSubtasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const loadSubtasks = async () => {
    const { data } = await fetchSubtasks(taskId)
    setSubtasks(data || [])
    setLoading(false)
  }

  useEffect(() => {
    if (taskId) loadSubtasks()
  }, [taskId])

  const completedCount = subtasks.filter(s => s.status === 'Completado').length
  const progress = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0

  const handleCreate = async () => {
    if (!newTitle.trim() || !canCreate) return
    const { data, error } = await createSubtask({
      title: newTitle.trim(),
      status: 'Backlog',
      priority: 'medium',
      board_id: boardId,
      parent_task_id: taskId,
      position: subtasks.length,
      assignee_id: null,
      assignee_name: '',
    })
    if (!error && data) {
      setSubtasks(prev => [...prev, data])
      setNewTitle('')
      setAdding(false)
      onActivity?.('subtask_added', null, newTitle.trim())
      toast.success('Subtarea creada')
    }
  }

  const toggleComplete = async (sub) => {
    if (!canEdit) return
    const isCompleting = sub.status !== 'Completado'
    const newStatus = isCompleting ? 'Completado' : 'Backlog'
    const { data } = await updateSubtask(sub.id, { status: newStatus })
    if (data) {
      setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, status: newStatus } : s))
      if (isCompleting) {
        onActivity?.('subtask_completed', null, sub.title)
      }
    }
  }

  const handleDelete = async (sub) => {
    if (!canDelete) return
    await deleteSubtask(sub.id)
    setSubtasks(prev => prev.filter(s => s.id !== sub.id))
    onActivity?.('subtask_deleted', null, sub.title)
    toast.success('Subtarea eliminada')
  }

  const assignableUsers = state.orgMembers.map(m => ({
    id: m.id,
    name: m.name,
    avatar: m.avatar_url,
    color: m.color || '#6c5ce7',
  }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Subtareas
          </span>
          {subtasks.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {completedCount}/{subtasks.length}
            </span>
          )}
        </div>
        {!adding && canCreate && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <Plus className="w-3 h-3" />
            Agregar
          </button>
        )}
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-0.5">
        {subtasks.map(sub => {
          const isDone = sub.status === 'Completado'
          const assignee = assignableUsers.find(u => u.id === sub.assignee_id)
          return (
            <div
              key={sub.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent/30 group transition-colors"
            >
              <button
                onClick={() => toggleComplete(sub)}
                className="shrink-0"
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/50 hover:text-muted-foreground" />
                )}
              </button>

              <button
                onClick={() => openTask(sub)}
                className={cn(
                  'flex-1 text-xs text-left truncate transition-colors',
                  isDone ? 'text-muted-foreground line-through' : 'text-foreground hover:text-primary'
                )}
              >
                {sub.title}
              </button>

              {assignee && (
                assignee.avatar ? (
                  <img src={assignee.avatar} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                    style={{ backgroundColor: assignee.color }}
                  >
                    {assignee.name[0]?.toUpperCase()}
                  </div>
                )
              )}

              {canDelete && (
                <button
                  onClick={() => handleDelete(sub)}
                  className="p-0.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Add subtask inline */}
      {adding && (
        <div className="flex items-center gap-2 mt-1 px-2">
          <Circle className="w-4 h-4 text-muted-foreground/30 shrink-0" />
          <input
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') { setAdding(false); setNewTitle('') }
            }}
            placeholder="Título de la subtarea..."
            className="flex-1 text-xs bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none py-1.5"
          />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim()}
            className="text-[10px] font-medium text-primary hover:text-primary/80 disabled:opacity-30 transition-colors"
          >
            Crear
          </button>
          <button
            onClick={() => { setAdding(false); setNewTitle('') }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {!loading && subtasks.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground px-2">Sin subtareas.</p>
      )}
    </div>
  )
}
