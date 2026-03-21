import Skeleton from '../ui/Skeleton'
import { cn } from '../../lib/utils'

const COLUMN_BORDERS = [
  'border-t-gray-400',
  'border-t-blue-500',
  'border-t-yellow-500',
  'border-t-emerald-500',
  'border-t-red-500',
]

function KanbanCardSkeleton({ variant }) {
  const titleWidths = ['w-32', 'w-24', 'w-40']
  return (
    <div className="p-3 rounded-lg border border-border bg-card">
      <Skeleton className={cn('h-3.5 mb-2', titleWidths[variant % titleWidths.length])} />
      <Skeleton className="h-3 w-20 mb-3" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="w-5 h-5 rounded-full" />
          <Skeleton className="h-4 w-12 rounded" />
        </div>
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
    </div>
  )
}

export default function KanbanSkeleton() {
  const cardCounts = [3, 2, 2, 3, 2]

  return (
    <div className="flex-1 overflow-x-auto p-4">
      <div className="flex gap-4 min-w-max">
        {cardCounts.map((count, colIdx) => (
          <div
            key={colIdx}
            className={cn(
              'w-[280px] rounded-xl border border-border bg-muted/30 border-t-4',
              COLUMN_BORDERS[colIdx]
            )}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className={cn('h-4', colIdx % 2 === 0 ? 'w-20' : 'w-24')} />
                <Skeleton className="h-4 w-5 rounded-full" />
              </div>
              <Skeleton className="w-5 h-5 rounded" />
            </div>

            {/* Cards */}
            <div className="px-2.5 pb-2.5 space-y-2">
              {Array.from({ length: count }).map((_, cardIdx) => (
                <KanbanCardSkeleton key={cardIdx} variant={colIdx + cardIdx} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
