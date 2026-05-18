-- Migration: Add Altinn/personnummer fields to nabovarsel_naboer
-- Run after supabase-nabovarsel.sql

ALTER TABLE nabovarsel_naboer
  ADD COLUMN IF NOT EXISTS eier_personnummer   TEXT,        -- 11-digit Norwegian personal ID (for Altinn lookup)
  ADD COLUMN IF NOT EXISTS altinn_correspondence_id TEXT,  -- returned by Altinn after send
  ADD COLUMN IF NOT EXISTS send_method         TEXT;        -- "altinn" | "email" | "brev"
