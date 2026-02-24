-- Sprint 17A: Integration tables for Google/Outlook calendar sync

CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  calendar_id VARCHAR(255),
  last_sync_at TIMESTAMPTZ,
  sync_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  external_id VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) DEFAULT 'confirmed',
  metadata JSONB DEFAULT '{}',
  last_updated_external TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connected_account_id, external_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_external_events_account ON external_events(connected_account_id);
CREATE INDEX IF NOT EXISTS idx_external_events_user ON external_events(user_id);
CREATE INDEX IF NOT EXISTS idx_external_events_start ON external_events(start_at);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connected_accounts_owner_only" ON public.connected_accounts
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.external_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_events_owner_only" ON public.external_events
  FOR ALL USING (auth.uid() = user_id);
