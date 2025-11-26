import { Copy, Check } from 'lucide-react'
import { useState } from 'react'

interface HashFieldProps {
  hash: string
  label?: string
}

export default function HashField({ hash, label = 'Hash SHA-256' }: HashFieldProps) {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={hash}
          readOnly
          className="input-field font-mono text-sm flex-1"
        />
        <button
          onClick={copyToClipboard}
          className="btn-secondary flex items-center space-x-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copiado!' : 'Copiar'}</span>
        </button>
      </div>
    </div>
  )
}

