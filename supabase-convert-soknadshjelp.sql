-- Add quote_id to soknadshjelp for conversion to full quote
alter table soknadshjelp add column if not exists quote_id uuid references quotes(id);
