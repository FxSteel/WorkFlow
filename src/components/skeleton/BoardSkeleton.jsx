import Skeleton from '../ui/Skeleton'
import { cn } from '../../lib/utils'

function TaskRowSkeleton({ index }) {
  const widths = ['w-40', 'w-32', 'w-48', 'w-36', 'w-28', 'w-44']
  return (
    <div className="grid grid-cols-[minmax(250px,2fr)_120px_110px_110px_100px_100px_70px] gap-0 border-b border-border">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className={cn('h-3.5', widths[index % widths.length])} />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-center">
        <Skeleton className="w-6 h-6 rounded-full" />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-center">
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-center">
        <Skeleton className="h-4 w-20 rounded" />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-center">
        <Skeleton className="h-5 w-14 rounded" />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-center">
        <Skeleton className="h-4 w-14 rounded" />
      </div>
      <div className="px-3 py-2.5 flex items-center justify-center">
        <Skeleton className="w-5 h-5 rounded" />
      </div>
    </div>
  )
}

function SprintSectionSkeleton({ taskCount, nameWidth }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="w-4 h-4 rounded-sm" />
        <Skeleton className="w-3 h-3 rounded-full" />
        <Skeleton className={cn('h-4', nameWidth)} />
        <Skeleton className="h-3 w-12" />
        <div className="flex-1" />
        <Skeleton className="w-24 h-1.5 rounded-full" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="grid grid-cols-[minmax(250px,2fr)_120px_110px_110px_100px_100px_70px] gap-0 bg-muted/50 border-b border-border">
          <div className="px-3 py-2"><Skeleton className="h-3 w-10" /></div>
          <div className="px-3 py-2 flex justify-center"><Skeleton className="h-3 w-16" /></div>
          <div className="px-3 py-2 flex justify-center"><Skeleton className="h-3 w-12" /></div>
          <div className="px-3 py-2 flex justify-center"><Skeleton className="h-3 w-10" /></div>
          <div className="px-3 py-2 flex justify-center"><Skeleton className="h-3 w-14" /></div>
          <div className="px-3 py-2 flex justify-center"><Skeleton className="h-3 w-12" /></div>
          <div className="px-3 py-2" />
        </div>
        {Array.from({ length: taskCount }).map((_, i) => (
          <TaskRowSkeleton key={i} index={i} />
        ))}
        <div className="px-3 py-2 border-t border-border flex items-center gap-2">
          <Skeleton className="w-3.5 h-3.5 rounded" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  )
}

export default function BoardSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
        <Skeleton className="h-7 w-16 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <div className="flex-1 overflow-auto p-4">
        <SprintSectionSkeleton taskCount={4} nameWidth="w-24" />
        <SprintSectionSkeleton taskCount={3} nameWidth="w-32" />
      </div>
    </div>
  )
}
