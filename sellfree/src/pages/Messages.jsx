import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, SendHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import CategoryIcon from '@/components/CategoryIcon'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

const THREAD_POLL_MS = 3000
const LIST_POLL_MS = 10_000

function Thumb({ listing, className }) {
  return (
    <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted', className)}>
      {listing.image ? <img src={listing.image} alt="" className="size-full object-cover" /> : <CategoryIcon category={listing.category} className="size-4 text-muted-foreground/50" />}
    </div>
  )
}

function ConversationList({ conversations }) {
  const { t, listingText, formatTime } = useI18n()

  if (!conversations.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <MessageCircle className="size-8 text-muted-foreground/50" />
        <p className="font-medium">{t('messages.empty')}</p>
        <p className="text-sm text-muted-foreground">{t('messages.emptyHint')}</p>
      </div>
    )
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {conversations.map((c) => (
        <li key={c.id}>
          <NavLink
            to={`/messages/${c.id}`}
            className={({ isActive }) => cn('flex gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/50', isActive && 'bg-muted')}
          >
            <Thumb listing={c.listing} className="size-11" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('truncate text-sm', c.unread ? 'font-semibold' : 'font-medium')}>{c.otherName}</span>
                {c.lastMessage && <span className="shrink-0 text-xs text-muted-foreground">{formatTime(c.lastMessage.createdAt)}</span>}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {c.role === 'buyer' ? t('messages.buying') : t('messages.selling')} · {listingText(c.listing, 'title')}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p dir="auto" className={cn('truncate text-sm text-start', c.unread ? 'text-foreground' : 'text-muted-foreground')}>
                  {c.lastMessage ? (c.lastMessage.mine ? t('messages.you', { body: c.lastMessage.body }) : c.lastMessage.body) : t('messages.start')}
                </p>
                {c.unread > 0 && <Badge className="h-5 min-w-5 rounded-full px-1.5">{c.unread}</Badge>}
              </div>
            </div>
          </NavLink>
        </li>
      ))}
    </ul>
  )
}

function Thread({ id, onActivity }) {
  const { t, errorText, listingText, formatPrice, formatTime } = useI18n()
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const lastId = useRef(0)
  const bottom = useRef(null)

  // Polls and sends can overlap, so merge by id
  const append = useCallback((incoming) => {
    if (!incoming.length) return
    lastId.current = Math.max(lastId.current, ...incoming.map((m) => m.id))
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      return [...prev, ...incoming.filter((m) => !seen.has(m.id))]
    })
  }, [])

  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const d = await api(`/conversations/${id}?after=${lastId.current}`)
        if (!active) return
        setConversation(d.conversation)
        if (d.messages.length) {
          append(d.messages)
          onActivity()
        }
      } catch (err) {
        if (active) setError(err)
      }
    }
    poll()
    const timer = setInterval(poll, THREAD_POLL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [id, append, onActivity])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const send = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const { message } = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body } })
      append([message])
      setDraft('')
      onActivity()
    } catch (err) {
      setError(err)
    } finally {
      setSending(false)
    }
  }

  if (error && !conversation) {
    return <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">{errorText(error)}</div>
  }
  if (!conversation) {
    return <div className="flex flex-1 items-center justify-center p-6 text-muted-foreground">{t('common.loading')}</div>
  }

  const { listing } = conversation

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="-ms-2 md:hidden" asChild>
          <Link to="/messages" aria-label={t('common.back')}>
            <ArrowLeft className="rtl:-scale-x-100" />
          </Link>
        </Button>
        <Link to={`/listing/${listing.id}`} className="flex min-w-0 items-center gap-3 hover:underline">
          <Thumb listing={listing} className="size-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{conversation.otherName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {listingText(listing, 'title')} · {formatPrice(listing.price, listing.currency)}
              {listing.status === 'sold' && ` · ${t('listing.sold')}`}
            </p>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t('messages.start')}</p>}
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex max-w-[80%] flex-col gap-0.5', m.mine ? 'items-end self-end' : 'items-start self-start')}>
              <div
                dir="auto"
                className={cn(
                  'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm',
                  m.mine ? 'rounded-ee-sm bg-primary text-primary-foreground' : 'rounded-es-sm bg-muted'
                )}
              >
                {m.body}
              </div>
              <span className="px-1 text-[11px] text-muted-foreground">{formatTime(m.createdAt)}</span>
            </div>
          ))}
        </div>
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input
          autoFocus
          placeholder={t('messages.placeholder')}
          value={draft}
          maxLength={2000}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={!draft.trim() || sending}>
          <SendHorizontal className="rtl:-scale-x-100" />
          <span className="hidden sm:inline">{t('messages.send')}</span>
        </Button>
      </form>
    </>
  )
}

export default function Messages() {
  const { id } = useParams()
  const { t, errorText } = useI18n()
  const [conversations, setConversations] = useState(null)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    api('/conversations')
      .then((d) => setConversations(d.conversations))
      .catch(setError)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, LIST_POLL_MS)
    return () => clearInterval(timer)
  }, [refresh, id])

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <Card className="grid h-[calc(100dvh-7rem)] grid-cols-1 gap-0 overflow-hidden py-0 md:grid-cols-[320px_1fr]">
        <aside className={cn('flex min-h-0 flex-col border-e', id && 'hidden md:flex')}>
          <h1 className="border-b px-4 py-4 text-lg font-semibold">{t('messages.title')}</h1>
          {error ? (
            <p className="p-4 text-sm text-muted-foreground">{errorText(error)}</p>
          ) : !conversations ? (
            <p className="p-4 text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <ConversationList conversations={conversations} />
          )}
        </aside>
        <section className={cn('flex min-h-0 flex-col', !id && 'hidden md:flex')}>
          {id ? (
            <Thread key={id} id={id} onActivity={refresh} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">{t('messages.select')}</div>
          )}
        </section>
      </Card>
    </main>
  )
}
