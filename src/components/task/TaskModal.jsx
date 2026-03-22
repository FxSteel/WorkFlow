import React, { useState, useEffect, useMemo } from 'react'
import { X, Calendar, User, Flag, Tag, AlignLeft, Layers, Paperclip, ChevronDown, Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import DatePicker from '../ui/DatePicker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { cn } from '../../lib/utils'
import { STATUS_OPTIONS, STATUS_COLORS, PRIORITY_OPTIONS } from '../../lib/constants'
import { toast } from 'sonner'

export default function TaskModal() {
  const { state, closeTaskModal } = useApp()
  const { user } = useAuth()
  const { updateTask, createTask } = useSupabase()
  const task = state.selectedTask

  // Build assignable people list: current user + workspace members (deduplicated)
  // Always use member.id (members table PK) for assignee_id
  // Current user should be in members list as admin
  const assignableUsers = useMemo(() => {
    return state.members.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar_url || (m.user_id === user?.id ? user?.user_metadata?.avatar_url : null),
      color: m.color || '#6c5ce7',
    }))
  }, [user, state.members])

  const isNew = !task?.id
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'Por hacer',
    priority: 'medium',
    assignee_id: null,
    assignee_name: '',
    due_date: '',
    sprint_id: null,
    tags: '',
  })

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'Por hacer',
        priority: task.priority || 'medium',
        assignee_id: task.assignee_id || null,
        assignee_name: task.assignee_name || '',
        due_date: task.due_date || '',
        sprint_id: task.sprint_id || null,
        tags: task.tags || '',
      })
    }
  }, [task])

  if (!state.isTaskModalOpen) return null

  const handleSave = async () => {
    if (!form.title.trim()) return
    const payload = {
      ...form,
      assignee_id: form.assignee_id || null,
      sprint_id: form.sprint_id || null,
      due_date: form.due_date || null,
    }
    if (isNew) {
      await createTask({
        ...payload,
        board_id: state.currentBoard.id,
        position: state.tasks.length,
      })
      toast.success('Tarea creada')
    } else {
      await updateTask(task.id, payload)
      toast.success('Cambios guardados')
    }
    closeTaskModal()
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={closeTaskModal}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl bg-card rounded-xl shadow-2xl border border-border animate-scale-in max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground">
            {isNew ? 'Nueva tarea' : 'Editar tarea'}
          </h2>
          <button
            onClick={closeTaskModal}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Title */}
          <div>
            <input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Título de la tarea"
              className="w-full text-xl font-semibold bg-transparent text-foreground border-0 focus:outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Tag className="w-3.5 h-3.5" />
                Estado
              </label>
              <Select value={form.status} onValueChange={(val) => handleChange('status', val)}>
                <SelectTrigger>
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium text-white', STATUS_COLORS[form.status])}>
                    {form.status}
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
            </div>

            {/* Priority */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Flag className="w-3.5 h-3.5" />
                Prioridad
              </label>
              <Select value={form.priority} onValueChange={(val) => handleChange('priority', val)}>
                <SelectTrigger>
                  <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', PRIORITY_OPTIONS.find(p=>p.value===form.priority)?.color, form.priority === 'medium' ? 'text-black' : 'text-white')}>
                    {PRIORITY_OPTIONS.find(p=>p.value===form.priority)?.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', p.color, p.value === 'medium' ? 'text-black' : 'text-white')}>{p.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignee */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <User className="w-3.5 h-3.5" />
                Responsable
              </label>
              <AssigneePicker
                value={form.assignee_id}
                valueName={form.assignee_name}
                users={assignableUsers}
                onChange={(id, name) => {
                  handleChange('assignee_id', id)
                  handleChange('assignee_name', name)
                }}
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fecha límite
              </label>
              <DatePicker
                value={form.due_date}
                onChange={(val) => handleChange('due_date', val)}
              />
            </div>

            {/* Sprint */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Layers className="w-3.5 h-3.5" />
                Sprint
              </label>
              <Select
                value={form.sprint_id || '_backlog'}
                onValueChange={(val) => handleChange('sprint_id', val === '_backlog' ? null : val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Backlog" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_backlog">Backlog</SelectItem>
                  {state.sprints.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Paperclip className="w-3.5 h-3.5" />
                Etiquetas
              </label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => handleChange('tags', e.target.value)}
                placeholder="frontend, bug, urgente..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
              <AlignLeft className="w-3.5 h-3.5" />
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe la tarea en detalle..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <button
            onClick={closeTaskModal}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            {isNew ? 'Crear tarea' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AssigneePicker({ value, valueName, users, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = React.useRef(null)

  React.useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selectedUser = users.find(u => u.id === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
      >
        {selectedUser ? (
          <>
            {selectedUser.avatar ? (
              <img src={selectedUser.avatar} alt="" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                style={{ backgroundColor: selectedUser.color }}
              >
                {selectedUser.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="truncate flex-1 text-left">{selectedUser.name}</span>
          </>
        ) : (
          <>
            <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/40 shrink-0" />
            <span className="truncate flex-1 text-left text-muted-foreground">Sin asignar</span>
          </>
        )}
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-border bg-popover shadow-lg py-1 animate-scale-in max-h-56 overflow-y-auto">
          {/* Unassign option */}
          <button
            onClick={() => { onChange(null, ''); setOpen(false) }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
              !value ? 'bg-accent' : 'hover:bg-accent/50'
            )}
          >
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/40 shrink-0" />
            <span className="flex-1 text-left text-foreground">Sin asignar</span>
            {!value && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
          </button>

          {users.length > 0 && <div className="h-px bg-border my-1" />}

          {users.map(u => (
            <button
              key={u.id}
              onClick={() => { onChange(u.id, u.name); setOpen(false) }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
                value === u.id ? 'bg-accent' : 'hover:bg-accent/50'
              )}
            >
              {u.avatar ? (
                <img src={u.avatar} alt="" className="w-6 h-6 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm text-foreground truncate">{u.name}</p>
                {u.email && <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>}
              </div>
              {value === u.id && <Check className="w-3.5 h-3.5 text-foreground shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
