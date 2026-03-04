-- ============================================
-- COMMISSION PLANS - Piani Provvigionali
-- Eseguire su Supabase SQL Editor
-- ============================================

-- Tabella piani provvigionali per combinazione compagnia + tipo polizza
CREATE TABLE commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('auto', 'home', 'life', 'health', 'other')),
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, company_id, policy_type)
);

CREATE INDEX idx_commission_plans_tenant ON commission_plans(tenant_id);
CREATE INDEX idx_commission_plans_lookup ON commission_plans(tenant_id, company_id, policy_type);

-- RLS
ALTER TABLE commission_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_plans_all ON commission_plans FOR ALL USING (true) WITH CHECK (true);

-- Aggiungere 'missing_plan' ai tipi alert consentiti
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_type_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_type_check CHECK (type IN ('expiry', 'payment', 'renewal', 'missing_plan', 'other'));
