import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Plus, TrendingUp, UserPlus, Loader, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PostCard, { AuthorAvatar } from '../components/PostCard'
import FeedFilterBar from '../components/FeedFilterBar'
import ComposeModal from '../components/ComposeModal'
import { FeedPost, FilterType, SidebarUser, POST_TYPE_BADGE } from '../types/feed'
import { posts as mockPosts, users as mockUsers } from '../data/mockData'
import '../styles/feed.css'

function mockToFeedPost(p: typeof mockPosts[0]): FeedPost {
  return {
    id: p.id,
    post_type: p.post_type,
    body: p.content,
    media_urls: p.images ?? [],
    hashtags: p.tags,
    like_count: p.likes,
    comment_count: p.comments,
    share_count: p.shares,
    is_urgent: p.is_urgent ?? false,
    is_boosted: p.is_boosted ?? false,
    created_at: new Date(Date.now() - Math.random() * 86400000 * 5).toISOString(),
    author_id: p.author.id,
    author_name: p.author.name,
    author_handle: p.author.id,
    author_avatar: null,
    author_account_type: 'contractor',
    author_trade: p.author.trade,
    author_verified: p.author.verified,
  }
}

function compositeScore(post: FeedPost, connectedAuthorIds: Set<string>): number {
  const hoursOld = (Date.now() - new Date(post.created_at).getTime()) / 3600000
  const recencyScore = 1000 / (hoursOld + 1)
  const boostBonus = post.is_boosted ? 200 : 0
  const urgencyBonus = post.is_urgent ? 100 : 0
  const connectionBonus = connectedAuthorIds.has(post.author_id) ? 150 : 0
  return recencyScore + boostBonus + urgencyBonus + connectionBonus
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="feed-skeleton" style={{ width: 44, height: 44, borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="feed-skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
          <div className="feed-skeleton" style={{ height: 12, width: '25%' }} />
        </div>
        <div className="feed-skeleton" style={{ height: 22, width: 80, borderRadius: 12 }} />
      </div>
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="feed-skeleton" style={{ height: 13, width: '100%' }} />
        <div className="feed-skeleton" style={{ height: 13, width: '90%' }} />
        <div className="feed-skeleton" style={{ height: 13, width: '75%' }} />
      </div>
    </div>
  )
}

export default function Feed() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeFilter = (searchParams.get('type') ?? 'all') as FilterType

  const [posts, setPosts] = useState<FeedPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const pageRef = useRef(0)
  const PAGE_SIZE = 10

  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
  const [composeOpen, setComposeOpen] = useState(false)

  const [connectedAuthorIds, setConnectedAuthorIds] = useState<Set<string>>(new Set())
  const [sidebarUsers, setSidebarUsers] = useState<SidebarUser[]>([])
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())
  const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([])

  const [networkCount, setNetworkCount] = useState<number | null>(null)
  const [openJobsCount, setOpenJobsCount] = useState<number | null>(null)
  const [activeBidsCount, setActiveBidsCount] = useState<number | null>(null)
  const [myTrade, setMyTrade] = useState<string | null>(null)
  const [myLocation, setMyLocation] = useState<string | null>(null)

  const isContractor = profile?.account_type === 'contractor'

  async function enrichWithContractorProfiles(rawPosts: FeedPost[]): Promise<FeedPost[]> {
    if (rawPosts.length === 0) return rawPosts
    const authorIds = [...new Set(rawPosts.map(p => p.author_id))]
    const { data: cps } = await supabase
      .from('contractor_profiles')
      .select('user_id, primary_trade')
      .in('user_id', authorIds)
    if (!cps) return rawPosts
    const tradeMap = new Map(cps.map((c: { user_id: string; primary_trade: string | null }) => [c.user_id, c.primary_trade]))
    return rawPosts.map(p => ({ ...p, author_trade: tradeMap.get(p.author_id) ?? null }))
  }

  async function fetchConnectionIds(): Promise<Set<string>> {
    if (!profile) return new Set()
    const { data } = await supabase
      .from('connections')
      .select('requester_id, recipient_id')
      .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .eq('status', 'accepted')
    if (!data) return new Set()
    const ids = new Set<string>()
    data.forEach((c: { requester_id: string; recipient_id: string }) => {
      ids.add(c.requester_id === profile.id ? c.recipient_id : c.requester_id)
    })
    return ids
  }

  const fetchPosts = useCallback(async (reset: boolean) => {
    const currentPage = reset ? 0 : pageRef.current
    if (!reset) setLoadingMore(true)
    else setLoading(true)

    let query = supabase
      .from('posts')
      .select(`
        id, post_type, body, media_urls, hashtags, like_count, comment_count, share_count,
        is_urgent, is_boosted, created_at, author_id, tagged_user_id, linked_job_id, linked_rfq_id,
        users!author_id (display_name, handle, avatar_url, account_type)
      `)
      .order('is_boosted', { ascending: false })
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE - 1)

    if (activeFilter !== 'all') {
      query = query.eq('post_type', activeFilter)
    }

    const { data, error } = await query

    if (error || !data) {
      if (reset) {
        const filtered = activeFilter === 'all'
          ? mockPosts
          : mockPosts.filter(p => p.post_type === activeFilter)
        const mapped = filtered.map(mockToFeedPost)
        const scored = [...mapped].sort((a, b) =>
          compositeScore(b, connectedAuthorIds) - compositeScore(a, connectedAuthorIds)
        )
        setPosts(scored)
      }
      setLoading(false)
      setLoadingMore(false)
      return
    }

    const rawMapped: FeedPost[] = data.map((row: Record<string, unknown>) => {
      const u = (row.users as unknown) as { display_name: string; handle: string; avatar_url: string | null; account_type: string } | null
      return {
        id: row.id as string,
        post_type: row.post_type as FeedPost['post_type'],
        body: row.body as string,
        media_urls: (row.media_urls as string[]) ?? [],
        hashtags: (row.hashtags as string[]) ?? [],
        like_count: row.like_count as number,
        comment_count: row.comment_count as number,
        share_count: row.share_count as number,
        is_urgent: row.is_urgent as boolean,
        is_boosted: row.is_boosted as boolean,
        created_at: row.created_at as string,
        author_id: row.author_id as string,
        tagged_user_id: row.tagged_user_id as string | null,
        linked_job_id: row.linked_job_id as string | null,
        linked_rfq_id: row.linked_rfq_id as string | null,
        author_name: u?.display_name ?? 'Unknown',
        author_handle: u?.handle ?? '',
        author_avatar: u?.avatar_url ?? null,
        author_account_type: u?.account_type ?? '',
        author_trade: null,
        author_verified: false,
      }
    })

    const enriched = await enrichWithContractorProfiles(
      rawMapped.length > 0 ? rawMapped : (activeFilter === 'all' ? mockPosts : mockPosts.filter(p => p.post_type === activeFilter)).map(mockToFeedPost)
    )

    const scored = [...enriched].sort(
      (a, b) => compositeScore(b, connectedAuthorIds) - compositeScore(a, connectedAuthorIds)
    )

    if (reset) {
      setPosts(scored)
      pageRef.current = 1
    } else {
      setPosts(prev => [...prev, ...scored])
      pageRef.current = currentPage + 1
    }
    setHasMore(data.length === PAGE_SIZE)
    setLoading(false)
    setLoadingMore(false)
  }, [activeFilter, connectedAuthorIds])

  useEffect(() => {
    pageRef.current = 0
    void fetchPosts(true)
  }, [activeFilter])

  useEffect(() => {
    if (!profile) return
    void (async () => {
      const ids = await fetchConnectionIds()
      setConnectedAuthorIds(ids)
    })()
    void loadStats()
    void loadMyProfile()
  }, [profile])

  useEffect(() => {
    if (myTrade !== null) void loadSidebar()
  }, [myTrade, myLocation])

  useEffect(() => {
    void loadTrending()
  }, [])

  async function loadMyProfile() {
    if (!profile || !isContractor) return
    const { data } = await supabase
      .from('contractor_profiles')
      .select('primary_trade, location')
      .eq('user_id', profile.id)
      .single()
    if (data) {
      setMyTrade((data as { primary_trade: string | null; location: string | null }).primary_trade)
      setMyLocation((data as { primary_trade: string | null; location: string | null }).location)
    } else {
      setMyTrade('')
    }
  }

  async function loadSidebar() {
    if (!profile) return

    let query = supabase
      .from('contractor_profiles')
      .select('user_id, primary_trade, location, users!user_id (id, display_name, handle, avatar_url, account_type)')
      .neq('user_id', profile.id)
      .limit(4)

    if (myTrade) query = query.eq('primary_trade', myTrade)
    else if (myLocation) query = query.eq('location', myLocation)

    const { data } = await query

    if (!data || data.length === 0) {
      setSidebarUsers(mockUsers.slice(0, 4).map(u => ({
        id: u.id, display_name: u.name, handle: u.id,
        avatar_url: null, account_type: 'contractor',
        primary_trade: u.trade, location: u.location,
      })))
      return
    }

    setSidebarUsers(data.map((cp: Record<string, unknown>) => {
      const u = (cp.users as unknown) as { id: string; display_name: string; handle: string; avatar_url: string | null; account_type: string } | null
      return {
        id: u?.id ?? cp.user_id as string,
        display_name: u?.display_name ?? 'Unknown',
        handle: u?.handle ?? '',
        avatar_url: u?.avatar_url ?? null,
        account_type: u?.account_type ?? 'contractor',
        primary_trade: cp.primary_trade as string | null,
        location: cp.location as string | null,
      }
    }))
  }

  async function loadStats() {
    if (!profile) return

    const { count: nc } = await supabase
      .from('connections')
      .select('*', { count: 'exact', head: true })
      .or(`requester_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .eq('status', 'accepted')
    setNetworkCount(nc ?? 0)

    if (isContractor) {
      const { count: bc } = await supabase
        .from('bids')
        .select('*', { count: 'exact', head: true })
        .eq('contractor_id', profile.id)
        .eq('status', 'submitted')
      setActiveBidsCount(bc ?? 0)

      const { count: jc } = await supabase
        .from('job_listings')
        .select('*', { count: 'exact', head: true })
        .eq('poster_id', profile.id)
        .eq('status', 'open')
      setOpenJobsCount(jc ?? 0)
    } else {
      const { count: jc } = await supabase
        .from('job_listings')
        .select('*', { count: 'exact', head: true })
        .eq('poster_id', profile.id)
        .eq('status', 'open')
      setOpenJobsCount(jc ?? 0)
    }
  }

  async function loadTrending() {
    const { data } = await supabase
      .from('posts')
      .select('hashtags')
      .order('created_at', { ascending: false })
      .limit(60)

    if (!data || data.length === 0) {
      const tagMap = new Map<string, number>()
      mockPosts.flatMap(p => p.tags).forEach(t => tagMap.set(t, (tagMap.get(t) ?? 0) + 1))
      setTrendingTags(
        Array.from(tagMap.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
      )
      return
    }

    const tagMap = new Map<string, number>()
    data.forEach((row: { hashtags: string[] }) => {
      ;(row.hashtags ?? []).forEach(t => tagMap.set(t, (tagMap.get(t) ?? 0) + 1))
    })
    setTrendingTags(
      Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    )
  }

  async function handleConnect(userId: string) {
    if (!profile) return
    setConnectedIds(prev => new Set([...prev, userId]))
    await supabase.from('connections').insert({
      requester_id: profile.id,
      recipient_id: userId,
      status: 'pending',
    })
  }

  function handleLikeToggle(postId: string, wasLiked: boolean) {
    setLikedPosts(prev => {
      const next = new Set(prev)
      if (wasLiked) next.delete(postId)
      else next.add(postId)
      return next
    })
  }

  function handlePosted(post: FeedPost) {
    setPosts(prev => [post, ...prev])
  }

  const initials = profile?.display_name
    ? profile.display_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <>
      <FeedFilterBar />

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>

        <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 104 }} className="feed-sidebar-left">
          {profile && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 44, background: 'linear-gradient(135deg, var(--color-brand) 0%, #C44D00 100%)', opacity: 0.8 }} />
              <div style={{ padding: '0 16px 16px', marginTop: -24 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-condensed)', fontSize: 18, fontWeight: 700, color: '#fff',
                  border: '3px solid var(--color-surface)',
                }}>
                  {initials}
                </div>
                <p style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{profile.display_name}</p>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                  {profile.account_type?.replace('_', ' ')}
                </p>
                {profile.handle && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>@{profile.handle}</p>
                )}

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isContractor ? '1fr 1fr 1fr' : '1fr 1fr',
                  gap: 4,
                  marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border)',
                }}>
                  <div className="sidebar-stat">
                    <span className="sidebar-stat-value">{networkCount ?? '—'}</span>
                    <span className="sidebar-stat-label">Network</span>
                  </div>
                  {isContractor && (
                    <div className="sidebar-stat">
                      <span className="sidebar-stat-value">{activeBidsCount ?? '—'}</span>
                      <span className="sidebar-stat-label">Bids</span>
                    </div>
                  )}
                  <div className="sidebar-stat">
                    <span className="sidebar-stat-value">
                      {isContractor ? (openJobsCount ?? '—') : (profile.credit_balance ?? 0)}
                    </span>
                    <span className="sidebar-stat-label">
                      {isContractor ? 'Jobs' : 'Credits'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: '14px 16px' }}>
            <p style={{
              fontFamily: 'var(--font-condensed)', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.6px', textTransform: 'uppercase',
              color: 'var(--color-text-muted)', marginBottom: 10,
            }}>
              Post Types
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(POST_TYPE_BADGE)
                .filter(([k]) => !['story'].includes(k))
                .map(([key, b]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.text, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{b.label}</span>
                  </div>
                ))}
            </div>
          </div>
        </aside>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {profile && (
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-brand)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 700, color: '#fff',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
              )}
              <button className="feed-compose-trigger" onClick={() => setComposeOpen(true)}>
                What's happening on your project?
              </button>
            </div>
            <div style={{
              display: 'flex', gap: 8, marginTop: 12, paddingTop: 12,
              borderTop: '1px solid var(--color-border)',
            }}>
              {[
                { label: '+ Update', color: '#2563EB', onClick: () => setComposeOpen(true) },
                { label: '+ Job', color: '#DC2626', onClick: () => navigate('/jobs/post') },
                { label: '+ Open Bid', color: 'var(--color-brand)', onClick: () => navigate('/bids/post') },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  style={{
                    background: 'none', border: 'none',
                    color: 'var(--color-text-muted)', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-condensed)', letterSpacing: '0.5px', textTransform: 'uppercase',
                    transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = btn.color}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                >
                  <Plus size={12} /> {btn.label.replace('+ ', '')}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : posts.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                No posts yet in this category. Be the first to share something!
              </p>
            </div>
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                likedPosts={likedPosts}
                onLikeToggle={handleLikeToggle}
              />
            ))
          )}

          {!loading && hasMore && (
            <button
              onClick={() => void fetchPosts(false)}
              disabled={loadingMore}
              className="btn btn-secondary"
              style={{
                width: '100%', padding: '10px', fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {loadingMore ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          )}
        </div>

        <aside style={{ width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 104 }} className="feed-sidebar-right">
          {sidebarUsers.length > 0 && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <h3 style={{
                fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 800,
                marginBottom: 14, letterSpacing: '-0.2px',
              }}>
                People to Connect With
                {myTrade && (
                  <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                    · {myTrade}
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sidebarUsers.map(u => (
                  <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <AuthorAvatar name={u.display_name} avatar={u.avatar_url} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 600, fontSize: 12,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {u.display_name}
                      </p>
                      <p style={{
                        fontSize: 11, color: 'var(--color-text-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {[u.primary_trade, u.location].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleConnect(u.id)}
                      disabled={connectedIds.has(u.id)}
                      className="btn btn-secondary"
                      style={{
                        padding: '3px 8px', fontSize: 11,
                        display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
                        opacity: connectedIds.has(u.id) ? 0.6 : 1,
                      }}
                    >
                      {connectedIds.has(u.id) ? '✓ Sent' : <><UserPlus size={10} /> Connect</>}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {trendingTags.length > 0 && (
            <div className="card" style={{ padding: '14px 16px' }}>
              <h3 style={{
                fontFamily: 'var(--font-condensed)', fontSize: 14, fontWeight: 800,
                marginBottom: 12, letterSpacing: '-0.2px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <TrendingUp size={14} color="var(--color-brand)" /> Trending
              </h3>
              <div>
                {trendingTags.map(({ tag, count }) => (
                  <div
                    key={tag}
                    className="trending-tag"
                    onClick={() => navigate(`/feed?q=%23${tag}`)}
                  >
                    <span style={{ fontSize: 13, color: 'var(--color-brand)', fontWeight: 600 }}>
                      #{tag}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {count} post{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {composeOpen && (
        <ComposeModal onClose={() => setComposeOpen(false)} onPosted={handlePosted} />
      )}

      <style>{`
        @media (max-width: 1024px) { .feed-sidebar-right { display: none !important; } }
        @media (max-width: 768px) { .feed-sidebar-left { display: none !important; } }
      `}</style>
    </>
  )
}
