-- ==========================================
-- WFH Sentinel — Seed Data
-- Safe to re-run: truncates all tables first
-- ==========================================

-- Clear existing data (respects FK order)
TRUNCATE compliance_records, clockings, bookings, schedules, schedule_rules, public_holidays, office_locations, teams, employees CASCADE;

-- ==========================================
-- EMPLOYEES
-- auth_user_id is NULL — will be linked when users sign up
-- talexio_id is the key identifier for Talexio integration
-- ==========================================

INSERT INTO employees (talexio_id, first_name, last_name, email, office_days_per_week, role, notes) VALUES
  ('Niwi01', 'Niklas',     'Wirth',              'niklas@company.com',     5, 'employee', 'Rarely clocks — often shows "No clocking"'),
  ('Moal01', 'Mohamed',    'AlJebali',            'mohamed@company.com',    5, 'employee', NULL),
  ('Yari01', 'Yassine',    'Ridene',              'yassine@company.com',    5, 'employee', NULL),
  ('Yoay01', 'Youssef',    'Ayedi',               'youssef@company.com',    5, 'employee', NULL),
  ('Esri01', 'Esam',       'Ridene',              'esam@company.com',       5, 'employee', NULL),
  ('Adsu01', 'Ada',        'Svardal',             'ada@company.com',        4, 'employee', NULL),
  ('Jasa01', 'Janice',     'Santangelo',          'janice@company.com',     4, 'employee', NULL),
  (NULL,     'Olivier',    'Unknown',             'olivier@company.com',    4, 'employee', 'In Config but no clocking/booking data. May be inactive or not yet started.'),
  ('Owor01', 'Owen',       'Ordway',              'owen@company.com',       4, 'employee', NULL),
  ('Rewh01', 'Redvers',    'Whitehead',           'redvers@company.com',    4, 'employee', NULL),
  ('Sado01', 'Salvatore',  'Dolce',               'salvatore@company.com',  4, 'employee', 'Not sure when and if he will come to the office — Alex is aware'),
  ('Tiko01', 'Tina',       'Koepf',               'tina@company.com',       4, 'employee', NULL),
  ('Daza01', 'Darren',     'Zahra',               'darren@company.com',     2, 'employee', NULL),
  ('Alza01', 'Alec',       'Zanussi',             'alec@company.com',       2, 'employee', NULL),
  ('Chde01', 'Christian',  'Deeken',              'christian@company.com',  1, 'employee', 'Works 5 days/week total: 1 in office + 4 WFH');

-- ==========================================
-- OFFICE LOCATIONS
-- Head Office in Malta
-- ==========================================

INSERT INTO office_locations (name, latitude, longitude, radius_meters) VALUES
  ('Head Office', 35.9222072, 14.4878368, 200);

-- ==========================================
-- SCHEDULE RULES
-- Monday/Friday WFH limit: max 1 per employee per month
-- ==========================================

INSERT INTO schedule_rules (name, rule_type, value) VALUES
  ('Monday WFH Limit', 'MAX_WFH_PER_DAY_OF_WEEK', '{"dayOfWeek": "Monday", "maxPerMonth": 1}'::jsonb),
  ('Friday WFH Limit', 'MAX_WFH_PER_DAY_OF_WEEK', '{"dayOfWeek": "Friday", "maxPerMonth": 1}'::jsonb);

-- ==========================================
-- PUBLIC HOLIDAYS — Malta 2026
-- ==========================================

INSERT INTO public_holidays (date, name) VALUES
  ('2026-01-01', 'New Year''s Day'),
  ('2026-02-10', 'Feast of St Paul''s Shipwreck'),
  ('2026-03-19', 'Feast of St Joseph'),
  ('2026-03-31', 'Freedom Day'),
  ('2026-04-03', 'Good Friday'),
  ('2026-05-01', 'Worker''s Day'),
  ('2026-06-07', 'Sette Giugno'),
  ('2026-06-29', 'Feast of St Peter and St Paul'),
  ('2026-08-15', 'Feast of the Assumption'),
  ('2026-09-08', 'Victory Day'),
  ('2026-09-21', 'Independence Day'),
  ('2026-12-08', 'Feast of the Immaculate Conception'),
  ('2026-12-13', 'Republic Day'),
  ('2026-12-25', 'Christmas Day');
