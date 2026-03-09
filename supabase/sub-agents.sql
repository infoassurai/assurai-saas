-- ASSURAI Sub-Agents Migration
-- Gestione rete subagenti con piani provvigionali separati

-- ============================================
-- 1A. Modificare profiles: aggiungere parent_agent_id e ruolo subagent
-- ============================================

-- Rimuovere il vecchio CHECK constraint sul ruolo
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Aggiungere il nuovo CHECK con 'subagent'
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'agent', 'subagent', 'viewer'));

-- Aggiungere colonna parent_agent_id
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS parent_agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Indice per query subagenti di un agente
CREATE INDEX IF NOT EXISTS idx_profiles_parent_agent ON profiles(parent_agent_id);

-- ============================================
-- 1B. Nuova tabella: sub_agent_commission_plans
-- ============================================
CREATE TABLE IF NOT EXISTS sub_agent_commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sub_agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES insurance_companies(id) ON DELETE CASCADE,
  policy_type TEXT CHECK (policy_type IS NULL OR policy_type IN ('auto', 'home', 'life', 'health', 'other')),
  percentage NUMERIC(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Priorità lookup: specifico > per compagnia > globale
  -- specifico: (sub_agent_id, company_id, policy_type) tutti valorizzati
  -- per compagnia: (sub_agent_id, company_id, NULL)
  -- globale: (sub_agent_id, NULL, NULL)
  UNIQUE(tenant_id, sub_agent_id, company_id, policy_type)
);

CREATE INDEX IF NOT EXISTS idx_sub_agent_plans_agent ON sub_agent_commission_plans(sub_agent_id);
CREATE INDEX IF NOT EXISTS idx_sub_agent_plans_tenant ON sub_agent_commission_plans(tenant_id);

-- Trigger updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sub_agent_commission_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 1C. Modificare commissions: aggiungere commission_role e parent_commission_id
-- ============================================

ALTER TABLE commissions ADD COLUMN IF NOT EXISTS commission_role TEXT DEFAULT 'agent'
  CHECK (commission_role IN ('agent', 'subagent', 'override'));

ALTER TABLE commissions ADD COLUMN IF NOT EXISTS parent_commission_id UUID REFERENCES commissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_role ON commissions(commission_role);
CREATE INDEX IF NOT EXISTS idx_commissions_parent ON commissions(parent_commission_id);

-- ============================================
-- 1D. RLS per sub_agent_commission_plans
-- ============================================
ALTER TABLE sub_agent_commission_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for sub_agent_commission_plans"
  ON sub_agent_commission_plans FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- ============================================
-- 1E. Helper function per ruolo utente
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role() RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- 1F. RLS aggiornata per subagenti su policies
-- ============================================
-- Rimuovere policy esistente e ricreare con visibilità subagente
DROP POLICY IF EXISTS "Tenant isolation for policies" ON policies;

CREATE POLICY "Tenant isolation for policies"
  ON policies FOR ALL
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      get_user_role() IN ('admin', 'agent', 'viewer')
      OR agent_id = auth.uid()  -- subagent vede solo le proprie
    )
  );

-- ============================================
-- 1G. RLS aggiornata per subagenti su commissions
-- ============================================
DROP POLICY IF EXISTS "Tenant isolation for commissions" ON commissions;

CREATE POLICY "Tenant isolation for commissions"
  ON commissions FOR ALL
  USING (
    tenant_id = get_user_tenant_id()
    AND (
      get_user_role() IN ('admin', 'agent', 'viewer')
      OR agent_id = auth.uid()  -- subagent vede solo le proprie
    )
  );

-- ============================================
-- 1H. Permettere a admin/agent di inserire profili (per creare subagenti)
-- ============================================
CREATE POLICY "Admin can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('admin', 'agent')
  );
