import { clsx } from 'clsx'

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={clsx(
      'animate-spin rounded-full border-2 border-gray-300 border-t-blue-600',
      {
        'h-4 w-4': size === 'sm',
        'h-6 w-6': size === 'md',
        'h-10 w-10': size === 'lg',
      },
      className
    )} />
  )
}
