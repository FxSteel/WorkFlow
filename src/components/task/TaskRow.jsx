import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Edit, Trash2, GripVertical, Copy } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import { useSupabase } from '../../hooks/useSupabase'
import DatePicker from '../ui/DatePicker'
import { cn } from '../../lib/utils'
import { STATUS_OPTIONS, STATUS_COLORS, PRIORITY_OPTIONS, PRIORITY_CONFIG } from '../../lib/constants'
import { useNotifications } from '../../hooks/useNotifications'
import { toast } from 'sonner'

// Portal dropdown hook
function usePortalDropdown() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  const updatePos = useCallback((align = 'left', width = 160) => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const top = rect.bottom + 4
    let left = align === 'right' ? rect.right - width : rect.left
    left = Math.max(4, Math.min(left, window.innerWidth - width - 4))
    setPos({ top: Math.min(top, window.innerHeight - 200), left })
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return { open, setOpen, pos, updatePos, triggerRef, dropdownRef }
}

function CustomFieldDropdownCell({ cf, opts, selectedOpt, taskId, canEdit, setCustomFieldValue }) {
  const dd = usePortalDropdown()

  const handleSelect = async (optId) => {
    await setCustomFieldValue(taskId, cf.id, 'dropdown', optId || null)
    dd.setOpen(false)
    toast.success(`${cf.name} actualizado`)
  }

  return (
    <div className="px-2 py-2.5 flex items-center justify-center">
      <button
        ref={dd.triggerRef}
        onClick={() => {
          if (!canEdit) return
          dd.updatePos('left', 160)
          dd.setOpen(!dd.open)
        }}
        className={selectedOpt
          ? "px-2 py-0.5 rounded-full text-[11px] font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
          : "text-[11px] text-muted-foreground/40 hover:text-muted-foreground cursor-pointer"
        }
        style={selectedOpt ? { backgroundColor: selectedOpt.color } : undefined}
      >
        {selectedOpt ? selectedOpt.label : 'Sin asignar'}
      </button>

      {dd.open && createPortal(
        <div
          ref={dd.dropdownRef}
          className="fixed z-[200] w-40 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in"
          style={{ top: dd.pos.top, left: dd.pos.left }}
        >
          <button
            onClick={() => handleSelect(null)}
            className="w-full px-2 py-1.5 text-left hover:bg-accent transition-colors text-xs text-muted-foreground"
          >
            Sin asignar
          </button>
          {opts.map(o => (
            <button
              key={o.id}
              onClick={() => handleSelect(o.id)}
              className="w-full px-2 py-1 text-left hover:bg-accent transition-colors flex items-center"
            >
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white w-full text-center" style={{ backgroundColor: o.color }}>
                {o.label}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

export default function TaskRow({ task, onDragStart, onDragEnd, onDragOver, isDragging, gridTemplate, customFields = [], isColVisible = () => true, orderedCols = [] }) {
  // Compute CSS order for each column based on orderedCols
  const colOrder = useMemo(() => {
    const map = {}
    if (orderedCols.length > 0) {
      orderedCols.forEach((col, i) => { map[col.key] = i + 1 })
    }
    return map
  }, [orderedCols])
  const { state, openTask } = useApp()
  const { user } = useAuth()
  const { updateTask, deleteTask, createTask, setCustomFieldValue, logTaskActivity } = useSupabase()
  const { notifyTaskAssigned, notifyStatusChange, notifyPriorityChange, notifyTaskCompleted } = useNotifications()
  const { can } = usePermissions()

  const assignableUsers = useMemo(() => {
    return state.orgMembers.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar_url || (m.user_id === user?.id ? user?.user_metadata?.avatar_url : null),
      color: m.color || '#6c5ce7',
    }))
  }, [user, state.orgMembers])

  const assignee = usePortalDropdown()
  const status = usePortalDropdown()
  const priority = usePortalDropdown()
  const sprint = usePortalDropdown()
  const actions = usePortalDropdown()

  const sprintObj = state.sprints.find(s => s.id === task.sprint_id)
  const sprintName = sprintObj?.name || null

  const logAct = (action, oldValue, newValue) => {
    logTaskActivity({
      taskId: task.id,
      userId: user?.id,
      userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
      userAvatar: user?.user_metadata?.avatar_url,
      action, oldValue, newValue,
    })
  }

  const handleSprintChange = async (sprintId) => {
    const oldSprint = sprintName
    await updateTask(task.id, { sprint_id: sprintId })
    const newSprint = state.sprints.find(s => s.id === sprintId)?.name || null
    logAct('sprint_changed', oldSprint, newSprint)
    toast.success('Sprint actualizado')
    sprint.setOpen(false)
  }

  const handleStatusChange = async (s) => {
    await updateTask(task.id, { status: s })
    logAct('status_changed', task.status, s)
    toast.success('Estado actualizado')
    status.setOpen(false)
    if (task.assignee_id) {
      const member = state.orgMembers.find(m => m.id === task.assignee_id)
      if (member) {
        const isLast = state.boardStatuses?.length > 0 &&
          [...state.boardStatuses].sort((a, b) => a.position - b.position).at(-1)?.name === s
        if (isLast) {
          notifyTaskCompleted({ task, assigneeMember: member, fromUser: user, workspaceId: state.currentWorkspace?.id })
        } else {
          notifyStatusChange({ task, assigneeMember: member, newStatus: s, fromUser: user, workspaceId: state.currentWorkspace?.id })
        }
      }
    }
  }

  const handlePriorityChange = async (p) => {
    await updateTask(task.id, { priority: p })
    logAct('priority_changed', task.priority, p)
    toast.success('Prioridad actualizada')
    priority.setOpen(false)
    if (task.assignee_id) {
      const member = state.orgMembers.find(m => m.id === task.assignee_id)
      if (member) {
        notifyPriorityChange({ task, assigneeMember: member, newPriority: p, fromUser: user, workspaceId: state.currentWorkspace?.id })
      }
    }
  }

  const handleAssigneeChange = async (memberId, memberName) => {
    await updateTask(task.id, { assignee_id: memberId, assignee_name: memberName })
    logAct('assignee_changed', task.assignee_name || null, memberName || null)
    toast.success(memberId ? `Asignado a ${memberName}` : 'Responsable removido')
    if (memberId) {
      const member = state.orgMembers.find(m => m.id === memberId)
      notifyTaskAssigned({ task, assigneeMember: member, fromUser: user, workspaceId: state.currentWorkspace?.id })
    }
    assignee.setOpen(false)
  }

  const handleDuplicate = async () => {
    await createTask({
      title: `${task.title} (copia)`,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee_id: task.assignee_id,
      assignee_name: task.assignee_name,
      due_date: task.due_date,
      sprint_id: task.sprint_id,
      tags: task.tags,
      board_id: task.board_id,
      position: state.tasks.length,
    })
    toast.success('Tarea duplicada')
    actions.setOpen(false)
  }

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleDelete = () => {
    setShowDeleteConfirm(true)
    actions.setOpen(false)
  }

  const confirmDelete = async () => {
    await deleteTask(task.id)
    toast.success('Tarea eliminada')
    setShowDeleteConfirm(false)
  }

  const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium

  return (
    <div
      draggable={can('moveTask')}
      onDragStart={(e) => {
        if (!can('moveTask')) { e.preventDefault(); return }
        e.dataTransfer.effectAllowed = 'move'
        onDragStart?.(task)
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(e) => onDragOver?.(e)}
      className={cn(
        'grid gap-0 border-b border-border last:border-b-0 hover:bg-accent/30 transition-all group text-sm',
        isDragging && 'opacity-40 scale-[0.98] bg-accent/20'
      )}
      style={{ gridTemplateColumns: gridTemplate || 'minmax(250px,2fr) 120px 110px 110px 100px 100px 70px' }}
    >
      {/* Task Name */}
      <div style={{ order: 0 }} className="px-3 py-2.5 flex items-center gap-2 min-w-0">
        {can('moveTask') && <GripVertical className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 cursor-grab" />}
        {task.parent_task_id && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">↳ sub</span>
        )}
        <button
          onClick={() => openTask(task)}
          className="truncate text-foreground hover:text-primary transition-colors text-left"
        >
          {task.title}
        </button>
      </div>

      {/* Assignee */}
      <div style={{ order: colOrder['assignee'] ?? 1 }} className={`py-2.5 flex items-center justify-center ${isColVisible('assignee') ? 'px-3' : 'overflow-hidden w-0 p-0'}`}>
        <button
          ref={assignee.triggerRef}
          onClick={() => { if (!can('editTask')) return; assignee.updatePos('left', 176); assignee.setOpen(!assignee.open) }}
          className="flex items-center gap-1.5 hover:bg-accent rounded px-1.5 py-0.5 transition-colors"
        >
          {task.assignee_name ? (
            (() => {
              const assignedUser = assignableUsers.find(u => u.id === task.assignee_id)
              return (
                <>
                  {assignedUser?.avatar ? (
                    <img src={assignedUser.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                      style={{ backgroundColor: assignedUser?.color || '#6c5ce7' }}
                    >
                      {task.assignee_name[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs whitespace-nowrap">{task.assignee_name}</span>
                </>
              )
            })()
          ) : (
            <span className="text-[11px] text-muted-foreground">Sin asignar</span>
          )}
        </button>

        {assignee.open && createPortal(
          <div
            ref={assignee.dropdownRef}
            className="fixed z-[200] min-w-[180px] rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in"
            style={{ top: assignee.pos.top, left: assignee.pos.left }}
          >
            <button
              onClick={() => handleAssigneeChange(null, null)}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2 text-muted-foreground"
            >
              <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/40 shrink-0" />
              Sin asignar
            </button>
            {assignableUsers.map(u => (
              <button
                key={u.id}
                onClick={() => handleAssigneeChange(u.id, u.name)}
                className={cn(
                  'w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2 whitespace-nowrap',
                  task.assignee_id === u.id && 'bg-accent/50'
                )}
              >
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="w-5 h-5 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.name[0]?.toUpperCase()}
                  </div>
                )}
                {u.name}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Status */}
      <div style={{ order: colOrder['status'] ?? 2 }} className={`py-2.5 flex items-center justify-center ${isColVisible('status') ? 'px-3' : 'overflow-hidden w-0 p-0'}`}>
        {(() => {
          const statusObj = (state.boardStatuses || []).find(s => s.name === task.status)
          const statusColor = statusObj?.color || '#9ca3af'
          return (
            <button
              ref={status.triggerRef}
              onClick={() => { if (!can('editTask')) return; status.updatePos('left', 144); status.setOpen(!status.open) }}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white whitespace-nowrap transition-opacity hover:opacity-80"
              style={{ backgroundColor: statusColor }}
            >
              {task.status}
            </button>
          )
        })()}

        {status.open && createPortal(
          <div
            ref={status.dropdownRef}
            className="fixed z-[200] w-40 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in"
            style={{ top: status.pos.top, left: status.pos.left }}
          >
            {(state.boardStatuses || []).map(s => (
              <button
                key={s.id}
                onClick={() => handleStatusChange(s.name)}
                className="w-full px-2 py-1 text-left hover:bg-accent transition-colors flex items-center"
              >
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white w-full text-center" style={{ backgroundColor: s.color }}>
                  {s.name}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Due Date */}
      <div style={{ order: colOrder['due_date'] ?? 3 }} className={`py-1.5 flex items-center justify-center ${isColVisible('due_date') ? 'px-3' : 'overflow-hidden w-0 p-0'}`}>
        <DatePicker
          value={task.due_date || ''}
          onChange={(val) => updateTask(task.id, { due_date: val || null })}
          placeholder="Sin fecha"
          size="sm"
          className="border-0 bg-transparent hover:bg-accent text-xs justify-center"
        />
      </div>

      {/* Priority */}
      <div style={{ order: colOrder['priority'] ?? 4 }} className={`py-2.5 flex items-center justify-center ${isColVisible('priority') ? 'px-3' : 'overflow-hidden w-0 p-0'}`}>
        <button
          ref={priority.triggerRef}
          onClick={() => { if (!can('editTask')) return; priority.updatePos('left', 112); priority.setOpen(!priority.open) }}
          className={cn(
            'px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-opacity hover:opacity-80',
            priorityConfig.color,
            priorityConfig.textColor
          )}
        >
          {priorityConfig.label}
        </button>

        {priority.open && createPortal(
          <div
            ref={priority.dropdownRef}
            className="fixed z-[200] w-32 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in"
            style={{ top: priority.pos.top, left: priority.pos.left }}
          >
            {PRIORITY_OPTIONS.map(p => (
              <button
                key={p.value}
                onClick={() => handlePriorityChange(p.value)}
                className="w-full px-2 py-1 text-left hover:bg-accent transition-colors flex items-center"
              >
                <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium w-full text-center', p.color, p.textColor)}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Sprint */}
      <div style={{ order: colOrder['sprint'] ?? 5 }} className={`py-2.5 flex items-center justify-center ${isColVisible('sprint') ? 'px-2' : 'overflow-hidden w-0 p-0'}`}>
        <button
          ref={sprint.triggerRef}
          onClick={() => { if (!can('editTask')) return; sprint.updatePos('left', 140); sprint.setOpen(!sprint.open) }}
          className="px-2 py-0.5 rounded text-[11px] font-medium text-muted-foreground hover:bg-accent transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: sprintObj?.color || '#9ca3af' }}
          />
          {sprintName || 'Sin sprint'}
        </button>

        {sprint.open && createPortal(
          <div
            ref={sprint.dropdownRef}
            className="fixed z-[200] min-w-[160px] rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in"
            style={{ top: sprint.pos.top, left: sprint.pos.left }}
          >
            <button
              onClick={() => handleSprintChange(null)}
              className={cn('w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2 whitespace-nowrap', !task.sprint_id && 'bg-accent/50')}
            >
              <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
              Sin asignar
            </button>
            {state.sprints.map(s => (
              <button
                key={s.id}
                onClick={() => handleSprintChange(s.id)}
                className={cn('w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2 whitespace-nowrap', task.sprint_id === s.id && 'bg-accent/50')}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color || '#6c5ce7' }} />
                {s.name}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Custom Fields */}
      {customFields.map(cf => {
        const cfVisible = isColVisible(`cf_${cf.id}`)
        const values = state.customFieldValues?.[task.id] || []
        const cfVal = values.find(v => v.custom_field_id === cf.id)
        const cfOrder = colOrder[`cf_${cf.id}`]

        if (!cfVisible) {
          return <div key={cf.id} style={{ order: cfOrder ?? 99 }} className="overflow-hidden w-0 p-0" />
        }

        if (cf.type === 'dropdown') {
          const opts = cf.custom_field_options || []
          const selectedOpt = opts.find(o => o.id === cfVal?.value_option_id)
          return (
            <div key={cf.id} style={{ order: cfOrder ?? 99 }}>
              <CustomFieldDropdownCell
                cf={cf}
                opts={opts}
                selectedOpt={selectedOpt}
                taskId={task.id}
                canEdit={can('editTask')}
                setCustomFieldValue={setCustomFieldValue}
              />
            </div>
          )
        }

        if (cf.type === 'date') {
          return (
            <div key={cf.id} style={{ order: cfOrder ?? 99 }} className="px-2 py-2.5 flex items-center justify-center">
              <DatePicker
                value={cfVal?.value_date || ''}
                onChange={async (val) => {
                  if (!can('editTask')) return
                  await setCustomFieldValue(task.id, cf.id, 'date', val || null)
                  toast.success(`${cf.name} actualizado`)
                }}
                placeholder="Sin fecha"
                size="sm"
                className="border-0 bg-transparent hover:bg-accent text-[11px]"
              />
            </div>
          )
        }

        const displayValue = cf.type === 'text' ? (cfVal?.value_text || '')
          : cf.type === 'number' ? (cfVal?.value_number ?? '')
          : cf.type === 'price' ? (cfVal?.value_price ?? '')
          : ''

        return (
          <div key={cf.id} style={{ order: cfOrder ?? 99 }} className="px-2 py-2.5 flex items-center justify-center">
            <input
              type={cf.type === 'number' || cf.type === 'price' ? 'number' : 'text'}
              defaultValue={displayValue}
              onBlur={async (e) => {
                if (!can('editTask')) return
                const val = e.target.value
                await setCustomFieldValue(task.id, cf.id, cf.type, cf.type === 'number' || cf.type === 'price' ? (val ? Number(val) : null) : (val || null))
                toast.success(`${cf.name} actualizado`)
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
              placeholder="—"
              maxLength={cf.type === 'text' ? 30 : undefined}
              className="text-[11px] bg-transparent border-0 text-center w-full text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:bg-accent/30 rounded px-1"
            />
          </div>
        )
      })}

      {/* Actions */}
      <div style={{ order: 999 }} className="px-3 py-2.5 flex items-center justify-center">
        {can('editTask') && (
          <button
            ref={actions.triggerRef}
            onClick={() => { actions.updatePos('right', 160); actions.setOpen(!actions.open) }}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}

        {actions.open && createPortal(
          <div
            ref={actions.dropdownRef}
            className="fixed z-[200] w-40 rounded-lg border border-border bg-popover shadow-lg py-1 animate-scale-in"
            style={{ top: actions.pos.top, left: actions.pos.left }}
          >
            <button
              onClick={handleDuplicate}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicar
            </button>
            <button
              onClick={() => { openTask(task); actions.setOpen(false) }}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2"
            >
              <Edit className="w-3.5 h-3.5" />
              Editar
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleDelete}
              className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Eliminar
            </button>
          </div>,
          document.body
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-popover border border-border rounded-xl p-6 w-[360px] shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-2">¿Eliminar tarea?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Esta acción no se puede deshacer. La tarea <strong className="text-foreground">"{task.title}"</strong> será eliminada permanentemente.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
