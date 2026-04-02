import { useMemo } from 'react'
import EmptyState from '../ui/EmptyState'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'
import { STATUS_COLORS, PRIORITY_CONFIG } from '../../lib/constants'

const ROW_HEIGHT = 52
const DAY_WIDTH = 44

export default function GanttView({ filteredTasks }) {
  const { state, openTask } = useApp()
  const allTasks = filteredTasks || state.tasks

  const { tasks, startDate, totalDays } = useMemo(() => {
    const tasksWithDates = allTasks.filter(t => t.due_date)
    if (tasksWithDates.length === 0) {
      return { tasks: [], startDate: new Date(), totalDays: 30 }
    }

    const dates = tasksWithDates.map(t => new Date(t.due_date + 'T00:00:00'))
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))

    min.setDate(min.getDate() - 5)
    max.setDate(max.getDate() + 10)

    const total = Math.max(Math.ceil((max - min) / (1000 * 60 * 60 * 24)), 21)

    return { tasks: tasksWithDates, startDate: min, totalDays: total }
  }, [allTasks])

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
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="flex min-h-full">
        {/* Task names column — sticky left */}
        <div className="w-[300px] shrink-0 border-r border-border bg-background sticky left-0 z-20">
          <div className="border-b border-border px-4 flex items-end pb-2" style={{ height: 56 }}>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarea</span>
          </div>
          {tasks.map((task, idx) => {
            const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium
            const statusColor = state.boardStatuses?.find(s => s.name === task.status)?.color
            return (
              <button
                key={task.id}
                onClick={() => openTask(task)}
                className={cn(
                  'w-full px-4 flex items-center gap-3 border-b border-border hover:bg-accent/50 transition-colors',
                  idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
                style={{ height: ROW_HEIGHT }}
              >
                {statusColor && (
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusColor }} />
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm text-foreground truncate">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(task.due_date + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                    {task.assignee_name && <span> · {task.assignee_name}</span>}
                  </p>
                </div>
                <span className={cn(
                  'px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0',
                  priority.color, priority.text
                )}>
                  {priority.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Timeline */}
        <div className="flex-1 min-w-0">
          <div style={{ width: totalDays * DAY_WIDTH }}>
            {/* Header */}
            <div className="flex border-b border-border relative" style={{ height: 56 }}>
              {headerDays.map((d, i) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                const isFirst = i === 0 || d.getDate() === 1
                const isToday = i === todayOffset
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-col items-center justify-end pb-1.5 border-r border-border/50',
                      isWeekend && 'bg-muted/40'
                    )}
                    style={{ width: DAY_WIDTH }}
                  >
                    {isFirst && (
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">
                        {d.toLocaleDateString('es', { month: 'short' })}
                      </span>
                    )}
                    <span className={cn(
                      'text-[11px] w-7 h-7 flex items-center justify-center rounded-full font-medium',
                      isToday && 'bg-primary text-primary-foreground font-bold',
                      !isToday && isWeekend && 'text-muted-foreground/60',
                      !isToday && !isWeekend && 'text-muted-foreground'
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
                  style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                />
              )}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Weekend columns background */}
              {headerDays.map((d, i) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                if (!isWeekend) return null
                return (
                  <div
                    key={`wk-${i}`}
                    className="absolute top-0 bottom-0 bg-muted/30"
                    style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                  />
                )
              })}

              {/* Today line extended */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary/25 z-[1]"
                  style={{ left: todayOffset * DAY_WIDTH + DAY_WIDTH / 2 }}
                />
              )}

              {tasks.map((task, idx) => {
                const offset = getDayOffset(task.due_date)
                const barDays = 4
                const barWidth = DAY_WIDTH * barDays
                const barLeft = Math.max(0, (offset - barDays + 1) * DAY_WIDTH)
                const statusColor = state.boardStatuses?.find(s => s.name === task.status)?.color || '#9ca3af'

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'relative border-b border-border/50',
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'
                    )}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <button
                      onClick={() => openTask(task)}
                      className="absolute flex items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-medium text-white truncate transition-all hover:brightness-110 hover:shadow-md z-[2] group"
                      style={{
                        left: barLeft,
                        width: barWidth,
                        top: 10,
                        height: ROW_HEIGHT - 20,
                        backgroundColor: statusColor,
                      }}
                    >
                      <span className="truncate">{task.title}</span>
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
