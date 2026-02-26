-- Sprint 21: Plaid Integration — tables + columns + RLS
-- Creates plaid_items and plaid_accounts tables
-- Adds Plaid sync columns to existing transactions and accounts tables

BEGIN;

-- ================================================================
-- 1. plaid_items — one row per bank connection (Item = one institution)
-- ================================================================
CREATE TABLE IF NOT EXISTS plaid_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id  uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id),
  plaid_item_id varchar(100) NOT NULL UNIQUE,
  access_token  text NOT NULL,               -- AES-256-GCM encrypted
  institution_id   varchar(50),
  institution_name varchar(200),
  transactions_cursor text,                  -- For incremental sync
  consent_expires_at timestamptz,
  last_sync_at  timestamptz,
  sync_error    text,
  status        varchar(20) NOT NULL DEFAULT 'active',  -- active | login_required | error | disconnected
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

-- ================================================================
-- 2. plaid_accounts — individual bank accounts within a Plaid item
-- ================================================================
CREATE TABLE IF NOT EXISTS plaid_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plaid_item_id   uuid NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  orbyt_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  plaid_account_id varchar(100) NOT NULL UNIQUE,
  name            varchar(200) NOT NULL,
  official_name   varchar(200),
  type            varchar(20) NOT NULL,      -- depository | credit | loan | investment
  subtype         varchar(50),
  mask            varchar(4),                -- Last 4 digits
  current_balance  numeric(12,2),
  available_balance numeric(12,2),
  iso_currency_code varchar(3) NOT NULL DEFAULT 'USD',
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);

-- ================================================================
-- 3. Add Plaid sync columns to existing transactions table
-- ================================================================
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS plaid_transaction_id varchar(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS pending boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS merchant_name varchar(200),
  ADD COLUMN IF NOT EXISTS plaid_category jsonb,
  ADD COLUMN IF NOT EXISTS import_source varchar(20) DEFAULT 'manual';

-- ================================================================
-- 4. Add Plaid link column to existing accounts table
-- ================================================================
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS plaid_account_id uuid;

-- ================================================================
-- 5. Indexes for query performance
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_plaid_items_household ON plaid_items(household_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON plaid_items(status) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_item ON plaid_accounts(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_orbyt ON plaid_accounts(orbyt_account_id) WHERE orbyt_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_id ON transactions(plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_import_source ON transactions(import_source);
CREATE INDEX IF NOT EXISTS idx_accounts_plaid ON accounts(plaid_account_id) WHERE plaid_account_id IS NOT NULL;

-- ================================================================
-- 6. Enable RLS on new tables
-- ================================================================
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_accounts ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 7. RLS policies for plaid_items — household-scoped
-- ================================================================

-- SELECT: household members can view their household's Plaid items
CREATE POLICY plaid_items_household_select ON plaid_items
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- INSERT: authenticated users can add Plaid items to their household
CREATE POLICY plaid_items_household_insert ON plaid_items
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- UPDATE: connecting user or household admin can update
CREATE POLICY plaid_items_owner_update ON plaid_items
  FOR UPDATE USING (
    user_id = auth.uid()
    OR household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: connecting user or household admin can delete
CREATE POLICY plaid_items_owner_delete ON plaid_items
  FOR DELETE USING (
    user_id = auth.uid()
    OR household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================================
-- 8. RLS policies for plaid_accounts — scoped through plaid_items
-- ================================================================

-- SELECT: household members can view accounts for their household's Plaid items
CREATE POLICY plaid_accounts_household_select ON plaid_accounts
  FOR SELECT USING (
    plaid_item_id IN (
      SELECT id FROM plaid_items WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: via plaid item ownership
CREATE POLICY plaid_accounts_household_insert ON plaid_accounts
  FOR INSERT WITH CHECK (
    plaid_item_id IN (
      SELECT id FROM plaid_items WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE: via plaid item ownership
CREATE POLICY plaid_accounts_household_update ON plaid_accounts
  FOR UPDATE USING (
    plaid_item_id IN (
      SELECT id FROM plaid_items WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- DELETE: via plaid item ownership
CREATE POLICY plaid_accounts_household_delete ON plaid_accounts
  FOR DELETE USING (
    plaid_item_id IN (
      SELECT id FROM plaid_items WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

COMMIT;
