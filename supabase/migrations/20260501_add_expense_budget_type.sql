-- Preserve the intended budget type when an expense is created before a budget exists.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS budget_type TEXT CHECK (budget_type IN ('comida', 'aseo'));

-- Backfill expenses that are already linked to a budget.
UPDATE expenses AS e
SET budget_type = bw.budget_type
FROM budget_weeks AS bw
WHERE e.budget_week_id = bw.id
  AND e.budget_type IS NULL;

-- Best-effort backfill for legacy unlinked expenses.
UPDATE expenses
SET budget_type = CASE
  WHEN category IN ('Ferretería', 'Online') THEN 'aseo'
  ELSE 'comida'
END
WHERE budget_type IS NULL;

-- Link legacy unlinked expenses to matching existing budgets by date and type.
UPDATE expenses AS e
SET budget_week_id = bw.id
FROM budget_weeks AS bw
WHERE e.budget_week_id IS NULL
  AND e.budget_type = bw.budget_type
  AND (
    (bw.budget_type = 'comida' AND e.expense_date >= bw.week_start AND e.expense_date <= (bw.week_start + INTERVAL '6 days')::date)
    OR
    (bw.budget_type = 'aseo' AND e.expense_date >= bw.week_start AND e.expense_date <= (bw.week_start + INTERVAL '1 month - 1 day')::date)
  );

CREATE INDEX IF NOT EXISTS idx_expenses_budget_type_date
  ON expenses (budget_type, expense_date);
