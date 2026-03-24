import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Image, Briefcase, FileText, Users, Send, Loader } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { FeedPost, PostType } from '../types/feed'
import { AuthorAvatar } from './PostCard'
import ReferModal from './ReferModal'

interface ComposeModalProps {
  onClose: () => void
  onPosted: (post: FeedPost) => void
}

type ComposeView = 'main' | 'update' | 'refer'

const POST_TYPES: { type: PostType | 'refer'; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { type: 'project_update', label: 'Photo / Update', desc: 'Share a project, photo, or update', icon: <Image size={18} />, color: '#2563EB' },
  { type: 'job_post', label: 'Post a Job', desc: 'Hire for a role or position', icon: <Briefcase size={18} />, color: '#DC2626' },
  { type: 'bid_post', label: 'Open Bid', desc: 'Put work out to bid', icon: <FileText size={18} />, color: '#E85D04' },
  { type: 'refer', label: 'Refer a Trade', desc: 'Recommend a contractor', icon: <Users size={18} />, color: '#7C3AED' },
]

export default function ComposeModal({ onClose, onPosted }: ComposeModalProps) {
  const { profile, delegateSession, logDelegateAction, canDelegate } = useAuth()
  const navigate = useNavigate()
  const [view, setView] = useState<ComposeView>('main')
  const [selectedType, setSelectedType] = useState<PostType>('project_update')
  const [body, setBody] = useState('')
  const [hashtags, setHashtags] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (view === 'update') textareaRef.current?.focus()
  }, [view])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleTypeClick(type: PostType | 'refer') {
    if (type === 'job_post') {
      if (!canDelegate('job_post')) return
      onClose(); navigate('/jobs/post'); return
    }
    if (type === 'bid_post') {
      if (!canDelegate('bid')) return
      onClose(); navigate('/bids/post'); return
    }
    if (type === 'refer') { setView('refer'); return }
    setSelectedType(type as PostType)
    setView('update')
  }

  async function handleSubmit() {
    if (!body.trim() || !profile) return
    setSubmitting(true)
    setError('')

    const tags = hashtags.split(/[\s,#]+/).filter(Boolean)

    const { data, error: err } = await supabase
      .from('posts')
      .insert({
        author_id: profile.id,
        post_type: selectedType,
        body: body.trim(),
        hashtags: tags,
        is_urgent: urgent,
      })
      .select(`
        id, post_type, body, media_urls, hashtags, like_count, comment_count, share_count,
        is_urgent, is_boosted, created_at, author_id,
        users!author_id (display_name, handle, avatar_url, account_type)
      `)
      .single()

    if (err || !data) {
      setError('Failed to post. Please try again.')
      setSubmitting(false)
      return
    }

    const u = (data.users as unknown) as { display_name: string; handle: string; avatar_url: string | null; account_type: string } | null
    const feedPost: FeedPost = {
      id: data.id as string,
      post_type: data.post_type as PostType,
      body: data.body as string,
      media_urls: (data.media_urls as string[]) ?? [],
      hashtags: (data.hashtags as string[]) ?? [],
      like_count: data.like_count as number,
      comment_count: data.comment_count as number,
      share_count: data.share_count as number,
      is_urgent: data.is_urgent as boolean,
      is_boosted: data.is_boosted as boolean,
      created_at: data.created_at as string,
      author_id: data.author_id as string,
      author_name: u?.display_name ?? profile.display_name ?? 'You',
      author_handle: u?.handle ?? profile.handle ?? '',
      author_avatar: u?.avatar_url ?? profile.avatar_url ?? null,
      author_account_type: u?.account_type ?? profile.account_type ?? '',
      author_trade: null,
      author_verified: false,
    }

    if (delegateSession) {
      void logDelegateAction('create_post', { post_id: data.id, post_type: selectedType })
    }
    onPosted(feedPost)
    onClose()
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {view === 'refer' ? (
        <ReferModal onClose={onClose} onPosted={onPosted} />
      ) : (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          width: '100%', maxWidth: 520,
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
            <h2 style={{ fontFamily: 'var(--font-condensed)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.3px' }}>
              {view === 'main' ? 'Create a Post' : 'Share an Update'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {view === 'main' ? (
            <div style={{ padding: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>What would you like to share?</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {POST_TYPES.filter(pt => {
                  if (pt.type === 'job_post') return canDelegate('job_post')
                  if (pt.type === 'bid_post') return canDelegate('bid')
                  return true
                }).map(pt => (
                  <button
                    key={String(pt.type)}
                    onClick={() => handleTypeClick(pt.type)}
                    style={{
                      display: 'flex', flexDirection: 'column', gap: 8,
                      padding: '16px 14px',
                      background: 'var(--color-bg)',
                      border: '1.5px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = pt.color
                      e.currentTarget.style.background = `${pt.color}0d`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--color-border)'
                      e.currentTarget.style.background = 'var(--color-bg)'
                    }}
                  >
                    <div style={{ color: pt.color }}>{pt.icon}</div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.2px' }}>
                        {pt.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, lineHeight: 1.4 }}>
                        {pt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              {profile && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                  <AuthorAvatar name={profile.display_name ?? 'You'} avatar={profile.avatar_url ?? null} size={36} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{profile.display_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Posting as {selectedType.replace('_', ' ')}</div>
                  </div>
                </div>
              )}

              <textarea
                ref={textareaRef}
                placeholder="Share what's happening on your project, a tip, or a safety update..."
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={5}
                style={{
                  width: '100%', border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', padding: '10px 12px',
                  fontSize: 14, resize: 'none', outline: 'none', lineHeight: 1.6,
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                }}
              />

              <input
                type="text"
                placeholder="Hashtags (e.g. Austin Electrical Safety)"
                value={hashtags}
                onChange={e => setHashtags(e.target.value)}
                style={{
                  width: '100%', marginTop: 10,
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', padding: '8px 12px',
                  fontSize: 13, outline: 'none',
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
                }}
              />

              {selectedType === 'job_post' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ accentColor: 'var(--color-brand)' }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Mark as Urgent Hire</span>
                </label>
              )}

              {error && <p style={{ fontSize: 13, color: '#e05252', marginTop: 10 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button onClick={() => setView('main')} className="btn btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>
                  Back
                </button>
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!body.trim() || submitting}
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {submitting ? <Loader size={13} className="spin" /> : <Send size={13} />}
                  {submitting ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
