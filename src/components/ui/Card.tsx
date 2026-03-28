import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  action?: ReactNode
  style?: React.CSSProperties
}

export function Card({ children, className, title, action, style }: CardProps) {
  return (
    <div className={clsx(
      'rounded-xl border border-gray-200 bg-white p-4 shadow-sm',
      'dark:border-[var(--color-border-dark)] dark:bg-[var(--color-bg-card-dark)]',
      className
    )}
    style={style}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
