import { useState, useEffect } from 'react'
import { X, Calendar, User, Flag, Tag, AlignLeft, Layers, Paperclip } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import DatePicker from '../ui/DatePicker'
import { cn } from '../../lib/utils'

const STATUS_OPTIONS = ['Por hacer', 'En progreso', 'En revisión', 'Completado', 'Bloqueado']
const STATUS_COLORS = {
  'Por hacer': 'bg-gray-400',
  'En progreso': 'bg-blue-500',
  'En revisión': 'bg-yellow-500',
  'Completado': 'bg-emerald-500',
  'Bloqueado': 'bg-red-500',
}

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Crítica', color: 'bg-red-500' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-500' },
  { value: 'low', label: 'Baja', color: 'bg-blue-500' },
]

export default function TaskModal() {
  const { state, closeTaskModal } = useApp()
  const { updateTask, createTask } = useSupabase()
  const task = state.selectedTask

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
    if (isNew) {
      await createTask({
        ...form,
        board_id: state.currentBoard.id,
        position: state.tasks.length,
      })
    } else {
      await updateTask(task.id, form)
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
              <select
                value={form.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <Flag className="w-3.5 h-3.5" />
                Prioridad
              </label>
              <select
                value={form.priority}
                onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1.5">
                <User className="w-3.5 h-3.5" />
                Responsable
              </label>
              <select
                value={form.assignee_id || ''}
                onChange={(e) => {
                  const member = state.members.find(m => m.id === e.target.value)
                  handleChange('assignee_id', e.target.value || null)
                  handleChange('assignee_name', member?.name || '')
                }}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sin asignar</option>
                {state.members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
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
              <select
                value={form.sprint_id || ''}
                onChange={(e) => handleChange('sprint_id', e.target.value || null)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Backlog</option>
                {state.sprints.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
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
