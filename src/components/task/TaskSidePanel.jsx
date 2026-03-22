import { useState, useEffect, useMemo } from 'react'
import {
  X, Calendar, User, Flag, Tag, Layers, Clock,
  Trash2, Paperclip, MoreHorizontal, Check,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import DatePicker from '../ui/DatePicker'
import BlockEditor from '../ui/BlockEditor'
import TaskComments from './TaskComments'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { cn } from '../../lib/utils'
import { STATUS_OPTIONS, STATUS_COLORS, PRIORITY_OPTIONS } from '../../lib/constants'
import { useNotifications } from '../../hooks/useNotifications'
import { toast } from 'sonner'

export default function TaskSidePanel() {
  const { state, dispatch, closeSidePanel } = useApp()
  const { user } = useAuth()
  const { notifyTaskAssigned } = useNotifications()
  const { updateTask, deleteTask, createTask } = useSupabase()
  const task = state.sidePanelTask
  const isNew = task && !task.id

  const [saved, setSaved] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const assignableUsers = useMemo(() => {
    return state.members.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar_url || (m.user_id === user?.id ? user?.user_metadata?.avatar_url : null),
      color: m.color || '#6c5ce7',
    }))
  }, [user, state.members])

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
    }
  }, [task?.id])

  if (!state.isSidePanelOpen || !task) return null

  const sprint = state.sprints.find(s => s.id === task.sprint_id)
  const assignee = assignableUsers.find(u => u.id === task.assignee_id)

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const handleFieldUpdate = async (updates) => {
    // For new tasks, update local state only
    if (isNew) {
      dispatch({ type: 'OPEN_SIDE_PANEL', payload: { ...task, ...updates } })
      return
    }
    await updateTask(task.id, updates)
    showSaved()
  }

  const handleTitleBlur = async () => {
    if (isNew || !title.trim() || title.trim() === task.title) return
    await updateTask(task.id, { title: title.trim() })
    showSaved()
  }

  const handleDescBlur = async () => {
    if (isNew || description === task.description) return
    await updateTask(task.id, { description })
    showSaved()
  }

  const handleDelete = async () => {
    if (!isNew) await deleteTask(task.id)
    toast.success('Tarea eliminada')
    closeSidePanel()
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    await createTask({
      title: title.trim(),
      description,
      status: task.status || 'Por hacer',
      priority: task.priority || 'medium',
      assignee_id: task.assignee_id || null,
      assignee_name: task.assignee_name || '',
      due_date: task.due_date || null,
      sprint_id: task.sprint_id || null,
      tags: task.tags || null,
      board_id: state.currentBoard.id,
      position: state.tasks.length,
    })
    toast.success('Tarea creada')
    closeSidePanel()
  }

  return (
    <>
    {/* Backdrop */}
    <div className="fixed inset-0 z-30" onClick={closeSidePanel} />
    <div className="fixed top-0 right-0 h-screen w-[60vw] max-w-[800px] min-w-[500px] z-40 flex flex-col bg-card border-l border-border shadow-2xl animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-success animate-fade-in">
              <Check className="w-3 h-3" />
              Guardado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={closeSidePanel}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Title */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
          placeholder="Sin título"
          className="w-full text-2xl font-bold bg-transparent text-foreground border-0 focus:outline-none placeholder:text-muted-foreground/40 mb-5"
        />

        {/* Properties */}
        <div className="space-y-1 mb-6 pb-6 border-b border-border">
          {/* Responsable */}
          <PropRow icon={User} label="Responsable">
            <Select
              value={task.assignee_id || '_none'}
              onValueChange={(val) => {
                const member = assignableUsers.find(u => u.id === val)
                handleFieldUpdate({
                  assignee_id: val === '_none' ? null : val,
                  assignee_name: member?.name || '',
                })
                if (val !== '_none' && member) {
                  const dbMember = state.members.find(m => m.id === val)
                  notifyTaskAssigned({ task, assigneeMember: dbMember, fromUser: user, workspaceId: state.currentWorkspace?.id })
                }
              }}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto min-w-[120px]">
                <div className="flex items-center gap-2">
                  {assignee ? (
                    <>
                      {assignee.avatar ? (
                        <img src={assignee.avatar} alt="" className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: assignee.color }}>
                          {assignee.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <span>{assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Vacío</span>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin asignar</SelectItem>
                {assignableUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Estado */}
          <PropRow icon={Tag} label="Estado">
            <Select
              value={task.status || 'Por hacer'}
              onValueChange={(val) => handleFieldUpdate({ status: val })}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium text-white', STATUS_COLORS[task.status])}>
                  {task.status}
                </span>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium text-white', STATUS_COLORS[s])}>{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Fecha limite */}
          <PropRow icon={Calendar} label="Fecha límite">
            <DatePicker
              value={task.due_date || ''}
              onChange={(val) => handleFieldUpdate({ due_date: val || null })}
              placeholder="Vacío"
              size="sm"
              className="border-0 bg-transparent hover:bg-accent"
            />
          </PropRow>

          {/* Prioridad */}
          <PropRow icon={Flag} label="Prioridad">
            <Select
              value={task.priority || 'medium'}
              onValueChange={(val) => handleFieldUpdate({ priority: val })}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                {(() => {
                  const p = PRIORITY_OPTIONS.find(x => x.value === (task.priority || 'medium'))
                  return <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', p?.color, p?.value === 'medium' ? 'text-black' : 'text-white')}>{p?.label}</span>
                })()}
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', p.color, p.value === 'medium' ? 'text-black' : 'text-white')}>{p.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Sprint */}
          <PropRow icon={Layers} label="Sprint">
            <Select
              value={task.sprint_id || '_backlog'}
              onValueChange={(val) => handleFieldUpdate({ sprint_id: val === '_backlog' ? null : val })}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                <SelectValue placeholder="Backlog" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_backlog">Backlog</SelectItem>
                {state.sprints.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Etiquetas */}
          <PropRow icon={Paperclip} label="Etiquetas">
            <input
              defaultValue={task.tags || ''}
              onBlur={(e) => handleFieldUpdate({ tags: e.target.value })}
              placeholder="frontend, bug..."
              className="text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/50 flex-1 hover:bg-accent/30 rounded px-1 transition-colors"
            />
          </PropRow>

          {task.created_at && (
            <PropRow icon={Clock} label="Creada">
              <span className="text-sm text-muted-foreground px-1">
                {new Date(task.created_at).toLocaleDateString('es', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </PropRow>
          )}
        </div>

        {/* Comments */}
        {!isNew && (
          <div className="mb-6 pb-6 border-b border-border">
            <TaskComments taskId={task.id} />
          </div>
        )}

        {/* Description */}
        <div>
          <h4 className="text-lg font-semibold text-foreground mb-3">Descripción de la tarea</h4>
          <BlockEditor
            value={task.description || ''}
            onChange={(val) => {
              setDescription(val)
              if (!isNew && task.id) updateTask(task.id, { description: val })
            }}
            placeholder="Proporciona un resumen general de la tarea..."
          />
        </div>
      </div>

      {/* Footer for new tasks */}
      {isNew && (
        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Crear tarea
          </button>
        </div>
      )}
    </div>
    </>
  )
}

function PropRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-[36px] hover:bg-accent/20 rounded-lg px-1 -mx-1 transition-colors">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
