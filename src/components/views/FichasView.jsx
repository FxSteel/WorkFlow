import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'

const STATUS_COLORS = {
  'Por hacer': 'bg-gray-400',
  'En progreso': 'bg-blue-500',
  'En revisión': 'bg-yellow-500',
  'Completado': 'bg-emerald-500',
  'Bloqueado': 'bg-red-500',
}

const PRIORITY_CONFIG = {
  critical: { label: 'Crítica', color: 'bg-red-500', text: 'text-white' },
  high: { label: 'Alta', color: 'bg-orange-500', text: 'text-white' },
  medium: { label: 'Media', color: 'bg-yellow-500', text: 'text-black' },
  low: { label: 'Baja', color: 'bg-blue-500', text: 'text-white' },
}

export default function FichasView() {
  const { state, openTask, openTaskModal } = useApp()

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {state.tasks.map(task => {
          const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
          const sprint = state.sprints.find(s => s.id === task.sprint_id)
          return (
            <div
              key={task.id}
              onClick={() => openTask(task)}
              className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all group"
            >
              {/* Status bar */}
              <div className="flex items-center justify-between mb-3">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium text-white',
                  STATUS_COLORS[task.status]
                )}>
                  {task.status}
                </span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[10px] font-medium',
                  priority.color, priority.text
                )}>
                  {priority.label}
                </span>
              </div>

              {/* Title */}
              <h4 className="text-sm font-semibold text-foreground mb-2 line-clamp-2">{task.title}</h4>

              {/* Description */}
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                {task.assignee_name ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-semibold text-primary">
                      {task.assignee_name[0]?.toUpperCase()}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{task.assignee_name}</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground">Sin asignar</span>
                )}
                {task.due_date && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(task.due_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>

              {/* Sprint tag */}
              {sprint && (
                <div className="mt-2">
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {sprint.name}
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {state.tasks.length === 0 && (
          <div className="col-span-full flex items-center justify-center py-20">
            <p className="text-sm text-muted-foreground">No hay tareas para mostrar</p>
          </div>
        )}
      </div>
    </div>
  )
}
