-- Sprint 9-15 Schema Sync: Add missing columns and tables
-- All operations use IF NOT EXISTS for idempotency
-- Matches Drizzle ORM schema definitions exactly

-- ── profiles: missing columns ────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS week_start_day VARCHAR(10) DEFAULT 'sunday',
  ADD COLUMN IF NOT EXISTS finance_modules JSONB DEFAULT '{}';

-- notification_preferences is NOT NULL so needs special DO $$ handling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- ── events: missing column ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'reminder_minutes'
  ) THEN
    ALTER TABLE events ADD COLUMN reminder_minutes INTEGER[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- ── tasks: missing column ────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS source_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL;

-- ── bills: missing columns ───────────────────────────────────────────────────
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS notify_on_paid TEXT[] NOT NULL DEFAULT '{}';

-- ── event_attendees ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id UUID,
  rsvp_status VARCHAR(20) DEFAULT 'pending',
  UNIQUE(event_id, user_id)
);

-- ── accounts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  institution VARCHAR(100),
  account_number VARCHAR(4),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  owner_id UUID REFERENCES profiles(id),
  ownership VARCHAR(10) NOT NULL DEFAULT 'ours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── transactions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  type VARCHAR(10) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  category VARCHAR(50) NOT NULL,
  description VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_frequency VARCHAR(20),
  tags TEXT[] DEFAULT '{}',
  split_with JSONB,
  ownership VARCHAR(10) NOT NULL DEFAULT 'ours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── budgets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  monthly_limit NUMERIC(12,2) NOT NULL,
  rollover BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── savings_goals ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  name VARCHAR(100) NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  target_date DATE,
  monthly_contribution NUMERIC(12,2),
  category VARCHAR(30) NOT NULL DEFAULT 'savings',
  linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  emoji VARCHAR(4),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── expense_splits ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  owed_by UUID NOT NULL REFERENCES profiles(id),
  owed_to UUID NOT NULL REFERENCES profiles(id),
  amount NUMERIC(12,2) NOT NULL,
  settled BOOLEAN NOT NULL DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── net_worth_snapshots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_assets NUMERIC(12,2) NOT NULL,
  total_liabilities NUMERIC(12,2) NOT NULL,
  net_worth NUMERIC(12,2) NOT NULL,
  breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(household_id, snapshot_date)
);

-- ── indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_event_attendees_event ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_household ON accounts(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household ON transactions(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_budgets_household ON budgets(household_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_household ON savings_goals(household_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_household ON expense_splits(household_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_transaction ON expense_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_net_worth_household ON net_worth_snapshots(household_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source_bill ON tasks(source_bill_id) WHERE source_bill_id IS NOT NULL;

-- ── RLS: event_attendees ─────────────────────────────────────────────────────
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_attendees' AND policyname = 'event_attendees_member_all'
  ) THEN
    CREATE POLICY "event_attendees_member_all" ON event_attendees
      FOR ALL USING (
        event_id IN (
          SELECT id FROM events WHERE household_id IN (
            SELECT household_id FROM household_members WHERE user_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- ── RLS: accounts ─────────────────────────────────────────────────────────────
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'accounts' AND policyname = 'accounts_member_all'
  ) THEN
    CREATE POLICY "accounts_member_all" ON accounts
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── RLS: transactions ─────────────────────────────────────────────────────────
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transactions' AND policyname = 'transactions_member_all'
  ) THEN
    CREATE POLICY "transactions_member_all" ON transactions
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── RLS: budgets ──────────────────────────────────────────────────────────────
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'budgets' AND policyname = 'budgets_member_all'
  ) THEN
    CREATE POLICY "budgets_member_all" ON budgets
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── RLS: savings_goals ────────────────────────────────────────────────────────
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'savings_goals' AND policyname = 'savings_goals_member_all'
  ) THEN
    CREATE POLICY "savings_goals_member_all" ON savings_goals
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── RLS: expense_splits ───────────────────────────────────────────────────────
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expense_splits' AND policyname = 'expense_splits_member_all'
  ) THEN
    CREATE POLICY "expense_splits_member_all" ON expense_splits
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── RLS: net_worth_snapshots ──────────────────────────────────────────────────
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'net_worth_snapshots' AND policyname = 'net_worth_snapshots_member_all'
  ) THEN
    CREATE POLICY "net_worth_snapshots_member_all" ON net_worth_snapshots
      FOR ALL USING (
        household_id IN (
          SELECT household_id FROM household_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
