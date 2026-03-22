import { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { cn } from '../../lib/utils'
import { STATUS_COLORS } from '../../lib/constants'

export default function CronogramaView() {
  const { state, openTask } = useApp()

  const weeks = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - start.getDay() + 1) // Monday

    const result = []
    for (let w = -1; w < 5; w++) {
      const weekStart = new Date(start)
      weekStart.setDate(weekStart.getDate() + w * 7)
      const days = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(weekStart)
        day.setDate(day.getDate() + d)
        days.push(day)
      }
      result.push({ start: weekStart, days })
    }
    return result
  }, [])

  const formatDateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const todayKey = formatDateKey(new Date())

  const tasksByDate = useMemo(() => {
    const map = {}
    state.tasks.forEach(t => {
      if (t.due_date) {
        if (!map[t.due_date]) map[t.due_date] = []
        map[t.due_date].push(t)
      }
    })
    return map
  }, [state.tasks])

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="space-y-4">
        {weeks.map((week, wi) => {
          const weekLabel = `${week.days[0].toLocaleDateString('es', { day: 'numeric', month: 'short' })} — ${week.days[6].toLocaleDateString('es', { day: 'numeric', month: 'short' })}`
          const isCurrentWeek = week.days.some(d => formatDateKey(d) === todayKey)

          return (
            <div key={wi}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className={cn(
                  'text-xs font-semibold uppercase tracking-wider',
                  isCurrentWeek ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {isCurrentWeek ? 'Esta semana' : weekLabel}
                </h3>
                {isCurrentWeek && (
                  <span className="text-[10px] text-muted-foreground">{weekLabel}</span>
                )}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {week.days.map((day, di) => {
                  const key = formatDateKey(day)
                  const tasks = tasksByDate[key] || []
                  const isToday = key === todayKey
                  const isWeekend = di >= 5

                  return (
                    <div
                      key={di}
                      className={cn(
                        'rounded-lg border border-border p-2 min-h-[80px]',
                        isToday && 'border-primary bg-primary/5',
                        isWeekend && !isToday && 'bg-muted/30',
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn(
                          'text-[10px] font-medium',
                          isToday ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][di]}
                        </span>
                        <span className={cn(
                          'text-[11px] w-5 h-5 flex items-center justify-center rounded-full',
                          isToday && 'bg-primary text-primary-foreground font-bold',
                          !isToday && 'text-muted-foreground'
                        )}>
                          {day.getDate()}
                        </span>
                      </div>
                      <div className="space-y-0.5">
                        {tasks.map(task => (
                          <button
                            key={task.id}
                            onClick={() => openTask(task)}
                            className={cn(
                              'w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate hover:opacity-80 transition-opacity',
                              STATUS_COLORS[task.status]
                            )}
                          >
                            {task.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
