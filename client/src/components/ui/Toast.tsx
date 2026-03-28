import { useState, useCallback } from 'react'

interface ToastProps { message: string; type: 'success' | 'error'; visible: boolean }

export function Toast({ message, type, visible }: ToastProps) {
  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem',
      background: 'var(--surface)', border: `1px solid ${type === 'success' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}`,
      color: type === 'success' ? 'var(--green)' : 'var(--red)',
      borderRadius: 8, padding: '0.75rem 1.25rem', fontSize: '0.875rem',
      zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      transform: visible ? 'translateY(0)' : 'translateY(100px)',
      opacity: visible ? 1 : 0, transition: 'all 0.3s', pointerEvents: 'none',
    }}>
      {message}
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'error', visible: false })
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type, visible: true })
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000)
  }, [])
  return { toast, showToast }
}
