import { useState, useEffect, useMemo } from 'react'
import {
  X, Calendar, User, Flag, Tag, Layers, Clock,
  Trash2, Paperclip, MoreHorizontal, Check,
  Type, Hash, DollarSign, ChevronDown,
} from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useSupabase } from '../../hooks/useSupabase'
import DatePicker from '../ui/DatePicker'
import BlockEditor from '../ui/BlockEditor'
import TaskComments from './TaskComments'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import { cn } from '../../lib/utils'
import { STATUS_OPTIONS, STATUS_COLORS, PRIORITY_OPTIONS } from '../../lib/constants'
import { useNotifications } from '../../hooks/useNotifications'
import { toast } from 'sonner'

export default function TaskSidePanel() {
  const { state, dispatch, closeSidePanel } = useApp()
  const { user } = useAuth()
  const { notifyTaskAssigned } = useNotifications()
  const { updateTask, deleteTask, createTask, setCustomFieldValue } = useSupabase()
  const task = state.sidePanelTask
  const isNew = task && !task.id

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pendingCFValues, setPendingCFValues] = useState({})

  const assignableUsers = useMemo(() => {
    return state.orgMembers.map(m => ({
      id: m.id,
      name: m.name,
      email: m.email,
      avatar: m.avatar_url || (m.user_id === user?.id ? user?.user_metadata?.avatar_url : null),
      color: m.color || '#6c5ce7',
    }))
  }, [user, state.orgMembers])

  useEffect(() => {
    if (task) {
      setTitle(task.title || '')
      setDescription(task.description || '')
    }
  }, [task?.id])

  if (!state.isSidePanelOpen || !task) return null

  const savePendingCF = (fieldId, fieldType, value) => {
    setPendingCFValues(prev => ({ ...prev, [fieldId]: { fieldType, value } }))
  }

  const sprint = state.sprints.find(s => s.id === task.sprint_id)
  const assignee = assignableUsers.find(u => u.id === task.assignee_id)

  const showSaved = () => {
    toast.success('Guardado')
  }

  const handleFieldUpdate = async (updates) => {
    // For new tasks, update local state only
    if (isNew) {
      dispatch({ type: 'OPEN_SIDE_PANEL', payload: { ...task, ...updates } })
      return
    }
    await updateTask(task.id, updates)
    showSaved()
  }

  const handleTitleBlur = async () => {
    if (isNew || !title.trim() || title.trim() === task.title) return
    await updateTask(task.id, { title: title.trim() })
    showSaved()
  }

  const handleDescBlur = async () => {
    if (isNew || description === task.description) return
    await updateTask(task.id, { description })
    showSaved()
  }

  const handleDelete = async () => {
    if (!isNew) await deleteTask(task.id)
    toast.success('Tarea eliminada')
    closeSidePanel()
  }

  const handleCreate = async () => {
    if (!title.trim()) return
    const { data: newTask } = await createTask({
      title: title.trim(),
      description,
      status: task.status || 'Por hacer',
      priority: task.priority || 'medium',
      assignee_id: task.assignee_id || null,
      assignee_name: task.assignee_name || '',
      due_date: task.due_date || null,
      sprint_id: task.sprint_id || null,
      tags: task.tags || null,
      board_id: state.currentBoard.id,
      position: state.tasks.length,
    })
    // Save pending custom field values
    if (newTask?.id && Object.keys(pendingCFValues).length > 0) {
      await Promise.all(
        Object.entries(pendingCFValues).map(([fieldId, { fieldType, value }]) =>
          setCustomFieldValue(newTask.id, fieldId, fieldType, value)
        )
      )
    }
    toast.success('Tarea creada')
    closeSidePanel()
  }

  return (
    <>
    {/* Backdrop */}
    <div className="fixed inset-0 z-30" onClick={closeSidePanel} />
    <div className="fixed top-0 right-0 h-screen w-[60vw] max-w-[800px] min-w-[500px] z-40 flex flex-col bg-card border-l border-border shadow-2xl animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2" />
        <div className="flex items-center gap-1">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={closeSidePanel}
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

        {/* Properties */}
        <div className="space-y-1 mb-6 pb-6 border-b border-border">
          {/* Responsable */}
          <PropRow icon={User} label="Responsable">
            <Select
              value={task.assignee_id || '_none'}
              onValueChange={(val) => {
                const member = assignableUsers.find(u => u.id === val)
                handleFieldUpdate({
                  assignee_id: val === '_none' ? null : val,
                  assignee_name: member?.name || '',
                })
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
              value={task.status || (state.boardStatuses?.[0]?.name || 'Por hacer')}
              onValueChange={(val) => handleFieldUpdate({ status: val })}
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
              onChange={(val) => handleFieldUpdate({ due_date: val || null })}
              placeholder="Vacío"
              size="sm"
              className="border-0 bg-transparent hover:bg-accent"
            />
          </PropRow>

          {/* Prioridad */}
          <PropRow icon={Flag} label="Prioridad">
            <Select
              value={task.priority || 'medium'}
              onValueChange={(val) => handleFieldUpdate({ priority: val })}
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
              onValueChange={(val) => handleFieldUpdate({ sprint_id: val === '_none' ? null : val })}
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
          <PropRow icon={Paperclip} label="Etiquetas">
            <input
              defaultValue={task.tags || ''}
              onBlur={(e) => handleFieldUpdate({ tags: e.target.value })}
              placeholder="frontend, bug..."
              className="text-sm bg-transparent text-foreground focus:outline-none placeholder:text-muted-foreground/50 flex-1 hover:bg-accent/30 rounded px-1 transition-colors"
            />
          </PropRow>

          {/* Custom Fields */}
          {(state.customFields || []).map(cf => {
            const values = state.customFieldValues?.[task.id] || []
            const cfVal = values.find(v => v.custom_field_id === cf.id)
            const pending = pendingCFValues[cf.id]
            const CFIcon = cf.type === 'number' ? Hash : cf.type === 'date' ? Calendar : cf.type === 'price' ? DollarSign : cf.type === 'dropdown' ? ChevronDown : Type

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
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <ChevronDown className="w-3.5 h-3.5" />
                          Vacío
                        </span>
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
            <PropRow icon={Clock} label="Creada">
              <span className="text-sm text-muted-foreground px-1">
                {new Date(task.created_at).toLocaleDateString('es', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </PropRow>
          )}
        </div>

        {/* Comments */}
        {!isNew && (
          <div className="mb-6 pb-6 border-b border-border">
            <TaskComments taskId={task.id} />
          </div>
        )}

        {/* Description */}
        <div>
          <h4 className="text-lg font-semibold text-foreground mb-3">Descripción de la tarea</h4>
          <BlockEditor
            value={task.description || ''}
            onChange={(val) => {
              setDescription(val)
              if (!isNew && task.id) updateTask(task.id, { description: val })
            }}
            placeholder="Proporciona un resumen general de la tarea..."
          />
        </div>
      </div>

      {/* Footer for new tasks */}
      {isNew && (
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

function PropRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-3 min-h-[36px] hover:bg-accent/20 rounded-lg px-1 -mx-1 transition-colors">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
