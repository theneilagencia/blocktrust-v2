import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { clsx } from 'clsx'

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

let toastId = 0
const toasts: Toast[] = []
const listeners: ((toasts: Toast[]) => void)[] = []

export function showToast(type: ToastType, message: string) {
  const toast: Toast = {
    id: `toast-${toastId++}`,
    type,
    message,
  }
  toasts.push(toast)
  listeners.forEach(listener => listener([...toasts]))
  
  setTimeout(() => {
    const index = toasts.findIndex(t => t.id === toast.id)
    if (index > -1) {
      toasts.splice(index, 1)
      listeners.forEach(listener => listener([...toasts]))
    }
  }, 5000)
}

export default function Toaster() {
  const [toastList, setToastList] = useState<Toast[]>([])

  useEffect(() => {
    listeners.push(setToastList)
    return () => {
      const index = listeners.indexOf(setToastList)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  const removeToast = (id: string) => {
    const index = toasts.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.splice(index, 1)
      setToastList([...toasts])
    }
  }

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toastList.map(toast => {
        const Icon = icons[toast.type]
        return (
          <div
            key={toast.id}
            className={clsx(
              'flex items-center space-x-3 p-4 rounded-lg shadow-lg max-w-md',
              {
                'bg-green-50 text-green-900 border border-green-200': toast.type === 'success',
                'bg-red-50 text-red-900 border border-red-200': toast.type === 'error',
                'bg-blue-50 text-blue-900 border border-blue-200': toast.type === 'info',
              }
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

