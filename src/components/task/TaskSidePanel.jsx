import { useState, useEffect } from 'react'
import {
  X, Calendar, User, Flag, Tag, AlignLeft, Layers, Clock,
  MessageSquare, Edit3, Trash2, ChevronRight, Paperclip, CheckCircle2,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'

const STATUS_OPTIONS = ['Por hacer', 'En progreso', 'En revisión', 'Completado', 'Bloqueado']
const STATUS_COLORS = {
  'Por hacer': 'bg-gray-400',
  'En progreso': 'bg-blue-500',
  'En revisión': 'bg-yellow-500',
  'Completado': 'bg-emerald-500',
  'Bloqueado': 'bg-red-500',
}

const PRIORITY_CONFIG = {
  critical: { label: 'Crítica', color: 'bg-red-500', icon: '🔴' },
  high: { label: 'Alta', color: 'bg-orange-500', icon: '🟠' },
  medium: { label: 'Media', color: 'bg-yellow-500', icon: '🟡' },
  low: { label: 'Baja', color: 'bg-blue-500', icon: '🔵' },
}

export default function TaskSidePanel() {
  const { state, closeSidePanel, openTaskModal } = useApp()
  const { updateTask, deleteTask } = useSupabase()
  const task = state.sidePanelTask

  const [newComment, setNewComment] = useState('')
  const [activeTab, setActiveTab] = useState('details')

  if (!state.isSidePanelOpen || !task) return null

  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
  const sprint = state.sprints.find(s => s.id === task.sprint_id)

  const handleStatusChange = async (status) => {
    await updateTask(task.id, { status })
  }

  const handleEdit = () => {
    openTaskModal(task)
    closeSidePanel()
  }

  const handleDelete = async () => {
    await deleteTask(task.id)
    closeSidePanel()
  }

  const tags = task.tags ? task.tags.split(',').map(t => t.trim()).filter(Boolean) : []

  return (
    <div className="fixed top-0 right-0 h-screen w-[420px] z-40 flex flex-col bg-card border-l border-border shadow-2xl animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Detalle de tarea</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleEdit}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={closeSidePanel}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Title Section */}
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground mb-2">{task.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium text-white',
              STATUS_COLORS[task.status]
            )}>
              {task.status}
            </span>
            <span className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              priorityConfig.color,
              task.priority === 'medium' ? 'text-black' : 'text-white'
            )}>
              {priorityConfig.label}
            </span>
            {tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {[
            { id: 'details', label: 'Detalles' },
            { id: 'activity', label: 'Actividad' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 px-4 py-2.5 text-xs font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'details' && (
          <div className="px-5 py-4 space-y-4">
            {/* Info rows */}
            <DetailRow
              icon={User}
              label="Responsable"
              value={
                task.assignee_name ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary">
                      {task.assignee_name[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm">{task.assignee_name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Sin asignar</span>
                )
              }
            />

            <DetailRow
              icon={Tag}
              label="Estado"
              value={
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map(status => (
                    <button
                      key={status}
                      onClick={() => handleStatusChange(status)}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[11px] font-medium transition-all',
                        task.status === status
                          ? cn(STATUS_COLORS[status], 'text-white')
                          : 'bg-muted text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              }
            />

            <DetailRow
              icon={Flag}
              label="Prioridad"
              value={
                <span className={cn(
                  'px-2.5 py-0.5 rounded text-xs font-medium',
                  priorityConfig.color,
                  task.priority === 'medium' ? 'text-black' : 'text-white'
                )}>
                  {priorityConfig.label}
                </span>
              }
            />

            <DetailRow
              icon={Calendar}
              label="Fecha límite"
              value={
                <span className="text-sm">
                  {task.due_date
                    ? new Date(task.due_date).toLocaleDateString('es', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : <span className="text-muted-foreground">Sin fecha</span>
                  }
                </span>
              }
            />

            <DetailRow
              icon={Layers}
              label="Sprint"
              value={
                <span className="text-sm">
                  {sprint ? sprint.name : <span className="text-muted-foreground">Backlog</span>}
                </span>
              }
            />

            {task.created_at && (
              <DetailRow
                icon={Clock}
                label="Creada"
                value={
                  <span className="text-sm text-muted-foreground">
                    {new Date(task.created_at).toLocaleDateString('es', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                }
              />
            )}

            {/* Description */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-2">
                <AlignLeft className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Descripción</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 min-h-[80px]">
                {task.description ? (
                  <p className="text-sm text-card-foreground whitespace-pre-wrap">{task.description}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sin descripción</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="px-5 py-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                La actividad y comentarios se mostrarán aquí
              </p>
            </div>

            {/* Comment input */}
            <div className="mt-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
              />
              <button
                disabled={!newComment.trim()}
                className="mt-2 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Comentar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex items-center gap-2 w-28 shrink-0 pt-0.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1">{value}</div>
    </div>
  )
}
