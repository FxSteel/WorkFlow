import { cn } from '../../lib/utils'

const STATUS_CONFIG = {
  online: {
    color: 'bg-emerald-500',
    ring: 'ring-emerald-500/30',
    label: 'En línea',
  },
  idle: {
    color: 'bg-yellow-500',
    ring: 'ring-yellow-500/30',
    label: 'Ausente',
  },
  dnd: {
    color: 'bg-red-500',
    ring: 'ring-red-500/30',
    label: 'No molestar',
  },
  invisible: {
    color: 'bg-gray-400 dark:bg-gray-500',
    ring: 'ring-gray-400/30',
    label: 'Invisible',
  },
}

export { STATUS_CONFIG }

export default function StatusAvatar({
  src,
  name,
  size = 'md',
  status = 'online',
  showStatus = true,
  bgColor,
  className,
  onClick,
}) {
  const initial = name?.[0]?.toUpperCase() || '?'
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.online

  const sizes = {
    xs: { avatar: 'w-5 h-5 text-[8px]', dot: 'w-2 h-2 -bottom-0 -right-0', ring: 'ring-1' },
    sm: { avatar: 'w-6 h-6 text-[9px]', dot: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5', ring: 'ring-1' },
    md: { avatar: 'w-8 h-8 text-[11px]', dot: 'w-3 h-3 -bottom-0.5 -right-0.5', ring: 'ring-[2px]' },
    lg: { avatar: 'w-10 h-10 text-sm', dot: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5', ring: 'ring-2' },
    xl: { avatar: 'w-14 h-14 text-lg', dot: 'w-4 h-4 -bottom-0.5 -right-0.5', ring: 'ring-2' },
  }

  const s = sizes[size] || sizes.md

  return (
    <button
      onClick={onClick}
      className={cn('relative inline-flex shrink-0', className)}
      type="button"
    >
      {src ? (
        <img
          src={src}
          alt={name || ''}
          className={cn(s.avatar, 'rounded-full object-cover')}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={cn(
            s.avatar,
            'rounded-full flex items-center justify-center font-semibold text-white',
            !bgColor && 'bg-primary text-primary-foreground'
          )}
          style={bgColor ? { backgroundColor: bgColor } : undefined}
        >
          {initial}
        </div>
      )}

      {/* Status indicator */}
      {showStatus && status !== 'invisible' && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-card',
            s.dot,
            config.color
          )}
        >
          {status === 'dnd' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-[60%] h-[2px] rounded-full bg-white" />
            </span>
          )}
          {status === 'idle' && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-[45%] h-[45%] rounded-full bg-card absolute top-[15%] left-[15%]" />
            </span>
          )}
        </span>
      )}

      {/* Invisible: hollow circle */}
      {showStatus && status === 'invisible' && (
        <span
          className={cn(
            'absolute rounded-full border-2 border-card',
            s.dot,
          )}
        >
          <span className={cn(
            'absolute inset-0 rounded-full border-2',
            'border-gray-400 dark:border-gray-500 bg-card'
          )} />
        </span>
      )}
    </button>
  )
}
