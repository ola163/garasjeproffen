create table if not exists messe_notater (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  url text,
  url_label text,
  created_at timestamptz default now()
);
