import { useState, useRef, useEffect } from 'react'
import {
  Table2, CalendarDays, Columns3, GanttChart, LayoutGrid, Clock,
  Plus, X, ChevronDown, Filter, SortAsc, Settings2,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const ALL_VIEWS = [
  { id: 'tabla', label: 'Tabla', icon: Table2, color: 'text-blue-500' },
  { id: 'kanban', label: 'Kanban', icon: Columns3, color: 'text-green-500' },
  { id: 'calendario', label: 'Calendario', icon: CalendarDays, color: 'text-orange-500' },
  { id: 'gantt', label: 'Gantt', icon: GanttChart, color: 'text-emerald-500' },
  { id: 'fichas', label: 'Fichas', icon: LayoutGrid, color: 'text-purple-500' },
  { id: 'cronograma', label: 'Cronograma', icon: Clock, color: 'text-pink-500' },
]

export { ALL_VIEWS }

export default function ViewTabs({ activeViews, activeView, onChangeView, onAddView, onRemoveView, onOpenStatusConfig }) {
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

      {/* Filter, Sort, Status Config — right aligned */}
      <div className="flex-1" />
      <div className="flex items-center gap-1 pb-0.5">
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <Filter className="w-3.5 h-3.5" />
          Filtrar
        </button>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <SortAsc className="w-3.5 h-3.5" />
          Ordenar
        </button>
        {onOpenStatusConfig && (
          <button
            onClick={onOpenStatusConfig}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Estados
          </button>
        )}
      </div>
    </div>
  )
}
