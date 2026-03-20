import { useState } from 'react'
import { X, Calendar, Palette } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useSupabase } from '../../hooks/useSupabase'
import DatePicker from '../ui/DatePicker'
import { cn } from '../../lib/utils'

const SPRINT_COLORS = [
  '#6c5ce7', '#0984e3', '#00b894', '#e17055', '#fdcb6e',
  '#a29bfe', '#74b9ff', '#55efc4', '#fab1a0', '#ffeaa7',
]

export default function SprintModal({ isOpen, onClose }) {
  const { state } = useApp()
  const { createSprint } = useSupabase()
  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    color: '#6c5ce7',
    goal: '',
  })

  if (!isOpen) return null

  const handleSave = async () => {
    if (!form.name.trim()) return
    await createSprint({
      ...form,
      board_id: state.currentBoard.id,
      status: 'active',
    })
    setForm({ name: '', start_date: '', end_date: '', color: '#6c5ce7', goal: '' })
    onClose()
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-card rounded-xl shadow-2xl border border-border animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground">Nuevo Sprint</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Nombre del sprint
            </label>
            <input
              autoFocus
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Sprint 1"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fecha inicio
              </label>
              <DatePicker
                value={form.start_date}
                onChange={(val) => handleChange('start_date', val)}
                placeholder="Inicio"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Fecha fin
              </label>
              <DatePicker
                value={form.end_date}
                onChange={(val) => handleChange('end_date', val)}
                placeholder="Fin"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Palette className="w-3.5 h-3.5" />
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {SPRINT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => handleChange('color', color)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-all',
                    form.color === color ? 'ring-2 ring-ring ring-offset-2 ring-offset-card scale-110' : 'hover:scale-110'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Objetivo del sprint (opcional)
            </label>
            <textarea
              value={form.goal}
              onChange={(e) => handleChange('goal', e.target.value)}
              placeholder="Describe el objetivo del sprint..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-accent transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Crear sprint
          </button>
        </div>
      </div>
    </div>
  )
}
