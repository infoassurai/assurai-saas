-- Modalità di pagamento
ALTER TABLE policies
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'contanti'
  CHECK (payment_method IN ('contanti', 'carta', 'rid', 'finanziamento'));

-- Commissione manuale (sovrascrive piano provvigionale)
ALTER TABLE policies
ADD COLUMN IF NOT EXISTS manual_commission_amount NUMERIC(12,2);

-- Nuove tipologie polizza
ALTER TABLE policies DROP CONSTRAINT IF EXISTS policies_policy_type_check;
ALTER TABLE policies ADD CONSTRAINT policies_policy_type_check
  CHECK (policy_type IN ('auto', 'home', 'life', 'health', 'other', 'previdenza', 'infortuni', 'rc'));

ALTER TABLE commission_plans DROP CONSTRAINT IF EXISTS commission_plans_policy_type_check;
ALTER TABLE commission_plans ADD CONSTRAINT commission_plans_policy_type_check
  CHECK (policy_type IN ('auto', 'home', 'life', 'health', 'other', 'previdenza', 'infortuni', 'rc'));
