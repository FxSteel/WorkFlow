import { useState, useEffect } from 'react'
import {
  Clock, User, Tag, Flag, Calendar, Layers, Plus, Pencil,
  UserPlus, CheckCircle, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'

const ACTION_CONFIG = {
  created:            { icon: Plus, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'creó esta tarea' },
  status_changed:     { icon: Tag, color: 'text-sky-500', bg: 'bg-sky-500/10', label: 'cambió el estado' },
  assignee_changed:   { icon: User, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'cambió el responsable' },
  priority_changed:   { icon: Flag, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'cambió la prioridad' },
  due_date_changed:   { icon: Calendar, color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'cambió la fecha límite' },
  sprint_changed:     { icon: Layers, color: 'text-violet-500', bg: 'bg-violet-500/10', label: 'cambió el sprint' },
  title_changed:      { icon: Pencil, color: 'text-muted-foreground', bg: 'bg-muted', label: 'cambió el título' },
  subtask_added:      { icon: Plus, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'agregó una subtarea' },
  subtask_completed:  { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10', label: 'completó una subtarea' },
  subtask_deleted:    { icon: Trash2, color: 'text-destructive', bg: 'bg-destructive/10', label: 'eliminó una subtarea' },
}

const PRIORITY_LABELS = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' }

function formatValue(action, value) {
  if (!value) return 'vacío'
  if (action === 'priority_changed') return PRIORITY_LABELS[value] || value
  if (action === 'due_date_changed') {
    try {
      return new Date(value + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch { return value }
  }
  return value
}

function timeAgo(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diff = Math.floor((now - date) / 1000)
  if (diff < 60) return 'Ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export default function TaskActivity({ taskId }) {
  const { fetchTaskActivity } = useSupabase()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!taskId) return
    setLoading(true)
    fetchTaskActivity(taskId).then(({ data }) => {
      setActivities(data || [])
      setLoading(false)
    })
  }, [taskId])

  if (loading) return null

  const shown = expanded ? activities : activities.slice(0, 5)

  return (
    <div>
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
      >
        <Clock className="w-3.5 h-3.5" />
        Actividad ({activities.length})
        {activities.length > 5 && (
          expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {activities.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin actividad registrada.</p>
      ) : (
        <div className="relative ml-3 border-l-2 border-border pl-4 space-y-3">
          {shown.map(act => {
            const config = ACTION_CONFIG[act.action] || ACTION_CONFIG.created
            const Icon = config.icon
            return (
              <div key={act.id} className="relative flex items-start gap-2.5 text-xs">
                {/* Timeline dot */}
                <div className={cn('absolute -left-[23px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-card', config.bg)}>
                  <Icon className={cn('w-2.5 h-2.5', config.color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-foreground leading-relaxed">
                    <span className="font-medium">{act.user_name}</span>
                    {' '}{config.label}
                    {act.old_value && act.new_value && (
                      <span className="text-muted-foreground">
                        {' '}de <span className="line-through">{formatValue(act.action, act.old_value)}</span>
                        {' '}a <span className="font-medium text-foreground">{formatValue(act.action, act.new_value)}</span>
                      </span>
                    )}
                    {!act.old_value && act.new_value && act.action !== 'created' && (
                      <span className="text-muted-foreground">
                        {' '}→ <span className="font-medium text-foreground">{formatValue(act.action, act.new_value)}</span>
                      </span>
                    )}
                  </p>
                  <span className="text-muted-foreground text-[10px]">{timeAgo(act.created_at)}</span>
                </div>
              </div>
            )
          })}

          {activities.length > 5 && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Ver {activities.length - 5} más
            </button>
          )}
        </div>
      )}
    </div>
  )
}
