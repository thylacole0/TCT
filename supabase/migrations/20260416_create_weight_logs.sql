-- Weight tracking: personal daily morning/night logs
CREATE TABLE weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  time_of_day TEXT NOT NULL CHECK (time_of_day IN ('morning', 'night')),
  weight_kg NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date, time_of_day)
);

CREATE INDEX idx_weight_logs_user_date ON weight_logs (user_id, log_date DESC);

-- RLS
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own weight logs
CREATE POLICY "Users can view own weight logs"
  ON weight_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own weight logs
CREATE POLICY "Users can insert own weight logs"
  ON weight_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own weight logs
CREATE POLICY "Users can update own weight logs"
  ON weight_logs FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own weight logs
CREATE POLICY "Users can delete own weight logs"
  ON weight_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Optional: goal weight per user (stored in profiles or separate table)
-- For now we'll store it in a simple key-value approach via the API
CREATE TABLE weight_goals (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  goal_kg NUMERIC(5,2) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE weight_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own goal" ON weight_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own goal" ON weight_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goal" ON weight_goals FOR UPDATE USING (auth.uid() = user_id);
