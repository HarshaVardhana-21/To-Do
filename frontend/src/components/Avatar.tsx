import { cn, initialsOf } from '../lib/utils'

interface AvatarProps {
  name: string
  src: string | null
  className?: string
}

/** The user's picture, or their initials when they haven't set one. */
export function Avatar({ name, src, className }: AvatarProps) {
  const base = cn('flex shrink-0 items-center justify-center overflow-hidden rounded-full', className ?? 'size-8 text-xs')
  if (src) return <img src={src} alt={`${name}'s profile picture`} className={cn(base, 'object-cover')} />
  return (
    <span
      className={cn(base, 'bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-100')}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  )
}
