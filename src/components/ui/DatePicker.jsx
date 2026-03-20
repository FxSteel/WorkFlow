import { useState, useRef, useEffect } from "react"
import { Calendar as CalendarIcon } from "lucide-react"
import { format, parse, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar } from "./Calendar"
import { cn } from "../../lib/utils"

export default function DatePicker({
  value,
  onChange,
  placeholder = "Seleccionar fecha",
  className,
  size = "md",
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const isValidDate = selectedDate && isValid(selectedDate)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (date) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"))
    } else {
      onChange("")
    }
    setOpen(false)
  }

  const sizes = {
    sm: "px-2 py-1 text-xs gap-1.5",
    md: "px-3 py-2 text-sm gap-2",
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center rounded-lg border border-input bg-background text-foreground hover:bg-accent transition-colors w-full",
          !isValidDate && "text-muted-foreground",
          sizes[size] || sizes.md,
          className
        )}
      >
        <CalendarIcon className={cn("shrink-0", size === "sm" ? "w-3 h-3" : "w-4 h-4")} />
        <span className="truncate text-left flex-1">
          {isValidDate
            ? format(selectedDate, "d MMM yyyy", { locale: es })
            : placeholder
          }
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-xl border border-border bg-popover shadow-xl animate-scale-in">
          <Calendar
            mode="single"
            selected={isValidDate ? selectedDate : undefined}
            onSelect={handleSelect}
            defaultMonth={isValidDate ? selectedDate : new Date()}
            locale={es}
            captionLayout="dropdown"
          />
          {isValidDate && (
            <div className="px-3 pb-3 pt-0">
              <button
                onClick={() => { onChange(""); setOpen(false) }}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
              >
                Quitar fecha
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
