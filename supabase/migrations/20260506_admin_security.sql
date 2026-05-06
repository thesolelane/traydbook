-- TraydBook Admin Security Schema
-- Run this in Supabase SQL editor (production and beta)

-- Admin audit log (append-only)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  reason TEXT NOT NULL,
  details JSONB,
  ip INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Security events
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  type TEXT NOT NULL,
  ip INET,
  user_id UUID,
  user_agent TEXT,
  path TEXT,
  method TEXT,
  details JSONB,
  action_taken TEXT,
  resolved BOOLEAN DEFAULT false
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  balance_before INTEGER,
  balance_after INTEGER,
  admin_id UUID,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Content moderation queue
CREATE TABLE IF NOT EXISTS content_moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  content_table TEXT NOT NULL,
  reporter_id UUID,
  ai_analysis JSONB,
  ai_flagged_categories TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'escalated')),
  decision TEXT CHECK (decision IN ('approve', 'reject', 'escalate')),
  resolved_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Repair log
CREATE TABLE IF NOT EXISTS repair_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID,
  sql_query TEXT NOT NULL,
  description TEXT NOT NULL,
  snapshot_id UUID,
  rows_affected INTEGER,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repair approvals
CREATE TABLE IF NOT EXISTS repair_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester UUID,
  approver UUID,
  approver_notes TEXT,
  sql_preview TEXT NOT NULL,
  description TEXT,
  approval_code TEXT UNIQUE,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- API key rotations
CREATE TABLE IF NOT EXISTS api_key_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_id TEXT UNIQUE NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  status TEXT CHECK (status IN ('staged', 'active', 'burned')),
  staged_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  burned_at TIMESTAMPTZ,
  generated_by INET,
  burned_reason TEXT,
  requests_served INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ
);

-- Connection test (seed value used by connection validator)
CREATE TABLE IF NOT EXISTS connection_test (
  id INTEGER PRIMARY KEY DEFAULT 1,
  test_value TEXT NOT NULL DEFAULT 'admin-verified'
);
INSERT INTO connection_test (id, test_value)
VALUES (1, 'admin-verified')
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_admin_time   ON admin_audit_log(admin_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_target        ON admin_audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_security_time       ON security_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_ip         ON security_events(ip, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_unresolved ON security_events(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_moderation_status   ON content_moderation_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_user         ON credit_transactions(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_key_hash            ON api_key_rotations(key_hash);
CREATE INDEX IF NOT EXISTS idx_key_status          ON api_key_rotations(status) WHERE status = 'active';
