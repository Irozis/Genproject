import { useRef, useState } from 'react'

type Props = {
  label: string
  accept?: string
  onFile: (dataUrl: string, file: File) => void
  hint?: string
}

export function FilePicker({ label, accept = 'image/*', onFile, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  function handle(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : ''
      if (url) onFile(url, file)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className={`file-picker${drag ? ' is-drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer.files?.[0]
        if (f) handle(f)
      }}
    >
      <button type="button" className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
        {label}
      </button>
      {hint ? <span className="file-picker__hint">{hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handle(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}
