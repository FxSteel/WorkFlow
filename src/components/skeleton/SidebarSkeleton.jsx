import Skeleton from '../ui/Skeleton'
import { cn } from '../../lib/utils'

/**
 * Skeleton for the workspace list area inside the sidebar.
 * Used when workspaces are still loading.
 */
export default function SidebarSkeleton() {
  return (
    <div className="space-y-1">
      {/* Workspaces label */}
      <div className="px-2 mb-2">
        <Skeleton className="h-3 w-32" />
      </div>

      {/* Workspace items */}
      {[1, 2, 3].map((ws) => (
        <div key={ws}>
          {/* Workspace row */}
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="w-3.5 h-3.5 rounded-sm" />
            <Skeleton className="w-5 h-5 rounded" />
            <Skeleton className={cn('h-3.5', ws === 1 ? 'w-28' : ws === 2 ? 'w-20' : 'w-24')} />
          </div>

          {/* Boards under first 2 workspaces */}
          {ws <= 2 && (
            <div className="ml-8 mt-0.5 space-y-0.5">
              {Array.from({ length: ws === 1 ? 3 : 2 }).map((_, bi) => (
                <div key={bi} className="flex items-center gap-2 px-2 py-1">
                  <Skeleton className="w-3.5 h-3.5 rounded" />
                  <Skeleton className={cn('h-3', ['w-24', 'w-16', 'w-20'][bi] || 'w-18')} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Full sidebar skeleton including logo, nav items, and workspaces.
 * Used as a standalone placeholder for the entire sidebar.
 */
export function FullSidebarSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Logo area */}
      <div className="p-3 flex items-center gap-2 border-b border-sidebar-border">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Nav items */}
      <div className="p-2 space-y-0.5">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2 px-2 py-1.5">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className={cn('h-3.5', i === 1 ? 'w-14' : 'w-16')} />
          </div>
        ))}
      </div>

      {/* Workspace content */}
      <div className="px-2 py-2">
        <SidebarSkeleton />
      </div>
    </div>
  )
}
