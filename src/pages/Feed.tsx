import { useState } from 'react';
import { Image, Send } from 'lucide-react';
import PostCard from '../components/PostCard';
import UserCard from '../components/UserCard';
import { posts, users, currentUser } from '../data/mockData';

export default function Feed() {
  const [postText, setPostText] = useState('');

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div className="avatar-placeholder" style={{ width: 40, height: 40, background: currentUser.avatarColor, fontSize: 13, flexShrink: 0 }}>
              {currentUser.initials}
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                placeholder="Share a project update, tip, or industry insight..."
                value={postText}
                onChange={e => setPostText(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 12px',
                  fontSize: 14,
                  resize: 'none',
                  outline: 'none',
                  lineHeight: 1.6,
                  background: 'var(--color-bg)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 13, fontWeight: 600 }}>
                  <Image size={16} /> Add Photo
                </button>
                <button
                  className="btn btn-primary"
                  style={{ padding: '7px 18px', fontSize: 13 }}
                  disabled={!postText.trim()}
                  onClick={() => setPostText('')}
                >
                  <Send size={13} /> Post
                </button>
              </div>
            </div>
          </div>
        </div>

        {posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <aside style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="avatar-placeholder" style={{ width: 52, height: 52, background: currentUser.avatarColor, fontSize: 17 }}>
              {currentUser.initials}
            </div>
            <div>
              <p style={{ fontWeight: 700, fontSize: 14 }}>{currentUser.name}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{currentUser.title}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{currentUser.location}</p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text)' }}>{currentUser.jobsCompleted}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Jobs</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text)' }}>{currentUser.rating}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Rating</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--color-text)' }}>{currentUser.reviewCount}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Reviews</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>People to Follow</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {users.slice(0, 3).map(user => (
              <div key={user.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="avatar-placeholder" style={{ width: 38, height: 38, background: user.avatarColor, fontSize: 12 }}>
                  {user.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.trade}</p>
                </div>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }}>Follow</button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <style>{`
        @media (max-width: 900px) {
          aside { display: none; }
        }
      `}</style>
    </div>
  );
}
