import { useRef } from 'react'
import { cn } from '../../lib/utils'

const PRESET_COLORS = [
  '#6c5ce7', '#0984e3', '#00b894', '#e17055', '#fdcb6e',
  '#d63031', '#e84393', '#636e72', '#2d3436', '#00cec9',
  '#a29bfe', '#74b9ff', '#55efc4', '#fab1a0', '#ffeaa7',
]

export default function ColorPicker({ value, onChange, presets = PRESET_COLORS, size = 'md' }) {
  const inputRef = useRef(null)
  const dotSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {presets.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            dotSize, 'rounded-full transition-all hover:scale-110 shrink-0',
            value === c && 'ring-2 ring-ring ring-offset-1 ring-offset-popover'
          )}
          style={{ backgroundColor: c }}
        />
      ))}
      {/* Custom color button */}
      <label className={cn(dotSize, 'relative rounded-full shrink-0 cursor-pointer border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 transition-colors flex items-center justify-center overflow-hidden')}>
        {value && !presets.includes(value) ? (
          <span className="absolute inset-0 rounded-full ring-2 ring-ring ring-offset-1 ring-offset-popover" style={{ backgroundColor: value }} />
        ) : (
          <span className="text-[8px] text-muted-foreground font-bold">+</span>
        )}
        <input
          ref={inputRef}
          type="color"
          value={value || '#6c5ce7'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    </div>
  )
}
