-- Run this in the Supabase SQL editor

-- Sequence for ticket numbers starting at 1000
create sequence if not exists quote_ticket_seq start with 1000;

-- Security definer function so anon role can use the sequence
create or replace function next_ticket_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'GP26-' || nextval('quote_ticket_seq')::text;
end;
$$;

grant execute on function next_ticket_number() to anon, authenticated;

-- Quotes table
create table if not exists quotes (
  id uuid default gen_random_uuid() primary key,
  ticket_number text unique not null default next_ticket_number(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  customer_message text,
  package_type text,
  roof_type text,
  configuration jsonb,
  added_elements jsonb default '[]',
  pricing jsonb,
  status text not null default 'new'
    check (status in ('new', 'in_review', 'offer_sent', 'paid', 'cancelled')),
  offer_line_items jsonb default '[]',
  offer_total numeric,
  offer_notes text,
  klarna_order_id text,
  offer_sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS
alter table quotes enable row level security;

-- Anyone (including anonymous API calls) can submit a quote
create policy "Public submit quotes" on quotes
  for insert to anon, authenticated with check (true);

-- Only logged-in admins can read quotes
create policy "Admins read quotes" on quotes
  for select to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));

-- Only admins can update quotes
create policy "Admins update quotes" on quotes
  for update to authenticated
  using (auth.email() in ('ola@garasjeproffen.no', 'christian@garasjeproffen.no'));
