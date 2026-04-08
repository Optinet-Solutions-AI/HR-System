-- ==========================================
-- WFH Sentinel — Initial Schema
-- ==========================================

-- ==========================================
-- ENUMS
-- ==========================================

CREATE TYPE user_role AS ENUM ('employee', 'manager', 'hr_admin', 'super_admin');

CREATE TYPE schedule_status AS ENUM (
  'office', 'wfh', 'public_holiday', 'vacation', 'sick_leave', 'not_scheduled'
);

CREATE TYPE actual_status AS ENUM (
  'in_office_confirmed', 'wfh_confirmed', 'no_clocking', 'wrong_location',
  'broken_clocking', 'no_booking', 'vacation', 'public_holiday', 'unknown'
);

CREATE TYPE compliance_flag AS ENUM (
  'missing_clocking', 'missing_clock_out', 'wrong_location', 'no_desk_booking',
  'late_arrival', 'clocking_not_closed', 'schedule_mismatch', 'exceeded_wfh_days'
);

-- ==========================================
-- UPDATED_AT TRIGGER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- EMPLOYEES (created first, team_id added later)
-- ==========================================

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  talexio_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  job_schedule TEXT,
  unit TEXT,
  business_unit TEXT,
  office_days_per_week INT NOT NULL DEFAULT 4
    CHECK (office_days_per_week BETWEEN 0 AND 5),
  role user_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at_employees
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- TEAMS
-- ==========================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add team_id FK to employees (resolves circular dependency)
ALTER TABLE employees ADD COLUMN team_id UUID REFERENCES teams(id);

-- ==========================================
-- WFH SCHEDULES
-- ==========================================

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status schedule_status NOT NULL,
  approved_by UUID REFERENCES employees(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_schedules_date ON schedules(date);
CREATE INDEX idx_schedules_status ON schedules(status);

CREATE TRIGGER set_updated_at_schedules
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- CLOCKINGS (synced from Talexio)
-- ==========================================

CREATE TABLE clockings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  time_in TEXT,
  time_out TEXT,
  hours_worked DECIMAL(5,2),
  location_in_name TEXT,
  location_in_lat DECIMAL(10,7),
  location_in_lng DECIMAL(10,7),
  location_out_name TEXT,
  location_out_lat DECIMAL(10,7),
  location_out_lng DECIMAL(10,7),
  clocking_status TEXT DEFAULT 'Active Clocking',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_clockings_date ON clockings(date);

-- ==========================================
-- BOOKINGS (desk/room bookings)
-- ==========================================

CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  room TEXT,
  time_from TEXT,
  time_to TEXT,
  duration TEXT,
  date_booked TIMESTAMPTZ,
  work_location TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_bookings_date ON bookings(date);

-- ==========================================
-- COMPLIANCE RECORDS
-- ==========================================

CREATE TABLE compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  week_number INT NOT NULL,
  expected_status schedule_status,
  actual_status actual_status NOT NULL,
  has_clocking BOOLEAN NOT NULL DEFAULT false,
  has_booking BOOLEAN NOT NULL DEFAULT false,
  location_match BOOLEAN,
  is_compliant BOOLEAN NOT NULL DEFAULT false,
  flags compliance_flag[] DEFAULT '{}',
  comment TEXT,
  reviewed_by UUID REFERENCES employees(id),
  reviewed_at TIMESTAMPTZ,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, date)
);

CREATE INDEX idx_compliance_date ON compliance_records(date);
CREATE INDEX idx_compliance_compliant ON compliance_records(is_compliant);
CREATE INDEX idx_compliance_week ON compliance_records(week_number);

-- ==========================================
-- SCHEDULE RULES (configurable)
-- ==========================================

CREATE TABLE schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  value JSONB NOT NULL,
  applies_to_team_id UUID REFERENCES teams(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- OFFICE LOCATIONS (for geofencing)
-- ==========================================

CREATE TABLE office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  radius_meters INT NOT NULL DEFAULT 200,
  ip_ranges TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- PUBLIC HOLIDAYS
-- ==========================================

CREATE TABLE public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================
-- RLS HELPER FUNCTIONS
-- ==========================================

CREATE OR REPLACE FUNCTION get_my_employee_id()
RETURNS UUID AS $$
  SELECT id FROM employees WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM employees WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_manager_of(target_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    JOIN teams t ON t.id = e.team_id
    WHERE e.id = target_employee_id
    AND t.manager_id = get_my_employee_id()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ==========================================
-- ROW-LEVEL SECURITY POLICIES
-- ==========================================

-- EMPLOYEES
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees see own record" ON employees
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "Managers see team employees" ON employees
  FOR SELECT USING (
    get_my_role() = 'manager'
    AND team_id IN (
      SELECT t.id FROM teams t WHERE t.manager_id = get_my_employee_id()
    )
  );

CREATE POLICY "HR sees all employees" ON employees
  FOR SELECT USING (get_my_role() IN ('hr_admin', 'super_admin'));

CREATE POLICY "HR manages all employees" ON employees
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- SCHEDULES
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees see own schedules" ON schedules
  FOR SELECT USING (employee_id = get_my_employee_id());

CREATE POLICY "Managers see team schedules" ON schedules
  FOR SELECT USING (
    get_my_role() = 'manager'
    AND is_manager_of(employee_id)
  );

CREATE POLICY "HR sees all schedules" ON schedules
  FOR SELECT USING (get_my_role() IN ('hr_admin', 'super_admin'));

CREATE POLICY "Employees insert own schedules" ON schedules
  FOR INSERT WITH CHECK (employee_id = get_my_employee_id());

CREATE POLICY "Employees update own schedules" ON schedules
  FOR UPDATE USING (employee_id = get_my_employee_id());

CREATE POLICY "HR manages all schedules" ON schedules
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- CLOCKINGS (read-only for users, written by admin/sync)
ALTER TABLE clockings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees see own clockings" ON clockings
  FOR SELECT USING (employee_id = get_my_employee_id());

CREATE POLICY "Managers see team clockings" ON clockings
  FOR SELECT USING (
    get_my_role() = 'manager'
    AND is_manager_of(employee_id)
  );

CREATE POLICY "HR sees all clockings" ON clockings
  FOR SELECT USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- BOOKINGS (read-only for users, written by admin/sync)
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees see own bookings" ON bookings
  FOR SELECT USING (employee_id = get_my_employee_id());

CREATE POLICY "Managers see team bookings" ON bookings
  FOR SELECT USING (
    get_my_role() = 'manager'
    AND is_manager_of(employee_id)
  );

CREATE POLICY "HR sees all bookings" ON bookings
  FOR SELECT USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- COMPLIANCE RECORDS (read-only for users, written by admin/compliance engine)
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees see own compliance" ON compliance_records
  FOR SELECT USING (employee_id = get_my_employee_id());

CREATE POLICY "Managers see team compliance" ON compliance_records
  FOR SELECT USING (
    get_my_role() = 'manager'
    AND is_manager_of(employee_id)
  );

CREATE POLICY "HR sees all compliance" ON compliance_records
  FOR SELECT USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- SCHEDULE RULES (readable by all authenticated, writable by HR)
ALTER TABLE schedule_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read rules" ON schedule_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "HR manages rules" ON schedule_rules
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- OFFICE LOCATIONS (readable by all authenticated, writable by HR)
ALTER TABLE office_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read locations" ON office_locations
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "HR manages locations" ON office_locations
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- PUBLIC HOLIDAYS (readable by all authenticated, writable by HR)
ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read holidays" ON public_holidays
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "HR manages holidays" ON public_holidays
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));

-- TEAMS (readable by all authenticated, writable by HR)
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read teams" ON teams
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "HR manages teams" ON teams
  FOR ALL USING (get_my_role() IN ('hr_admin', 'super_admin'));
