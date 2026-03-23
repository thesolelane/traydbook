import { useState } from 'react';
import { Filter, Search } from 'lucide-react';
import JobCard from '../components/JobCard';
import BidModal from '../components/BidModal';
import { jobs, tradeOptions, jobTypeOptions, Job } from '../data/mockData';

export default function Jobs() {
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('All Trades');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const filtered = jobs.filter(job => {
    const matchSearch = !search || job.title.toLowerCase().includes(search.toLowerCase()) || job.trade.toLowerCase().includes(search.toLowerCase()) || job.company.toLowerCase().includes(search.toLowerCase());
    const matchTrade = tradeFilter === 'All Trades' || job.trade === tradeFilter;
    const matchType = typeFilter === 'All Types' || job.type === typeFilter;
    return matchSearch && matchTrade && matchType;
  });

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 800, fontSize: 26, color: 'var(--color-text)' }}>Job Board</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Find jobs, contracts, and subcontracting opportunities in the trades
        </p>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={14} color="var(--color-text-light)" style={{ position: 'absolute', left: 10 }} />
          <input
            type="text"
            placeholder="Search jobs, trades, companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 32px',
              border: '1.5px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>

        <select
          value={tradeFilter}
          onChange={e => setTradeFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            background: 'white',
            outline: 'none',
            color: 'var(--color-text)',
          }}
        >
          {tradeOptions.map(o => <option key={o}>{o}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: '9px 12px',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 13,
            background: 'white',
            outline: 'none',
            color: 'var(--color-text)',
          }}
        >
          {jobTypeOptions.map(o => <option key={o}>{o}</option>)}
        </select>

        <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          <Filter size={13} style={{ display: 'inline', marginRight: 4 }} />
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No jobs found</p>
          <p style={{ fontSize: 14, marginTop: 6 }}>Try adjusting your filters</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(job => (
            <JobCard key={job.id} job={job} onBid={setSelectedJob} />
          ))}
        </div>
      )}

      {selectedJob && (
        <BidModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onSubmit={(_id, _amount, _msg) => {}}
        />
      )}
    </div>
  );
}
