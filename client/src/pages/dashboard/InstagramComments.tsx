import { useEffect, useState } from 'react'
import { api } from '../../api'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useToast, Toast } from '../../components/ui/Toast'

interface Reply {
  id: string
  text: string
  username: string
  timestamp: string
}

interface Comment {
  id: string
  text: string
  username: string
  timestamp: string
  replies?: { data: Reply[] }
}

interface Post {
  id: string
  caption?: string
  media_url?: string
  thumbnail_url?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  timestamp: string
  permalink: string
  like_count?: number
  comments_count?: number
  comments?: { data: Comment[] }
}

const fmt = (ts: string) => new Date(ts).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const cardStyle: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 10, overflow: 'hidden',
}

const inputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0.45rem 0.75rem', fontSize: '0.82rem',
  color: 'var(--text)', fontFamily: 'Inter, sans-serif', outline: 'none',
}

const btnStyle = (variant: 'primary' | 'ghost' = 'primary'): React.CSSProperties => ({
  background: variant === 'primary' ? 'var(--accent)' : 'transparent',
  color: variant === 'primary' ? 'var(--bg)' : 'var(--muted)',
  border: variant === 'ghost' ? '1px solid var(--border)' : 'none',
  borderRadius: 6, padding: '0.45rem 0.85rem',
  fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
})

function CommentRow({ comment, onReply, onHide }: {
  comment: Comment
  onReply: (commentId: string, message: string) => Promise<void>
  onHide: (commentId: string) => Promise<void>
}) {
  const [reply, setReply] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleReply = async () => {
    if (!reply.trim()) return
    setLoading(true)
    await onReply(comment.id, reply)
    setReply('')
    setReplyOpen(false)
    setLoading(false)
  }

  return (
    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent)' }}>@{comment.username}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '0.5rem' }}>{fmt(comment.timestamp)}</span>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', lineHeight: 1.5 }}>{comment.text}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
          <button style={btnStyle('ghost')} onClick={() => setReplyOpen(r => !r)}>Reply</button>
          <button style={{ ...btnStyle('ghost'), color: 'var(--muted)', fontSize: '0.75rem' }} onClick={() => onHide(comment.id)}>Hide</button>
        </div>
      </div>

      {/* Existing replies */}
      {comment.replies?.data?.map(r => (
        <div key={r.id} style={{ marginTop: '0.5rem', marginLeft: '1.25rem', padding: '0.4rem 0.75rem', background: 'var(--surface)', borderRadius: 6, borderLeft: '2px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--accent)' }}>@{r.username}</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.4rem' }}>{fmt(r.timestamp)}</span>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>{r.text}</p>
        </div>
      ))}

      {/* Reply input */}
      {replyOpen && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', marginLeft: '1.25rem' }}>
          <input
            style={inputStyle}
            placeholder={`Reply to @${comment.username}...`}
            value={reply}
            onChange={e => setReply(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReply()}
            autoFocus
          />
          <button style={btnStyle()} onClick={handleReply} disabled={loading}>
            {loading ? '...' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}

function PostCard({ post, onReply, onHide }: {
  post: Post
  onReply: (commentId: string, message: string) => Promise<void>
  onHide: (commentId: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const comments = post.comments?.data || []

  return (
    <div style={cardStyle}>
      {/* Post header */}
      <div style={{ display: 'flex', gap: '1rem', padding: '1rem', alignItems: 'flex-start' }}>
        {(post.media_url && post.media_type !== 'VIDEO') ? (
          <img src={post.media_url} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
        ) : post.thumbnail_url ? (
          <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
            <img src={post.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
            <span style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.65rem', background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 4, padding: '1px 4px' }}>▶</span>
          </div>
        ) : (
          <div style={{ width: 72, height: 72, background: 'var(--surface)', borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>📷</div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{fmt(post.timestamp)}</span>
            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
              <span>❤️ {post.like_count ?? 0}</span>
              <span>💬 {post.comments_count ?? 0}</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {post.caption || <span style={{ color: 'var(--muted)' }}>(no caption)</span>}
          </p>
          {comments.length > 0 && (
            <button
              style={{ ...btnStyle('ghost'), marginTop: '0.5rem', fontSize: '0.75rem' }}
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? '▲ Hide' : '▼ Show'} {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Comments */}
      {expanded && comments.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {comments.map(c => (
            <CommentRow key={c.id} comment={c} onReply={onReply} onHide={onHide} />
          ))}
        </div>
      )}

      {expanded && comments.length === 0 && (
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.8rem', color: 'var(--muted)' }}>
          No comments yet.
        </div>
      )}
    </div>
  )
}

export function InstagramComments() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [username, setUsername] = useState<string>('')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const { toast, showToast } = useToast()

  useEffect(() => {
    api.integrations().then(ints => {
      const ig = ints.find((i: any) => i.platform === 'instagram')
      setConnected(!!ig)
      if (ig) loadPosts()
    }).catch(() => setConnected(false))
  }, [])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const data = await api.instagramPosts()
      setUsername(data.username)
      setPosts(data.posts)
    } catch (err: any) {
      showToast('Failed to load posts', 'error')
    }
    setLoading(false)
  }

  const connectInstagram = () =>
    api.instagramInstall().then((d: { url: string }) => window.location.href = d.url).catch(() => showToast('Failed', 'error'))

  const handleReply = async (commentId: string, message: string) => {
    try {
      await api.instagramReply(commentId, message)
      showToast('Reply sent')
      await loadPosts()
    } catch { showToast('Failed to send reply', 'error') }
  }

  const handleHide = async (commentId: string) => {
    try {
      await api.instagramHideComment(commentId)
      showToast('Comment hidden')
      await loadPosts()
    } catch { showToast('Failed to hide comment', 'error') }
  }

  if (connected === null) return null

  return (
    <>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Instagram Comments</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {connected && username ? `@${username} — view and reply to comments on your posts` : 'Connect your Instagram Business account'}
          </p>
        </div>
        {connected && (
          <button style={btnStyle('ghost')} onClick={loadPosts} disabled={loading}>
            {loading ? 'Loading...' : '↻ Refresh'}
          </button>
        )}
      </div>

      {!connected ? (
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📸</div>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Connect Instagram</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '1.5rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>
              Link your Instagram Business account to read and reply to comments directly from here.
            </p>
            <button style={btnStyle()} onClick={connectInstagram}>Connect Instagram</button>
          </div>
        </Card>
      ) : (
        <>
          {loading && posts.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>Loading posts...</div>
          ) : posts.length === 0 ? (
            <Card>
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>No posts found.</div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {posts.map(post => (
                <PostCard key={post.id} post={post} onReply={handleReply} onHide={handleHide} />
              ))}
            </div>
          )}
        </>
      )}

      <Toast {...toast} />
    </>
  )
}
