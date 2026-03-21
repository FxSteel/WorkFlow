import { useState, useRef, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
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
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedDate = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
  const isValidDate = selectedDate && isValid(selectedDate)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const dropdownHeight = 330
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < dropdownHeight
      ? rect.top - dropdownHeight - 4
      : rect.bottom + 4
    setPos({
      top,
      left: Math.min(rect.left, window.innerWidth - 290),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    const handleScroll = () => updatePosition()
    document.addEventListener("mousedown", handleClickOutside)
    window.addEventListener("scroll", handleScroll, true)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [open, updatePosition])

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
    <>
      <div className="relative" ref={triggerRef}>
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
      </div>

      {open && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[200] rounded-xl border border-border bg-popover shadow-xl animate-scale-in"
          style={{ top: pos.top, left: pos.left }}
        >
          <Calendar
            mode="single"
            selected={isValidDate ? selectedDate : undefined}
            onSelect={handleSelect}
            defaultMonth={isValidDate ? selectedDate : new Date()}
            locale={es}
            captionLayout="buttons"
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
        </div>,
        document.body
      )}
    </>
  )
}
