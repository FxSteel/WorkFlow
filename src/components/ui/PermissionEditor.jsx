import { useState } from 'react'
import {
  ChevronDown, ChevronRight, Shield, ShieldCheck, ShieldAlert, Eye,
  Sparkles,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  PERMISSION_CATEGORIES,
  ROLE_PRESETS,
  ALL_PERMISSION_KEYS,
  detectRole,
} from '../../hooks/usePermissions'

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', description: 'Acceso total a la organización', icon: ShieldCheck, color: 'text-blue-500' },
  { value: 'member', label: 'Miembro', description: 'Crear y editar tareas', icon: Shield, color: 'text-foreground' },
  { value: 'viewer', label: 'Visualizador', description: 'Solo puede ver y comentar', icon: Eye, color: 'text-orange-500' },
]

export default function PermissionEditor({ permissions, onChange, role, onRoleChange, compact = false }) {
  const [expandedCategories, setExpandedCategories] = useState(
    compact ? {} : { workspaces: true, boards: true, tasks: true }
  )

  const detectedRole = detectRole(permissions)
  const isCustom = detectedRole === 'custom'

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }))
  }

  const handleRoleSelect = (newRole) => {
    onRoleChange?.(newRole)
    // Apply preset permissions
    const preset = ROLE_PRESETS[newRole]
    if (preset) {
      onChange({ ...preset })
    }
  }

  const handleToggle = (key) => {
    const updated = { ...permissions, [key]: !permissions[key] }
    onChange(updated)
    // Check if the toggle made it match a different role
    const matched = detectRole(updated)
    if (matched !== 'custom' && matched !== role) {
      onRoleChange?.(matched)
    }
  }

  const toggleAll = (catId, value) => {
    const cat = PERMISSION_CATEGORIES.find(c => c.id === catId)
    if (!cat) return
    const updated = { ...permissions }
    cat.permissions.forEach(p => { updated[p.key] = value })
    onChange(updated)
    const matched = detectRole(updated)
    if (matched !== 'custom' && matched !== role) {
      onRoleChange?.(matched)
    }
  }

  const getCategoryStatus = (cat) => {
    const total = cat.permissions.length
    const enabled = cat.permissions.filter(p => permissions[p.key]).length
    if (enabled === total) return 'all'
    if (enabled === 0) return 'none'
    return 'partial'
  }

  return (
    <div className="space-y-4">
      {/* Role Presets */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Rol base</label>
        <div className="grid grid-cols-3 gap-2">
          {ROLE_OPTIONS.map(opt => {
            const Icon = opt.icon
            const isActive = role === opt.value && !isCustom
            return (
              <button
                key={opt.value}
                onClick={() => handleRoleSelect(opt.value)}
                className={cn(
                  'flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all',
                  isActive
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-primary' : opt.color)} />
                  <span className={cn('text-sm font-medium', isActive ? 'text-primary' : 'text-foreground')}>
                    {opt.label}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5">{opt.description}</span>
              </button>
            )
          })}
        </div>
        {isCustom && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Permisos personalizados</span>
          </div>
        )}
      </div>

      {/* Granular Permissions */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Permisos detallados</label>
        <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
          {PERMISSION_CATEGORIES.map(cat => {
            const isExpanded = expandedCategories[cat.id]
            const status = getCategoryStatus(cat)
            // Hide danger zone for non-owner
            if (cat.id === 'danger' && role !== 'owner') return null

            return (
              <div key={cat.id}>
                {/* Category Header */}
                <div
                  className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => toggleCategory(cat.id)}
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  }
                  <span className="text-xs font-semibold text-foreground flex-1">{cat.label}</span>
                  {/* Category summary */}
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                      status === 'all' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : status === 'none' ? 'bg-muted text-muted-foreground'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    )}>
                      {cat.permissions.filter(p => permissions[p.key]).length}/{cat.permissions.length}
                    </span>
                    {/* Toggle all button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleAll(cat.id, status !== 'all')
                      }}
                      className={cn(
                        'w-8 h-[18px] rounded-full transition-colors relative shrink-0',
                        status === 'all' ? 'bg-primary' : 'bg-muted-foreground/20'
                      )}
                    >
                      <div className={cn(
                        'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all',
                        status === 'all' ? 'left-[17px]' : 'left-[2px]'
                      )} />
                    </button>
                  </div>
                </div>

                {/* Permission Rows */}
                {isExpanded && (
                  <div className="bg-muted/20">
                    {cat.permissions.map(perm => {
                      const enabled = permissions[perm.key] || false
                      return (
                        <div
                          key={perm.key}
                          className="flex items-center gap-3 px-3 py-2 pl-9 hover:bg-accent/20 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground">{perm.label}</div>
                            <div className="text-[10px] text-muted-foreground">{perm.description}</div>
                          </div>
                          <button
                            onClick={() => handleToggle(perm.key)}
                            className={cn(
                              'w-8 h-[18px] rounded-full transition-colors relative shrink-0',
                              enabled ? 'bg-primary' : 'bg-muted-foreground/20'
                            )}
                          >
                            <div className={cn(
                              'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all',
                              enabled ? 'left-[17px]' : 'left-[2px]'
                            )} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
