import { cn } from '../../lib/utils'

export default function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-muted', className)}
      {...props}
    />
  )
}
