import { useCallback, useEffect, useState } from 'react'

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

// Reads text aloud with the browser's built-in voices; one utterance at a time
export function useSpeech() {
  const [speakingId, setSpeakingId] = useState(null)

  useEffect(() => () => supported && window.speechSynthesis.cancel(), [])

  const toggle = useCallback((id, text, lang) => {
    if (!supported) return
    const synth = window.speechSynthesis
    synth.cancel()
    if (speakingId === id) return setSpeakingId(null)

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang === 'he' ? 'he-IL' : 'en-US'
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith(lang === 'he' ? 'he' : 'en'))
    if (voice) utterance.voice = voice
    utterance.rate = 0.95
    utterance.onend = utterance.onerror = () => setSpeakingId((current) => (current === id ? null : current))
    setSpeakingId(id)
    synth.speak(utterance)
  }, [speakingId])

  return { supported, speakingId, toggle }
}
