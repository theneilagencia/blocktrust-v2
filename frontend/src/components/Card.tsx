import { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string
}

export default function Card({ title, children, className, ...props }: CardProps) {
  return (
    <div className={clsx('card', className)} {...props}>
      {title && <h3 className="text-xl font-bold mb-4">{title}</h3>}
      {children}
    </div>
  )
}

