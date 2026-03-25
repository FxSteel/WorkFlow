import { useMemo } from 'react'
import EmptyState from '../ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'
import { STATUS_COLORS } from '../../lib/constants'

export default function GanttView() {
  const { state, openTask } = useApp()

  const { tasks, startDate, totalDays, dayWidth } = useMemo(() => {
    const tasksWithDates = state.tasks.filter(t => t.due_date)
    if (tasksWithDates.length === 0) {
      return { tasks: [], startDate: new Date(), totalDays: 30, dayWidth: 40 }
    }

    const dates = tasksWithDates.map(t => new Date(t.due_date + 'T00:00:00'))
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))

    min.setDate(min.getDate() - 3)
    max.setDate(max.getDate() + 7)

    const total = Math.max(Math.ceil((max - min) / (1000 * 60 * 60 * 24)), 14)

    return { tasks: tasksWithDates, startDate: min, totalDays: total, dayWidth: 40 }
  }, [state.tasks])

  const getDayOffset = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    return Math.floor((date - startDate) / (1000 * 60 * 60 * 24))
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayOffset = Math.floor((today - startDate) / (1000 * 60 * 60 * 24))

  const headerDays = Array.from({ length: totalDays }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    return d
  })

  if (tasks.length === 0) {
    return <EmptyState title="Sin datos para el Gantt" description="Asigna fechas a tus tareas para ver el diagrama de Gantt." />
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="flex">
        {/* Task names column */}
        <div className="w-[250px] shrink-0 border-r border-border">
          <div className="h-14 border-b border-border px-3 flex items-end pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Tarea</span>
          </div>
          {tasks.map(task => (
            <button
              key={task.id}
              onClick={() => openTask(task)}
              className="w-full h-10 px-3 flex items-center border-b border-border hover:bg-accent/50 transition-colors"
            >
              <span className="text-sm text-foreground truncate">{task.title}</span>
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="overflow-x-auto flex-1">
          <div style={{ width: totalDays * dayWidth }}>
            {/* Header */}
            <div className="h-14 flex border-b border-border relative">
              {headerDays.map((d, i) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                const isFirst = i === 0 || d.getDate() === 1
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-col items-center justify-end pb-1 border-r border-border',
                      isWeekend && 'bg-muted/30'
                    )}
                    style={{ width: dayWidth }}
                  >
                    {isFirst && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {d.toLocaleDateString('es', { month: 'short' })}
                      </span>
                    )}
                    <span className={cn(
                      'text-[11px] w-6 h-6 flex items-center justify-center rounded-full',
                      i === todayOffset && 'bg-primary text-primary-foreground font-bold',
                      i !== todayOffset && 'text-muted-foreground'
                    )}>
                      {d.getDate()}
                    </span>
                  </div>
                )
              })}

              {/* Today line */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                  style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                />
              )}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Today line extended */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary/30 z-0"
                  style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                />
              )}

              {tasks.map(task => {
                const offset = getDayOffset(task.due_date)
                const barWidth = Math.max(dayWidth * 3, dayWidth)
                const barLeft = Math.max(0, (offset - 2) * dayWidth)

                return (
                  <div key={task.id} className="h-10 relative border-b border-border">
                    <button
                      onClick={() => openTask(task)}
                      className={cn(
                        'absolute top-1.5 h-7 rounded-md flex items-center px-2 text-[10px] font-medium text-white truncate transition-opacity hover:opacity-80',
                        STATUS_COLORS[task.status] || 'bg-gray-400'
                      )}
                      style={{ left: barLeft, width: barWidth }}
                    >
                      {task.title}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
