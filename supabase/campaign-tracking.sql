-- Campaign Tracking: codice univoco campagna + tracciamento polizze
-- Eseguire su Supabase SQL Editor

-- Codice univoco per campagna (es. CAMP-A1B2C3)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- Referenza campagna sulla polizza (opzionale)
ALTER TABLE policies ADD COLUMN IF NOT EXISTS campaign_code TEXT;
CREATE INDEX IF NOT EXISTS idx_policies_campaign_code ON policies(campaign_code);
