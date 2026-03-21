import Skeleton from '../ui/Skeleton'
import { cn } from '../../lib/utils'

export default function HomeSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Greeting */}
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-8 w-32" />
        </div>

        {/* Recent boards carousel */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 w-32" />
          </div>

          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[200px] h-[120px] rounded-xl border border-border overflow-hidden bg-card"
              >
                <Skeleton className="h-1.5 w-full rounded-none" />
                <div className="p-3 flex flex-col justify-between h-[calc(100%-6px)]">
                  <div className="flex items-start gap-2">
                    <Skeleton className="w-8 h-8 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <Skeleton className={cn('h-4 mb-1.5', i % 2 === 0 ? 'w-24' : 'w-20')} />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-2.5 w-14" />
                    <Skeleton className="w-3.5 h-3.5 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming tasks table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-4 h-4 rounded" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3.5 w-6" />
          </div>

          <div className="rounded-xl border border-border overflow-hidden bg-card">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_140px_100px_100px_90px] gap-0 bg-muted/50 border-b border-border">
              <div className="px-4 py-2.5">
                <Skeleton className="h-3 w-10" />
              </div>
              <div className="px-3 py-2.5">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="px-3 py-2.5 flex justify-center">
                <Skeleton className="h-3 w-12" />
              </div>
              <div className="px-3 py-2.5 flex justify-center">
                <Skeleton className="h-3 w-14" />
              </div>
              <div className="px-3 py-2.5 flex justify-center">
                <Skeleton className="h-3 w-10" />
              </div>
            </div>

            {/* Task rows */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_140px_100px_100px_90px] gap-0 border-b border-border last:border-b-0"
              >
                {/* Task title */}
                <div className="px-4 py-3 flex items-center gap-2">
                  <div className="min-w-0">
                    <Skeleton className={cn('h-3.5 mb-1.5', ['w-44', 'w-36', 'w-52', 'w-40', 'w-32'][i - 1])} />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                {/* Workspace */}
                <div className="px-3 py-3 flex items-center gap-1.5">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {/* Status */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                {/* Priority */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Skeleton className="h-5 w-12 rounded" />
                </div>
                {/* Date */}
                <div className="px-3 py-3 flex items-center justify-center">
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
