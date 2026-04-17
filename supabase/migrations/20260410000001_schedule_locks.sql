-- ==========================================
-- Schedule Locks
-- HR can lock a calendar month so employees can no longer modify their WFH selections.
-- ==========================================

CREATE TABLE schedule_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INT NOT NULL CHECK (year >= 2020),
  locked_by UUID NOT NULL REFERENCES employees(id),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, year)
);

-- Authenticated users can read locks (so the schedule save route can check them).
ALTER TABLE schedule_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read locks" ON schedule_locks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "HR manages locks" ON schedule_locks
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));
