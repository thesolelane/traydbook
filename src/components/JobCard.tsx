import { MapPin, Clock, DollarSign, Users, Star, Zap } from 'lucide-react';
import { Job } from '../data/mockData';
import { useState } from 'react';

interface JobCardProps {
  job: Job;
  onBid?: (job: Job) => void;
}

const typeColors: Record<string, string> = {
  'Full-time': 'badge-green',
  'Contract': 'badge-blue',
  'Subcontract': 'badge-brand',
  'Per-diem': 'badge-yellow',
};

export default function JobCard({ job, onBid }: JobCardProps) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="card" style={{ padding: 20, position: 'relative' }}>
      {job.isFeatured && (
        <div style={{
          position: 'absolute',
          top: 0, right: 20,
          background: 'var(--color-brand)',
          color: 'white',
          fontSize: 10,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: '0 0 6px 6px',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
        }}>
          Featured
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div
          className="avatar-placeholder"
          style={{ width: 46, height: 46, background: job.companyColor, fontSize: 15, borderRadius: 10 }}
        >
          {job.companyInitials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)', flex: 1 }}>{job.title}</h3>
            {job.isNew && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: '#ECFDF5', color: '#059669',
                fontSize: 10, fontWeight: 700,
                padding: '2px 8px', borderRadius: 20,
                textTransform: 'uppercase',
              }}>
                <Zap size={9} /> New
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 1 }}>{job.company}</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <MapPin size={12} /> {job.location}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <Clock size={12} /> {job.postedAt}
            </span>
            {job.budget && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#059669', fontWeight: 600 }}>
                <DollarSign size={12} /> {job.budget}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <Users size={12} /> {job.bidsCount} bid{job.bidsCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 12, lineHeight: 1.6 }}>
        {job.description}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
        <span className={`badge ${typeColors[job.type] ?? 'badge-gray'}`}>{job.type}</span>
        <span className="badge badge-gray">{job.trade}</span>
        {job.skills.slice(0, 3).map(skill => (
          <span key={skill} className="tag">{skill}</span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: 13 }}
          onClick={() => onBid?.(job)}
        >
          Submit Bid
        </button>
        <button
          className={`btn ${saved ? 'btn-ghost' : 'btn-ghost'}`}
          style={{ fontSize: 13, color: saved ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
          onClick={() => setSaved(!saved)}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}
