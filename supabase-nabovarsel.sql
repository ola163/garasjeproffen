-- Nabovarsel: digital nabovarsling (plan- og bygningsloven § 21-3, SAK10 § 5-2)
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS nabovarsel (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID        REFERENCES quotes(id) ON DELETE CASCADE,
  adresse     TEXT,
  kommunenr   TEXT,
  gnr         INT,
  bnr         INT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  tiltaket    TEXT,       -- Description of the building measure
  status      TEXT        NOT NULL DEFAULT 'utkast',
  -- utkast | sendt | purring_sendt | ferdig
  frist       TIMESTAMPTZ,
  notat       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nabovarsel_naboer (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nabovarsel_id       UUID        NOT NULL REFERENCES nabovarsel(id) ON DELETE CASCADE,
  gnr                 INT,
  bnr                 INT,
  snr                 INT         DEFAULT 0,
  fnr                 INT         DEFAULT 0,
  kommunenr           TEXT,
  eiendom_adresse     TEXT,       -- address of the neighboring property
  eier_navn           TEXT,       -- owner name (manually entered)
  eier_postadresse    TEXT,       -- postal address for letters
  eier_epost          TEXT,       -- email for digital nabovarsel
  status              TEXT        NOT NULL DEFAULT 'ikke_sendt',
  -- ikke_sendt | sendt | purring_sendt | ingen_merknad | merknad_mottatt
  sendt_at            TIMESTAMPTZ,
  purring_sendt_at    TIMESTAMPTZ,
  svar_mottatt_at     TIMESTAMPTZ,
  svar_tekst          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at auto-trigger
CREATE OR REPLACE FUNCTION nabovarsel_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS nabovarsel_updated_at ON nabovarsel;
CREATE TRIGGER nabovarsel_updated_at
  BEFORE UPDATE ON nabovarsel
  FOR EACH ROW EXECUTE FUNCTION nabovarsel_set_updated_at();

-- RLS: service role only (all admin access goes through service-role API)
ALTER TABLE nabovarsel        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nabovarsel_naboer ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only" ON nabovarsel;
DROP POLICY IF EXISTS "service_only" ON nabovarsel_naboer;

CREATE POLICY "service_only" ON nabovarsel
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_only" ON nabovarsel_naboer
  FOR ALL TO service_role USING (true) WITH CHECK (true);
