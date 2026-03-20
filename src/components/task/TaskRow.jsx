import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal, Eye, Edit, Trash2, GripVertical } from 'lucide-react'
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

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low']
const PRIORITY_CONFIG = {
  critical: { label: 'Crítica', color: 'bg-red-500', textColor: 'text-white' },
  high: { label: 'Alta', color: 'bg-orange-500', textColor: 'text-white' },
  medium: { label: 'Media', color: 'bg-yellow-500', textColor: 'text-black' },
  low: { label: 'Baja', color: 'bg-blue-500', textColor: 'text-white' },
}

export default function TaskRow({ task }) {
  const { state, openTaskModal, openSidePanel } = useApp()
  const { updateTask, deleteTask } = useSupabase()
  const [showMenu, setShowMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showPriorityMenu, setShowPriorityMenu] = useState(false)
  const [showAssigneeMenu, setShowAssigneeMenu] = useState(false)
  const menuRef = useRef(null)
  const statusRef = useRef(null)
  const priorityRef = useRef(null)
  const assigneeRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false)
      if (statusRef.current && !statusRef.current.contains(e.target)) setShowStatusMenu(false)
      if (priorityRef.current && !priorityRef.current.contains(e.target)) setShowPriorityMenu(false)
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setShowAssigneeMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleStatusChange = async (status) => {
    await updateTask(task.id, { status })
    setShowStatusMenu(false)
  }

  const handlePriorityChange = async (priority) => {
    await updateTask(task.id, { priority })
    setShowPriorityMenu(false)
  }

  const handleAssigneeChange = async (memberId, memberName) => {
    await updateTask(task.id, { assignee_id: memberId, assignee_name: memberName })
    setShowAssigneeMenu(false)
  }

  const handleDateChange = async (e) => {
    await updateTask(task.id, { due_date: e.target.value || null })
  }

  const handleDelete = async () => {
    await deleteTask(task.id)
    setShowMenu(false)
  }

  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium

  return (
    <div className="grid grid-cols-[minmax(300px,2fr)_120px_100px_120px_100px_80px] gap-0 border-b border-border last:border-b-0 hover:bg-accent/30 transition-colors group text-sm">
      {/* Task Name */}
      <div className="px-3 py-2.5 flex items-center gap-2 min-w-0">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 cursor-grab" />
        <button
          onClick={() => openSidePanel(task)}
          className="truncate text-foreground hover:text-primary transition-colors text-left"
        >
          {task.title}
        </button>
      </div>

      {/* Assignee */}
      <div className="px-3 py-2.5 flex items-center justify-center relative" ref={assigneeRef}>
        <button
          onClick={() => setShowAssigneeMenu(!showAssigneeMenu)}
          className="flex items-center gap-1.5 hover:bg-accent rounded px-1.5 py-0.5 transition-colors"
        >
          {task.assignee_name ? (
            <>
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary">
                {task.assignee_name[0]?.toUpperCase()}
              </div>
              <span className="text-xs truncate max-w-[70px]">{task.assignee_name}</span>
            </>
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/40" />
          )}
        </button>

        {showAssigneeMenu && (
          <div className="absolute top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in">
            <button
              onClick={() => handleAssigneeChange(null, null)}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors text-muted-foreground"
            >
              Sin asignar
            </button>
            {state.members.map(member => (
              <button
                key={member.id}
                onClick={() => handleAssigneeChange(member.id, member.name)}
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2"
              >
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white"
                  style={{ backgroundColor: member.color || '#6c5ce7' }}
                >
                  {member.name[0]?.toUpperCase()}
                </div>
                {member.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="px-3 py-2.5 flex items-center justify-center relative" ref={statusRef}>
        <button
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className={cn(
            'px-2 py-0.5 rounded-full text-[11px] font-medium text-white whitespace-nowrap transition-opacity hover:opacity-80',
            STATUS_COLORS[task.status] || 'bg-gray-400'
          )}
        >
          {task.status}
        </button>

        {showStatusMenu && (
          <div className="absolute top-full z-50 mt-1 w-36 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in">
            {STATUS_OPTIONS.map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2"
              >
                <div className={cn('w-2.5 h-2.5 rounded-full', STATUS_COLORS[status])} />
                {status}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Due Date */}
      <div className="px-3 py-1.5 flex items-center justify-center">
        <DatePicker
          value={task.due_date || ''}
          onChange={(val) => updateTask(task.id, { due_date: val || null })}
          placeholder="Sin fecha"
          size="sm"
          className="border-0 bg-transparent hover:bg-accent text-xs justify-center"
        />
      </div>

      {/* Priority */}
      <div className="px-3 py-2.5 flex items-center justify-center relative" ref={priorityRef}>
        <button
          onClick={() => setShowPriorityMenu(!showPriorityMenu)}
          className={cn(
            'px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-opacity hover:opacity-80',
            priorityConfig.color,
            priorityConfig.textColor
          )}
        >
          {priorityConfig.label}
        </button>

        {showPriorityMenu && (
          <div className="absolute top-full z-50 mt-1 w-28 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in">
            {PRIORITY_OPTIONS.map(priority => (
              <button
                key={priority}
                onClick={() => handlePriorityChange(priority)}
                className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2"
              >
                <div className={cn('w-2.5 h-2.5 rounded', PRIORITY_CONFIG[priority].color)} />
                {PRIORITY_CONFIG[priority].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 py-2.5 flex items-center justify-center relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="absolute top-full right-0 z-50 mt-1 w-40 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in">
            <button
              onClick={() => { openSidePanel(task); setShowMenu(false) }}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2"
            >
              <Eye className="w-3.5 h-3.5" />
              Ver detalles
            </button>
            <button
              onClick={() => { openTaskModal(task); setShowMenu(false) }}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2"
            >
              <Edit className="w-3.5 h-3.5" />
              Editar tarea
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleDelete}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
