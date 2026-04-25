-- Consent columns for user_profiles
-- Run this in the Supabase SQL editor before deploying the consent changes.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS terms_accepted          boolean      DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS terms_accepted_at       timestamptz;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS terms_version           text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS privacy_policy_version  text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS marketing_consent       boolean      DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS marketing_consent_at    timestamptz;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consent_source          text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consent_user_agent      text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS consent_ip              text;
