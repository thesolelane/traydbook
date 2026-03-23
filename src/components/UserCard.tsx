import { Star, MapPin, CheckCircle } from 'lucide-react';
import { User } from '../data/mockData';
import { useState } from 'react';

interface UserCardProps {
  user: User;
  compact?: boolean;
}

export default function UserCard({ user, compact = false }: UserCardProps) {
  const [following, setFollowing] = useState(user.isFollowing ?? false);

  return (
    <div className="card" style={{ padding: compact ? 16 : 20 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          className="avatar-placeholder"
          style={{
            width: compact ? 44 : 52,
            height: compact ? 44 : 52,
            background: user.avatarColor,
            fontSize: compact ? 14 : 17,
          }}
        >
          {user.initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: compact ? 14 : 15, color: 'var(--color-text)' }}>
              {user.name}
            </span>
            {user.verified && (
              <CheckCircle size={14} color="#2563EB" fill="#2563EB" />
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 1 }}>{user.title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <MapPin size={11} /> {user.location}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#D97706' }}>
              <Star size={11} fill="#D97706" /> {user.rating} ({user.reviewCount})
            </span>
          </div>
          {!compact && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{user.jobsCompleted}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Jobs Done</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{user.yearsExp}yr</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Experience</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span className="badge badge-brand" style={{ fontSize: 11 }}>{user.trade}</span>
              </div>
            </div>
          )}
          {compact && (
            <span className="badge badge-brand" style={{ marginTop: 6 }}>{user.trade}</span>
          )}
        </div>
        <button
          className={`btn ${following ? 'btn-ghost' : 'btn-secondary'}`}
          style={{ padding: '6px 14px', fontSize: 12 }}
          onClick={() => setFollowing(!following)}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>

      {!compact && (
        <>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12, lineHeight: 1.5 }}>
            {user.bio}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            {user.skills.slice(0, 4).map(skill => (
              <span key={skill} className="tag">{skill}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
