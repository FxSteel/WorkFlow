import * as LucideIcons from 'lucide-react'

// Build full icon list from lucide-react exports
// Lucide icons are forwardRef objects (typeof === 'object'), not functions
export const FIELD_ICONS = Object.entries(LucideIcons)
  .filter(([name, component]) =>
    /^[A-Z]/.test(name) &&
    component != null &&
    typeof component !== 'string' &&
    typeof component !== 'number' &&
    typeof component !== 'boolean' &&
    name !== 'createLucideIcon'
  )
  .map(([name, icon]) => ({ name, icon }))
  .sort((a, b) => a.name.localeCompare(b.name))

// Map name → component for fast lookup
export const FIELD_ICON_MAP = Object.fromEntries(FIELD_ICONS.map(i => [i.name, i.icon]))

// Resolve icon component by name, with a fallback
export function resolveFieldIcon(iconName, fallback) {
  if (iconName && FIELD_ICON_MAP[iconName]) return FIELD_ICON_MAP[iconName]
  return fallback || LucideIcons.Tag
}
