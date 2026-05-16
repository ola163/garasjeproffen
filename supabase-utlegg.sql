create table if not exists utlegg (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  submitted_by text not null,
  paid_by text,
  amount numeric(10,2) not null,
  description text not null,
  category text not null,
  ticket_number text,
  image_url text,
  notes text
);

-- If table already exists, add the column:
alter table utlegg add column if not exists paid_by text;

-- Storage bucket (run in Supabase Dashboard → Storage → New bucket):
-- Name: utlegg-kvitteringer, Public: true
