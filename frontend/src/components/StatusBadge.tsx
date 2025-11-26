import { clsx } from 'clsx'

interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info'
  children: React.ReactNode
}

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
        {
          'bg-green-100 text-green-800': status === 'success',
          'bg-yellow-100 text-yellow-800': status === 'warning',
          'bg-red-100 text-red-800': status === 'error',
          'bg-blue-100 text-blue-800': status === 'info',
        }
      )}
    >
      {children}
    </span>
  )
}

