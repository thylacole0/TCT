-- Pending expenses from mobile notifications (Flutter app or iOS Shortcuts)
CREATE TABLE IF NOT EXISTS pending_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'notification',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','classified','rejected')),
  merchant TEXT,
  amount NUMERIC(10,0),
  category TEXT,
  expense_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  classified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_expenses_user_status
  ON pending_expenses (user_id, status);

ALTER TABLE pending_expenses ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending expenses
CREATE POLICY "Users can view own pending expenses"
  ON pending_expenses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own pending expenses
CREATE POLICY "Users can insert own pending expenses"
  ON pending_expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own pending expenses (for status changes)
CREATE POLICY "Users can update own pending expenses"
  ON pending_expenses FOR UPDATE
  USING (auth.uid() = user_id);

-- Add merchant column to expenses for granular view
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS merchant TEXT;

CREATE INDEX IF NOT EXISTS idx_expenses_merchant
  ON expenses (merchant);
