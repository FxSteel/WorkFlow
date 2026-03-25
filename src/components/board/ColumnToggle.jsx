import { useState, useRef, useEffect } from 'react'
import { Columns3, Check } from 'lucide-react'

const DEFAULT_COLUMNS = [
  { key: 'assignee', label: 'Responsable' },
  { key: 'status', label: 'Estado' },
  { key: 'due_date', label: 'Fecha' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'sprint', label: 'Sprint' },
]

export default function ColumnToggle({ customFields = [], visibleColumns, onToggle }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const allColumns = [
    ...DEFAULT_COLUMNS,
    ...customFields.map(cf => ({ key: `cf_${cf.id}`, label: cf.name, isCustom: true })),
  ]

  const isVisible = (key) => visibleColumns[key] !== false

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Columns3 className="w-3.5 h-3.5" />
        Campos visibles
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[200px] w-max rounded-xl border border-border bg-popover shadow-lg z-50 animate-scale-in">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground">Columnas visibles</span>
          </div>
          <div className="py-1 max-h-[300px] overflow-y-auto">
            {allColumns.map(col => {
              const visible = isVisible(col.key)
              return (
                <button
                  key={col.key}
                  onClick={() => onToggle(col.key, !visible)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-foreground hover:bg-accent transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    visible
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/30'
                  }`}>
                    {visible && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className={`whitespace-nowrap ${visible ? 'text-foreground' : 'text-muted-foreground'}`}>{col.label}</span>
                  {col.isCustom && <span className="text-[9px] text-muted-foreground/60 ml-auto">custom</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
