-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS map_lat      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS map_lng      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS map_rotation INTEGER,
  ADD COLUMN IF NOT EXISTS map_address  TEXT;
