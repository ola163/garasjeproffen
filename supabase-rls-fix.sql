-- Enable RLS on all tables that were created without it
-- Run this in the Supabase SQL Editor

-- quote_status_logs: only admins need access (client-side authenticated)
alter table if exists quote_status_logs enable row level security;

create policy if not exists "Admins read quote_status_logs"
  on quote_status_logs for select
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

create policy if not exists "Admins insert quote_status_logs"
  on quote_status_logs for insert
  to authenticated
  with check (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

-- user_profiles: users manage their own profile; API routes use service role (bypasses RLS)
alter table if exists user_profiles enable row level security;

create policy if not exists "Users read own profile"
  on user_profiles for select
  to authenticated
  using (auth.uid() = id);

create policy if not exists "Users update own profile"
  on user_profiles for update
  to authenticated
  using (auth.uid() = id);

create policy if not exists "Users insert own profile"
  on user_profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- contacts: inserted by public API route (service role), read by admins
alter table if exists contacts enable row level security;

create policy if not exists "Admins read contacts"
  on contacts for select
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

create policy if not exists "Admins update contacts"
  on contacts for update
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

-- security_events: written by service role, read by admins
alter table if exists security_events enable row level security;

create policy if not exists "Admins read security_events"
  on security_events for select
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

-- chat_logs: written by service role, read by admins
alter table if exists chat_logs enable row level security;

create policy if not exists "Admins read chat_logs"
  on chat_logs for select
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

create policy if not exists "Admins delete chat_logs"
  on chat_logs for delete
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

-- gp_products: read by admin pages and PDF generation (service role)
alter table if exists gp_products enable row level security;

create policy if not exists "Admins read gp_products"
  on gp_products for select
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

-- gp_categories: read by admin pages and PDF generation (service role)
alter table if exists gp_categories enable row level security;

create policy if not exists "Admins read gp_categories"
  on gp_categories for select
  to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));
