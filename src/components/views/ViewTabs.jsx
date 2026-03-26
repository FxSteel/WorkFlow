import { useState, useRef, useEffect } from 'react'
import {
  Table2, CalendarDays, Columns3, GanttChart, LayoutGrid, Clock,
  Plus, X, ChevronDown, Calendar as CalendarIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { Calendar } from '../ui/Calendar'

const ALL_VIEWS = [
  { id: 'tabla', label: 'Tabla', icon: Table2, color: 'text-blue-500' },
  { id: 'kanban', label: 'Kanban', icon: Columns3, color: 'text-green-500' },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays, color: 'text-orange-500' },
  { id: 'gantt', label: 'Gantt', icon: GanttChart, color: 'text-emerald-500' },
  { id: 'fichas', label: 'Fichas', icon: LayoutGrid, color: 'text-purple-500' },
  { id: 'cronograma', label: 'Cronograma', icon: Clock, color: 'text-pink-500' },
]

export { ALL_VIEWS }

function FilterDropdown({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
          value
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        )}
      >
        {value ? selected?.label || value : label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 min-w-[160px] rounded-lg border border-border bg-popover shadow-lg py-1 z-50 animate-scale-in">
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            className={cn('w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors', !value && 'bg-accent/50 font-medium')}
          >
            Todos
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={cn(
                'w-full px-3 py-1.5 text-xs text-left hover:bg-accent transition-colors flex items-center gap-2 whitespace-nowrap',
                value === opt.value && 'bg-accent/50 font-medium'
              )}
            >
              {opt.dot && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.dot }} />}
              {opt.pill ? (
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', opt.pill)}>{opt.label}</span>
              ) : (
                opt.label
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DateFilterDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const formatDate = (dateStr) => {
    if (!dateStr || dateStr === '_nodate') return null
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const label = value === '_nodate' ? 'Sin fecha' : (value ? formatDate(value) : 'Fecha')

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
          value
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        )}
      >
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 rounded-lg border border-border bg-popover shadow-lg z-50 animate-scale-in p-2">
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => { onChange('_nodate'); setOpen(false) }}
              className={cn(
                'flex-1 px-3 py-1.5 text-xs text-center rounded-md transition-colors border',
                value === '_nodate'
                  ? 'bg-primary/10 text-primary border-primary/30 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent border-border'
              )}
            >
              Sin fecha
            </button>
            {value && (
              <button
                onClick={() => { onChange(null); setOpen(false) }}
                className="px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10 rounded-md transition-colors border border-border"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <Calendar
            mode="single"
            selected={value && value !== '_nodate' ? new Date(value + 'T00:00:00') : undefined}
            onSelect={(date) => {
              if (date) {
                const y = date.getFullYear()
                const m = String(date.getMonth() + 1).padStart(2, '0')
                const d = String(date.getDate()).padStart(2, '0')
                onChange(`${y}-${m}-${d}`)
              } else {
                onChange(null)
              }
              setOpen(false)
            }}
            className="rounded-lg"
          />
        </div>
      )}
    </div>
  )
}

export default function ViewTabs({ activeViews, activeView, onChangeView, onAddView, onRemoveView, columnToggle, filters, onFilterChange, filterOptions }) {
  const [showAddMenu, setShowAddMenu] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowAddMenu(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const availableViews = ALL_VIEWS.filter(v => !activeViews.includes(v.id))

  return (
    <div className="flex items-center gap-0.5 px-4 pt-2 border-b border-border bg-card">
      {activeViews.map(viewId => {
        const view = ALL_VIEWS.find(v => v.id === viewId)
        if (!view) return null
        const Icon = view.icon
        const isActive = activeView === viewId

        return (
          <div
            key={viewId}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium cursor-pointer transition-colors rounded-t-lg',
              isActive
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <button
              onClick={() => onChangeView(viewId)}
              className="flex items-center gap-1.5"
            >
              <Icon className={cn('w-3.5 h-3.5', isActive ? view.color : 'text-muted-foreground')} />
              <span>{view.label}</span>
            </button>

            {/* Remove button - only show if more than 1 view */}
            {activeViews.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveView(viewId) }}
                className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Active indicator */}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-t" />
            )}
          </div>
        )
      })}

      {/* Add view button */}
      {availableViews.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 px-2 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {showAddMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-border bg-popover shadow-lg py-1.5 z-50 animate-scale-in">
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Agregar vista</span>
              </div>
              {availableViews.map(view => {
                const Icon = view.icon
                return (
                  <button
                    key={view.id}
                    onClick={() => {
                      onAddView(view.id)
                      setShowAddMenu(false)
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
                  >
                    <Icon className={cn('w-4 h-4', view.color)} />
                    <span>{view.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Filters + Column toggle — right aligned */}
      <div className="flex-1" />
      <div className="flex items-center gap-1.5 pb-1">
        {filters && filterOptions && onFilterChange && (
          <>
            <FilterDropdown
              label="Responsable"
              value={filters.assignee}
              options={filterOptions.assignees || []}
              onChange={(v) => onFilterChange({ ...filters, assignee: v })}
            />
            <FilterDropdown
              label="Estado"
              value={filters.status}
              options={filterOptions.statuses || []}
              onChange={(v) => onFilterChange({ ...filters, status: v })}
            />
            <FilterDropdown
              label="Prioridad"
              value={filters.priority}
              options={filterOptions.priorities || []}
              onChange={(v) => onFilterChange({ ...filters, priority: v })}
            />
            <DateFilterDropdown
              value={filters.hasDate}
              onChange={(v) => onFilterChange({ ...filters, hasDate: v })}
            />
            {Object.values(filters).some(v => v !== null) && (
              <button
                onClick={() => onFilterChange({ assignee: null, status: null, priority: null, hasDate: null })}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
              >
                <X className="w-3 h-3" />
                Limpiar
              </button>
            )}
          </>
        )}
        {columnToggle}
      </div>
    </div>
  )
}
