-- Sprint 17B: Write-back, webhooks, incremental sync, event linking

-- 1. Webhook subscriptions table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connected_account_id UUID NOT NULL REFERENCES connected_accounts(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  subscription_id VARCHAR(512) NOT NULL,
  resource_id VARCHAR(512),
  notification_url TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  sync_token TEXT,
  delta_link TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connected_account_id, provider)
);

-- 2. Add bidirectional event linking columns to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS external_provider VARCHAR(20),
  ADD COLUMN IF NOT EXISTS connected_account_id UUID REFERENCES connected_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_etag TEXT,
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- 3. Add linking column to external_events
ALTER TABLE external_events
  ADD COLUMN IF NOT EXISTS orbyt_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS etag TEXT;

-- 4. Add incremental sync tokens to connected_accounts
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS sync_token TEXT,
  ADD COLUMN IF NOT EXISTS delta_link TEXT;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_subs_account ON webhook_subscriptions(connected_account_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subs_expires ON webhook_subscriptions(expires_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_event_id) WHERE external_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_external_events_orbyt ON external_events(orbyt_event_id) WHERE orbyt_event_id IS NOT NULL;

-- 6. RLS
ALTER TABLE public.webhook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_subs_owner_only" ON public.webhook_subscriptions
  FOR ALL USING (
    connected_account_id IN (
      SELECT id FROM public.connected_accounts WHERE user_id = auth.uid()
    )
  );

-- Service role needs full access for cron job webhook renewal
CREATE POLICY "webhook_subs_service_role" ON public.webhook_subscriptions
  FOR ALL TO service_role USING (true);
