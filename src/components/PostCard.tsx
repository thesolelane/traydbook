import { Heart, MessageCircle, Share2, CheckCircle } from 'lucide-react';
import { Post } from '../data/mockData';
import { useState } from 'react';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);

  const handleLike = () => {
    if (liked) {
      setLikeCount(c => c - 1);
    } else {
      setLikeCount(c => c + 1);
    }
    setLiked(!liked);
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div
          className="avatar-placeholder"
          style={{ width: 44, height: 44, background: post.author.avatarColor, fontSize: 14 }}
        >
          {post.author.initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{post.author.name}</span>
            {post.author.verified && <CheckCircle size={13} color="#2563EB" fill="#2563EB" />}
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {post.author.title} · {post.postedAt}
          </p>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--color-text)', whiteSpace: 'pre-line' }}>
          {post.content}
        </p>
      </div>

      {post.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {post.tags.map(tag => (
            <span key={tag} style={{ fontSize: 12, color: 'var(--color-brand)', fontWeight: 600 }}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: 'var(--color-border)', margin: '14px 0' }} />

      <div style={{ display: 'flex', gap: 4 }}>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            color: liked ? 'var(--color-brand)' : 'var(--color-text-muted)',
            transition: 'all 0.15s',
          }}
          onClick={handleLike}
        >
          <Heart size={15} fill={liked ? 'var(--color-brand)' : 'none'} /> {likeCount}
        </button>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
          }}
        >
          <MessageCircle size={15} /> {post.comments}
        </button>
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
          }}
        >
          <Share2 size={15} /> {post.shares}
        </button>
      </div>
    </div>
  );
}
