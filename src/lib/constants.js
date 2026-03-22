export const STATUS_OPTIONS = ['Backlog', 'Por hacer', 'En progreso', 'En revisión', 'Completado', 'Bloqueado']

export const STATUS_COLORS = {
  'Backlog': 'bg-gray-500',
  'Por hacer': 'bg-gray-400',
  'En progreso': 'bg-blue-500',
  'En revisión': 'bg-yellow-500',
  'Completado': 'bg-emerald-500',
  'Bloqueado': 'bg-red-500',
}

export const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Crítica', color: 'bg-red-500', text: 'text-white', textColor: 'text-white' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500', text: 'text-white', textColor: 'text-white' },
  { value: 'medium', label: 'Media', color: 'bg-yellow-500', text: 'text-black', textColor: 'text-black' },
  { value: 'low', label: 'Baja', color: 'bg-blue-500', text: 'text-white', textColor: 'text-white' },
]

export const PRIORITY_CONFIG = Object.fromEntries(
  PRIORITY_OPTIONS.map(p => [p.value, p])
)
