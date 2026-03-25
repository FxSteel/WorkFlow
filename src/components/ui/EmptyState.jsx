import { useTheme } from '../../context/ThemeContext'

function getImage(theme, soft) {
  if (theme === 'dark') return soft ? '/empty-dark-soft.png' : '/empty-dark.png'
  return '/empty-light.png'
}

export default function EmptyState({ title, description, compact = false, soft = false }) {
  const { theme } = useTheme()
  const imgSrc = getImage(theme, soft)

  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <img
          src={imgSrc}
          alt=""
          className="w-36 h-auto mb-3 select-none pointer-events-none"
          draggable={false}
        />
        {title && <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>}
        {description && <p className="text-xs text-muted-foreground text-center max-w-[240px] leading-relaxed">{description}</p>}
      </div>
    )
  }

  // Full-size: absolute center within the board content area
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-4 pointer-events-none">
      <img
        src={imgSrc}
        alt=""
        className="w-64 h-auto mb-5 select-none"
        draggable={false}
      />
      {title && <h3 className="text-base font-semibold text-foreground mb-1.5">{title}</h3>}
      {description && <p className="text-sm text-muted-foreground text-center max-w-[320px] leading-relaxed">{description}</p>}
    </div>
  )
}
