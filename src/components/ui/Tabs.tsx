import { clsx } from 'clsx'

interface TabsProps {
  tabs: { label: string; value: string }[]
  active: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
}

export function Tabs({ tabs, active, onChange, size = 'md' }: TabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={clsx(
            'rounded-md font-medium transition-colors',
            {
              'px-2 py-1 text-xs': size === 'sm',
              'px-3 py-1.5 text-sm': size === 'md',
            },
            active === tab.value
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
