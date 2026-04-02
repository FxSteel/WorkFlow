import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  X, Calendar, User, Flag, Tag, Layers, Clock,
  Trash2, Paperclip, MoreHorizontal, Check, Loader2,
  Type, Hash, DollarSign, ChevronDown,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import DatePicker from '../ui/DatePicker'
import BlockEditor from '../ui/BlockEditor'
import TaskComments from './TaskComments'
import TaskActivity from './TaskActivity'
import TaskSubtasks from './TaskSubtasks'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { cn } from '../../lib/utils'
import { STATUS_OPTIONS, STATUS_COLORS, PRIORITY_OPTIONS } from '../../lib/constants'
import { useNotifications } from '../../hooks/useNotifications'
import { resolveFieldIcon } from '../../lib/fieldIcons'
import { toast } from 'sonner'
import { usePermissions } from '../../hooks/usePermissions'

export default function TaskSidePanel() {
  const { state, dispatch, closeSidePanel } = useApp()
  const { user } = useAuth()
  const { can } = usePermissions()
  const { notifyTaskAssigned, notifyStatusChange, notifyPriorityChange, notifyTaskCompleted } = useNotifications()
  const { updateTask, deleteTask, createTask, setCustomFieldValue, logTaskActivity } = useSupabase()
  const task = state.sidePanelTask
  const isNew = task && !task.id
  const canEdit = can('editTask')
  const canDelete = can('deleteTask')
  const canCreate = can('createTask')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pendingCFValues, setPendingCFValues] = useState({})
  const [activityKey, setActivityKey] = useState(0)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'saving' | 'saved'
  const [closing, setClosing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const saveTimerRef = useRef(null)

  const logActivity = useCallback((action, oldValue, newValue) => {
    if (!task?.id || isNew) return
    logTaskActivity({
      taskId: task.id,
      userId: user?.id,
      userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
      userAvatar: user?.user_metadata?.avatar_url,
      action,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
    }).then(() => setActivityKey(k => k + 1))
  }, [task?.id, user, logTaskActivity])

  const isPrivateBoard = useMemo(() => {
    if (!task?.board_id && !state.currentBoard?.id) return false
    const boardId = task?.board_id || state.currentBoard?.id
    const board = state.boards.find(b => b.id === boardId)
    if (!board) return false
    const ws = state.workspaces.find(w => w.id === board.workspace_id)
    return ws?.is_private === true
  }, [task?.board_id, state.currentBoard?.id, state.boards, state.workspaces])

  const assignableUsers = useMemo(() => {
    const members = isPrivateBoard
      ? state.orgMembers.filter(m => m.user_id === user?.id)
      : state.orgMembers
    return members.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar_url || (m.user_id === user?.id ? user?.user_metadata?.avatar_url : null),
      color: m.color || '#6c5ce7',
    }))
  }, [user, state.orgMembers, isPrivateBoard])

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
    }
  }, [task?.id])

  if (!state.isSidePanelOpen || !task) return null

  const handleClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      closeSidePanel()
    }, 200)
  }

  const savePendingCF = (fieldId, fieldType, value) => {
    setPendingCFValues(prev => ({ ...prev, [fieldId]: { fieldType, value } }))
  }

  const sprint = state.sprints.find(s => s.id === task.sprint_id)
  const assignee = assignableUsers.find(u => u.id === task.assignee_id)

  const showSaving = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
  }

  const showSaved = () => {
    setSaveStatus('saved')
    saveTimerRef.current = setTimeout(() => setSaveStatus(null), 2500)
  }

  const handleFieldUpdate = async (updates) => {
    if (isNew) {
      dispatch({ type: 'OPEN_SIDE_PANEL', payload: { ...task, ...updates } })
      return
    }
    if (!canEdit) return
    showSaving()
    await updateTask(task.id, updates)
    showSaved()
  }

  const handleTitleBlur = async () => {
    if (isNew || !canEdit || !title.trim() || title.trim() === task.title) return
    const oldTitle = task.title
    showSaving()
    await updateTask(task.id, { title: title.trim() })
    logActivity('title_changed', oldTitle, title.trim())
    showSaved()
  }

  const handleDescBlur = async () => {
    if (isNew || !canEdit || description === task.description) return
    showSaving()
    await updateTask(task.id, { description })
    showSaved()
  }

  const handleDelete = async () => {
    setShowDeleteConfirm(false)
    setClosing(true)
    setTimeout(async () => {
      if (!isNew) await deleteTask(task.id)
      toast.success('Tarea eliminada')
      setClosing(false)
      closeSidePanel()
    }, 200)
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    const { data: newTask } = await createTask({
      title: title.trim(),
      description,
      status: task.status || 'Backlog',
      priority: task.priority || 'medium',
      assignee_id: task.assignee_id || null,
      assignee_name: task.assignee_name || '',
      due_date: task.due_date || null,
      sprint_id: task.sprint_id || null,
      tags: task.tags || null,
      board_id: state.currentBoard.id,
      position: state.tasks.length,
    })
    if (newTask?.id) {
      logTaskActivity({
        taskId: newTask.id,
        userId: user?.id,
        userName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || '',
        userAvatar: user?.user_metadata?.avatar_url,
        action: 'created',
        oldValue: null,
        newValue: null,
      })
      if (Object.keys(pendingCFValues).length > 0) {
        await Promise.all(
          Object.entries(pendingCFValues).map(([fieldId, { fieldType, value }]) =>
            setCustomFieldValue(newTask.id, fieldId, fieldType, value)
          )
        )
      }
    }
    toast.success('Tarea creada')
    closeSidePanel()
  }

  return (
    <>
    {/* Backdrop */}
    <div className={`fixed inset-0 z-30 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose} />
    <div className={`fixed top-0 right-0 h-screen w-[50vw] max-w-[1000px] min-w-[500px] z-40 flex flex-col bg-card border-l border-border shadow-2xl overflow-hidden transition-transform duration-200 ease-in-out ${closing ? 'translate-x-full' : 'animate-slide-in-right'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs">Guardando...</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1.5 text-emerald-500">
              <Check className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Autoguardado</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isNew && canDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Title */}
        <textarea
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) e.target.blur() }}
          placeholder="Sin título"
          rows={1}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
          className="w-full text-2xl font-bold bg-transparent text-foreground border-0 focus:outline-none placeholder:text-muted-foreground/40 mb-5 resize-none overflow-hidden leading-tight"
        />

        {/* Parent task reference */}
        {task.parent_task_id && (() => {
          const parent = state.tasks.find(t => t.id === task.parent_task_id)
          return parent ? (
            <button
              onClick={() => dispatch({ type: 'OPEN_SIDE_PANEL', payload: parent })}
              className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm w-full text-left"
            >
              <span className="text-muted-foreground">↳ Subtarea de</span>
              <span className="font-medium text-primary truncate">{parent.title}</span>
            </button>
          ) : null
        })()}

        {/* Properties — 2-column grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-6 pb-6 border-b border-border">
          {/* Responsable */}
          <PropRow icon={User} label="Responsable">
            <Select
              value={task.assignee_id || '_none'}
              onValueChange={(val) => {
                const member = assignableUsers.find(u => u.id === val)
                const oldName = assignee?.name || null
                handleFieldUpdate({
                  assignee_id: val === '_none' ? null : val,
                  assignee_name: member?.name || '',
                })
                logActivity('assignee_changed', oldName, member?.name || null)
                if (val !== '_none' && member) {
                  const dbMember = state.orgMembers.find(m => m.id === val)
                  notifyTaskAssigned({ task, assigneeMember: dbMember, fromUser: user, workspaceId: state.currentWorkspace?.id })
                }
              }}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto min-w-[120px]">
                <div className="flex items-center gap-2">
                  {assignee ? (
                    <>
                      {assignee.avatar ? (
                        <img src={assignee.avatar} alt="" className="w-4 h-4 rounded-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: assignee.color }}>
                          {assignee.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <span>{assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Vacío</span>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin asignar</SelectItem>
                {assignableUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Estado */}
          <PropRow icon={Tag} label="Estado">
            <Select
              value={task.status || (state.boardStatuses?.[0]?.name || 'Backlog')}
              onValueChange={(val) => {
                handleFieldUpdate({ status: val })
                logActivity('status_changed', task.status, val)
                if (task.assignee_id) {
                  const member = state.orgMembers.find(m => m.id === task.assignee_id)
                  if (member) {
                    const isLast = state.boardStatuses?.length > 0 &&
                      [...state.boardStatuses].sort((a, b) => a.position - b.position).at(-1)?.name === val
                    if (isLast) {
                      notifyTaskCompleted({ task, assigneeMember: member, fromUser: user, workspaceId: state.currentWorkspace?.id })
                    } else {
                      notifyStatusChange({ task, assigneeMember: member, newStatus: val, fromUser: user, workspaceId: state.currentWorkspace?.id })
                    }
                  }
                }
              }}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                {(() => {
                  const s = (state.boardStatuses || []).find(bs => bs.name === task.status)
                  return (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: s?.color || '#9ca3af' }}>
                      {task.status}
                    </span>
                  )
                })()}
              </SelectTrigger>
              <SelectContent>
                {(state.boardStatuses || []).map(s => (
                  <SelectItem key={s.id} value={s.name}>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: s.color }}>{s.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Fecha limite */}
          <PropRow icon={Calendar} label="Fecha límite">
            <DatePicker
              value={task.due_date || ''}
              onChange={(val) => { handleFieldUpdate({ due_date: val || null }); logActivity('due_date_changed', task.due_date, val || null) }}
              placeholder="Vacío"
              size="sm"
              className="border-0 bg-transparent hover:bg-accent"
            />
          </PropRow>

          {/* Prioridad */}
          <PropRow icon={Flag} label="Prioridad">
            <Select
              value={task.priority || 'medium'}
              onValueChange={(val) => {
                handleFieldUpdate({ priority: val })
                logActivity('priority_changed', task.priority, val)
                if (task.assignee_id) {
                  const member = state.orgMembers.find(m => m.id === task.assignee_id)
                  if (member) {
                    notifyPriorityChange({ task, assigneeMember: member, newPriority: val, fromUser: user, workspaceId: state.currentWorkspace?.id })
                  }
                }
              }}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                {(() => {
                  const p = PRIORITY_OPTIONS.find(x => x.value === (task.priority || 'medium'))
                  return <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', p?.color, p?.value === 'medium' ? 'text-black' : 'text-white')}>{p?.label}</span>
                })()}
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-medium', p.color, p.value === 'medium' ? 'text-black' : 'text-white')}>{p.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Sprint */}
          <PropRow icon={Layers} label="Sprint">
            <Select
              value={task.sprint_id || '_none'}
              onValueChange={(val) => {
                handleFieldUpdate({ sprint_id: val === '_none' ? null : val })
                const oldSprint = sprint?.name || null
                const newSprint = state.sprints.find(s => s.id === val)?.name || null
                logActivity('sprint_changed', oldSprint, newSprint)
              }}
            >
              <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Sin asignar</SelectItem>
                {state.sprints.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PropRow>

          {/* Etiquetas */}
          <PropRow icon={Paperclip} label="Etiquetas" span>
            <TagsInput
              value={task.tags || ''}
              onChange={(val) => handleFieldUpdate({ tags: val })}
            />
          </PropRow>

          {/* Custom Fields */}
          {(state.customFields || []).map(cf => {
            const values = state.customFieldValues?.[task.id] || []
            const cfVal = values.find(v => v.custom_field_id === cf.id)
            const pending = pendingCFValues[cf.id]
            const typeIcon = cf.type === 'number' ? Hash : cf.type === 'date' ? Calendar : cf.type === 'price' ? DollarSign : cf.type === 'dropdown' ? ChevronDown : Type
            const CFIcon = resolveFieldIcon(cf.icon, typeIcon)

            if (cf.type === 'dropdown') {
              const opts = cf.custom_field_options || []
              const currentVal = pending ? pending.value : cfVal?.value_option_id
              const selectedOpt = opts.find(o => o.id === currentVal)
              return (
                <PropRow key={cf.id} icon={CFIcon} label={cf.name}>
                  <Select
                    key={`${cf.id}-${currentVal || 'none'}`}
                    value={currentVal || '_none'}
                    onValueChange={async (val) => {
                      const v = val === '_none' ? null : val
                      if (isNew) { savePendingCF(cf.id, 'dropdown', v); return }
                      await setCustomFieldValue(task.id, cf.id, 'dropdown', v)
                    }}
                  >
                    <SelectTrigger className="border-0 bg-transparent h-7 px-1 text-sm hover:bg-accent w-auto">
                      {selectedOpt ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: selectedOpt.color }}>{selectedOpt.label}</span>
                      ) : (
                        <span className="text-muted-foreground">Vacío</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sin asignar</SelectItem>
                      {opts.map(o => (
                        <SelectItem key={o.id} value={o.id}>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white" style={{ backgroundColor: o.color }}>{o.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropRow>
              )
            }

            if (cf.type === 'date') {
              const dateVal = pending ? pending.value : cfVal?.value_date
              return (
                <PropRow key={cf.id} icon={CFIcon} label={cf.name}>
                  <DatePicker
                    value={dateVal || ''}
                    onChange={async (val) => {
                      if (isNew) { savePendingCF(cf.id, 'date', val || null); return }
                      await setCustomFieldValue(task.id, cf.id, 'date', val || null)
                    }}
                    placeholder="Vacío"
                    size="sm"
                    className="border-0 bg-transparent hover:bg-accent"
                  />
                </PropRow>
              )
            }

            const rawValue = pending ? pending.value
              : cf.type === 'text' ? (cfVal?.value_text || '')
              : cf.type === 'number' ? (cfVal?.value_number ?? '')
              : cf.type === 'price' ? (cfVal?.value_price ?? '')
              : ''
            const displayValue = rawValue
            const hasValue = displayValue !== '' && displayValue !== null

            return (
              <PropRow key={cf.id} icon={CFIcon} label={cf.name}>
                <CustomFieldInput
                  type={cf.type}
                  defaultValue={displayValue}
                  hasValue={hasValue}
                  onSave={async (val) => {
                    const v = cf.type === 'number' || cf.type === 'price' ? (val ? Number(val) : null) : (val || null)
                    if (isNew) { savePendingCF(cf.id, cf.type, v); return }
                    await setCustomFieldValue(task.id, cf.id, cf.type, v)
                  }}
                />
              </PropRow>
            )
          })}

          {task.created_at && (
            <PropRow icon={Clock} label="Creada" span>
              <span className="text-sm text-muted-foreground px-1">
                {new Date(task.created_at).toLocaleDateString('es', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </PropRow>
          )}
        </div>

        {/* Description */}
        <div className="mb-6 pb-6 border-b border-border">
          <h4 className="text-lg font-semibold text-foreground mb-3">Descripción de la tarea</h4>
          <BlockEditor
            value={task.description || ''}
            onChange={(val) => {
              setDescription(val)
              if (!isNew && task.id) {
                showSaving()
                updateTask(task.id, { description: val }).then(() => showSaved())
              }
            }}
            placeholder="Proporciona un resumen general de la tarea..."
          />
        </div>

        {/* Subtasks */}
        {!isNew && (
          <div className="mb-6 pb-6 border-b border-border">
            <TaskSubtasks
              taskId={task.id}
              boardId={task.board_id || state.currentBoard?.id}
              onActivity={(action, oldVal, newVal) => logActivity(action, oldVal, newVal)}
            />
          </div>
        )}

        {/* Comments */}
        {!isNew && (
          <div className="mb-6 pb-6 border-b border-border">
            <TaskComments taskId={task.id} />
          </div>
        )}

        {/* Activity log */}
        {!isNew && (
          <div className="mb-6">
            <TaskActivity key={activityKey} taskId={task.id} />
          </div>
        )}
      </div>

      {/* Footer for new tasks */}
      {isNew && canCreate && (
        <div className="px-5 py-3 border-t border-border">
          <button
            onClick={handleCreate}
            disabled={!title.trim()}
            className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            Crear tarea
          </button>
        </div>
      )}
    </div>

    {/* Delete confirmation modal */}
    {showDeleteConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={() => setShowDeleteConfirm(false)} />
        <div className="relative z-10 w-full max-w-sm bg-card rounded-xl shadow-2xl border border-border animate-scale-in p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Eliminar tarea</h3>
              <p className="text-xs text-muted-foreground">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            ¿Estás seguro de que deseas eliminar <strong className="text-foreground">"{task.title || 'Sin título'}"</strong>?
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

function CustomFieldInput({ type, defaultValue, hasValue, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(defaultValue)

  useEffect(() => { setVal(defaultValue) }, [defaultValue])

  if (!editing && !hasValue) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-1"
      >
        <Type className="w-3.5 h-3.5" />
        Vacío
      </button>
    )
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-sm text-foreground hover:bg-accent/30 rounded px-1 transition-colors"
      >
        {type === 'price' ? `$${defaultValue}` : defaultValue}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {type === 'price' && <span className="text-xs text-muted-foreground">$</span>}
      <input
        type={type === 'number' || type === 'price' ? 'number' : 'text'}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={async () => {
          await onSave(val)
          setEditing(false)
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setVal(defaultValue); setEditing(false) } }}
        maxLength={type === 'text' ? 30 : undefined}
        className="text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/50 flex-1 bg-accent/30 rounded px-1.5 py-0.5"
        autoFocus
      />
    </div>
  )
}

function TagsInput({ value, onChange }) {
  const [input, setInput] = useState('')
  const tags = value ? value.split(',').map(t => t.trim()).filter(Boolean) : []

  const addTag = () => {
    const tag = input.trim()
    if (!tag || tags.includes(tag)) { setInput(''); return }
    const updated = [...tags, tag].join(', ')
    onChange(updated)
    setInput('')
  }

  const removeTag = (idx) => {
    const updated = tags.filter((_, i) => i !== idx).join(', ')
    onChange(updated || null)
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
          {tag}
          <button onClick={() => removeTag(i)} className="hover:text-destructive transition-colors">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); addTag() }
          if (e.key === 'Backspace' && !input && tags.length > 0) removeTag(tags.length - 1)
        }}
        placeholder={tags.length === 0 ? 'Agregar etiqueta...' : '+'}
        className="text-xs bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/50 min-w-[60px] flex-1 px-1 py-0.5"
      />
    </div>
  )
}

function PropRow({ icon: Icon, label, children, span }) {
  return (
    <div className={`flex items-center gap-2 min-h-[34px] hover:bg-accent/20 rounded-lg px-1.5 transition-colors ${span ? 'col-span-2' : ''}`}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0 w-20">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
