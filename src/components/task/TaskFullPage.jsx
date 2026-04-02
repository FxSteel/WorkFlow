import { useState, useEffect, useMemo } from 'react'
import {
  X, ArrowLeft, Calendar, User, Flag, Tag, AlignLeft, Layers,
  Paperclip, Clock, Trash2, Check, ChevronDown, MessageSquare,
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
import { toast } from 'sonner'
import { usePermissions } from '../../hooks/usePermissions'

export default function TaskFullPage() {
  const { state, closeTaskModal, closeSidePanel } = useApp()
  const { user } = useAuth()
  const { can } = usePermissions()
  const canEdit = can('editTask')
  const canDelete = can('deleteTask')
  const canCreate = can('createTask')
  const { updateTask, createTask, deleteTask } = useSupabase()

  // Determine which task to edit (from modal or side panel)
  const sourceTask = state.selectedTask || state.sidePanelTask
  const isNew = !sourceTask?.id

  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'Backlog',
    priority: 'medium',
    assignee_id: null,
    assignee_name: '',
    due_date: '',
    sprint_id: null,
    tags: '',
  })
  const [saved, setSaved] = useState(false)

  const assignableUsers = useMemo(() => {
    return state.orgMembers.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar_url || (m.user_id === user?.id ? user?.user_metadata?.avatar_url : null),
      color: m.color || '#6c5ce7',
    }))
  }, [user, state.orgMembers])

  useEffect(() => {
    if (sourceTask) {
      setForm({
        title: sourceTask.title || '',
        description: sourceTask.description || '',
        status: sourceTask.status || 'Por hacer',
        priority: sourceTask.priority || 'medium',
        assignee_id: sourceTask.assignee_id || null,
        assignee_name: sourceTask.assignee_name || '',
        due_date: sourceTask.due_date || '',
        sprint_id: sourceTask.sprint_id || null,
        tags: sourceTask.tags || '',
      })
    }
  }, [sourceTask])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Auto-save on field change for existing tasks
  const handleFieldSave = async (field, value) => {
    handleChange(field, value)
    if (!isNew && sourceTask?.id && canEdit) {
      await updateTask(sourceTask.id, { [field]: value || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const handleTitleBlur = async () => {
    if (!isNew && sourceTask?.id && canEdit && form.title.trim()) {
      await updateTask(sourceTask.id, { title: form.title.trim() })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const handleDescBlur = async () => {
    if (!isNew && sourceTask?.id && canEdit) {
      await updateTask(sourceTask.id, { description: form.description })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const handleCreate = async () => {
    if (!form.title.trim() || !canCreate) return
    await createTask({
      ...form,
      assignee_id: form.assignee_id || null,
      sprint_id: form.sprint_id || null,
      due_date: form.due_date || null,
      board_id: state.currentBoard.id,
      position: state.tasks.length,
    })
    toast.success('Tarea creada')
    handleClose()
  }

  const handleDelete = async () => {
    if (sourceTask?.id && canDelete) {
      await deleteTask(sourceTask.id)
    }
    toast.success('Tarea eliminada')
    handleClose()
  }

  const handleClose = () => {
    closeTaskModal()
    closeSidePanel()
  }

  const selectedAssignee = assignableUsers.find(u => u.id === form.assignee_id)
  const sprint = state.sprints.find(s => s.id === form.sprint_id)

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card">
        <button
          onClick={handleClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-success animate-fade-in">
              <Check className="w-3.5 h-3.5" />
              Guardado
            </span>
          )}
          {!isNew && canDelete && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {isNew && canCreate && (
            <button
              onClick={handleCreate}
              disabled={!form.title.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Crear tarea
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-10">
          {/* Title */}
          <input
            value={form.title}
            onChange={(e) => handleChange('title', e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Sin título"
            className="w-full text-4xl font-bold bg-transparent text-foreground border-0 focus:outline-none placeholder:text-muted-foreground/40 mb-6"
          />

          {/* Properties row */}
          <div className="space-y-3 mb-8 pb-8 border-b border-border">
            {/* Assignee */}
            <PropertyRow icon={User} label="Responsable">
              {selectedAssignee ? (
                <div className="flex items-center gap-2">
                  {selectedAssignee.avatar ? (
                    <img src={selectedAssignee.avatar} alt="" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: selectedAssignee.color }}
                    >
                      {selectedAssignee.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <Select
                    value={form.assignee_id || '_none'}
                    onValueChange={(val) => {
                      const member = assignableUsers.find(u => u.id === val)
                      handleFieldSave('assignee_id', val === '_none' ? null : val)
                      handleChange('assignee_name', member?.name || '')
                      if (!isNew && sourceTask?.id) {
                        updateTask(sourceTask.id, {
                          assignee_id: val === '_none' ? null : val,
                          assignee_name: member?.name || '',
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin asignar</SelectItem>
                      {assignableUsers.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Select
                  value="_none"
                  onValueChange={(val) => {
                    const member = assignableUsers.find(u => u.id === val)
                    handleFieldSave('assignee_id', val === '_none' ? null : val)
                    handleChange('assignee_name', member?.name || '')
                    if (!isNew && sourceTask?.id) {
                      updateTask(sourceTask.id, {
                        assignee_id: val === '_none' ? null : val,
                        assignee_name: member?.name || '',
                      })
                    }
                  }}
                >
                  <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm text-muted-foreground hover:bg-accent">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sin asignar</SelectItem>
                    {assignableUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </PropertyRow>

            {/* Status */}
            <PropertyRow icon={Tag} label="Estado">
              <div className="flex items-center gap-1.5 flex-wrap">
                {(state.boardStatuses || []).map(s => (
                  <button
                    key={s.id}
                    onClick={() => {
                      handleChange('status', s.name)
                      if (!isNew && sourceTask?.id) updateTask(sourceTask.id, { status: s.name })
                    }}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                      form.status === s.name
                        ? 'text-white'
                        : 'bg-muted text-muted-foreground hover:bg-accent'
                    )}
                    style={form.status === s.name ? { backgroundColor: s.color } : {}}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </PropertyRow>

            {/* Due Date */}
            <PropertyRow icon={Calendar} label="Fecha límite">
              <DatePicker
                value={form.due_date}
                onChange={(val) => handleFieldSave('due_date', val)}
                placeholder="Sin fecha"
                size="sm"
                className="border-0 bg-transparent hover:bg-accent"
              />
            </PropertyRow>

            {/* Priority */}
            <PropertyRow icon={Flag} label="Prioridad">
              <Select
                value={form.priority}
                onValueChange={(val) => handleFieldSave('priority', val)}
              >
                <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                  {(() => {
                    const p = PRIORITY_OPTIONS.find(x => x.value === form.priority)
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
            </PropertyRow>

            {/* Sprint */}
            <PropertyRow icon={Layers} label="Sprint">
              <Select
                value={form.sprint_id || '_none'}
                onValueChange={(val) => handleFieldSave('sprint_id', val === '_none' ? null : val)}
              >
                <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin asignar</SelectItem>
                  {state.sprints.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            {/* Tags */}
            <PropertyRow icon={Paperclip} label="Etiquetas">
              <input
                value={form.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                onBlur={() => { if (!isNew && sourceTask?.id) updateTask(sourceTask.id, { tags: form.tags }) }}
                placeholder="frontend, bug, urgente..."
                className="text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/50 flex-1"
              />
            </PropertyRow>
          </div>

          {/* Description */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-3">Descripción</h3>
            <BlockEditor
              value={form.description}
              onChange={(val) => {
                handleChange('description', val)
                if (!isNew && sourceTask?.id) updateTask(sourceTask.id, { description: val })
              }}
              placeholder="Agrega una descripción detallada de la tarea..."
            />
          </div>

          {/* Comments */}
          {!isNew && sourceTask?.id && (
            <TaskComments taskId={sourceTask.id} />
          )}
        </div>
      </div>
    </div>
  )
}

function PropertyRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-[32px]">
      <div className="flex items-center gap-2 w-32 shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}
