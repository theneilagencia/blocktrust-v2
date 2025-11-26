import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { clsx } from 'clsx'

interface FileDropProps {
  onFileSelect: (file: File) => void
  accept?: string
}

export default function FileDrop({ onFileSelect, accept }: FileDropProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
  }, [onFileSelect])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      onFileSelect(files[0])
    }
  }

  return (
    <div
      className={clsx(
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
        isDragging ? 'border-brand-blue bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      )}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
      <p className="text-gray-600 mb-2">Arraste e solte seu arquivo aqui</p>
      <p className="text-sm text-gray-500 mb-4">ou</p>
      <label className="btn-primary cursor-pointer inline-block">
        Selecionar Arquivo
        <input
          type="file"
          className="hidden"
          onChange={handleFileInput}
          accept={accept}
        />
      </label>
    </div>
  )
}

