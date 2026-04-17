-- Enable Supabase Realtime for dashboard live updates
alter publication supabase_realtime add table clockings;
alter publication supabase_realtime add table compliance_records;
