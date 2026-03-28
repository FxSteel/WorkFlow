import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import { cn } from '../../lib/utils'
import { STATUS_COLORS } from '../../lib/constants'
import { toast } from 'sonner'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function CalendarView({ filteredTasks }) {
  const { state, openTask, dispatch } = useApp()
  const { user } = useAuth()
  const tasks = filteredTasks || tasks
  const { updateTask, logTaskActivity } = useSupabase()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [draggedTask, setDraggedTask] = useState(null)
  const [dragOverDate, setDragOverDate] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    let startDay = firstDay.getDay() - 1
    if (startDay < 0) startDay = 6

    const days = []

    // Previous month padding
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({ date: d, isCurrentMonth: false })
    }

    // Current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Next month padding
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }

    return days
  }, [year, month])

  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (task.due_date) {
        const key = task.due_date
        if (!map[key]) map[key] = []
        map[key].push(task)
      }
    })
    return map
  }, [tasks])

  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))
  const goToday = () => setCurrentDate(new Date())

  const formatDateKey = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // Drag & Drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
    // Make the drag image slightly transparent
    if (e.target) {
      e.target.style.opacity = '0.5'
      setTimeout(() => { if (e.target) e.target.style.opacity = '1' }, 0)
    }
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverDate(null)
  }

  const handleDragOver = (e, dateKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverDate !== dateKey) setDragOverDate(dateKey)
  }

  const handleDragLeave = (e, dateKey) => {
    // Only clear if actually leaving the cell (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverDate === dateKey) setDragOverDate(null)
    }
  }

  const handleDrop = async (e, dateKey) => {
    e.preventDefault()
    setDragOverDate(null)

    if (!draggedTask) return

    // Don't do anything if dropping on the same date
    if (draggedTask.due_date === dateKey) {
      setDraggedTask(null)
      return
    }

    // Optimistic update
    dispatch({ type: 'UPDATE_TASK', payload: { id: draggedTask.id, due_date: dateKey } })

    // Save to DB
    const { error } = await updateTask(draggedTask.id, { due_date: dateKey })
    if (error) {
      // Revert on error
      dispatch({ type: 'UPDATE_TASK', payload: { id: draggedTask.id, due_date: draggedTask.due_date } })
      toast.error('Error al mover la tarea')
    } else {
      toast.success('Fecha actualizada')
      logTaskActivity({
        taskId: draggedTask.id, userId: user?.id,
        userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
        userAvatar: user?.user_metadata?.avatar_url,
        action: 'due_date_changed', oldValue: draggedTask.due_date, newValue: dateKey,
      })
    }

    setDraggedTask(null)
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {MONTHS[month]} {year}
          </h2>
          <button
            onClick={goToday}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
          >
            Hoy
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAYS.map(day => (
          <div key={day} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 border-l border-border">
        {calendarDays.map((day, i) => {
          const key = formatDateKey(day.date)
          const tasks = tasksByDate[key] || []
          const isToday = key === todayKey
          const isDragOver = dragOverDate === key && draggedTask

          return (
            <div
              key={i}
              onDragOver={(e) => handleDragOver(e, key)}
              onDragLeave={(e) => handleDragLeave(e, key)}
              onDrop={(e) => handleDrop(e, key)}
              className={cn(
                'border-r border-b border-border p-1.5 min-h-[90px] transition-all',
                !day.isCurrentMonth && 'bg-muted/30',
                isToday && 'bg-primary/5',
                isDragOver && 'bg-primary/10 ring-2 ring-inset ring-primary/30'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={cn(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                  isToday && 'bg-primary text-primary-foreground',
                  !isToday && day.isCurrentMonth && 'text-foreground',
                  !isToday && !day.isCurrentMonth && 'text-muted-foreground/50',
                )}>
                  {day.date.getDate()}
                </span>
              </div>

              <div className="space-y-0.5">
                {tasks.slice(0, 3).map(task => (
                  <button
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onClick={() => openTask(task)}
                    className={cn(
                      'w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate transition-all hover:opacity-80 cursor-grab active:cursor-grabbing',
                      STATUS_COLORS[task.status] || 'bg-gray-400',
                      draggedTask?.id === task.id && 'opacity-40 scale-95'
                    )}
                  >
                    {task.title}
                  </button>
                ))}
                {tasks.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">
                    +{tasks.length - 3} más
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
