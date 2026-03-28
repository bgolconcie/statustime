import { useState, useEffect } from 'react'

export function useLocalTime(timezone: string) {
  const [time, setTime] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    if (!timezone) return
    const tick = () => {
      try {
        setTime(new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: timezone }).format(new Date()))
        setDate(new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone }).format(new Date()))
      } catch {}
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [timezone])

  return { time, date }
}
