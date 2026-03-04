-- ASSURAI Database Schema
-- Eseguire su Supabase SQL Editor

-- ============================================
-- TABELLA: tenants (multi-tenancy)
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABELLA: profiles (estende auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent', 'viewer')),
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABELLA: insurance_companies (compagnie)
-- ============================================
CREATE TABLE insurance_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABELLA: policies (polizze)
-- ============================================
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES insurance_companies(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  policy_number TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('auto', 'home', 'life', 'health', 'other')),

  -- Cliente
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  client_fiscal_code TEXT,

  -- Importi
  premium_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Date
  effective_date DATE NOT NULL,
  expiry_date DATE NOT NULL,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending', 'cancelled')),
  notes TEXT,

  -- Metadati OCR/AI
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ocr', 'api')),
  ocr_confidence NUMERIC(5,2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABELLA: commissions (commissioni)
-- ============================================
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(5,2),
  type TEXT NOT NULL DEFAULT 'initial' CHECK (type IN ('initial', 'renewal', 'bonus')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABELLA: alerts (scadenze e notifiche)
-- ============================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('expiry', 'payment', 'document', 'custom')),
  title TEXT NOT NULL,
  message TEXT,
  due_date TIMESTAMPTZ NOT NULL,

  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,

  channel TEXT DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'whatsapp')),
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABELLA: documents (PDF uploadati)
-- ============================================
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,

  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT DEFAULT 'application/pdf',

  ocr_status TEXT DEFAULT 'pending' CHECK (ocr_status IN ('pending', 'processing', 'completed', 'failed')),
  ocr_text TEXT,

  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDICI
-- ============================================
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_insurance_companies_tenant ON insurance_companies(tenant_id);
CREATE INDEX idx_policies_tenant ON policies(tenant_id);
CREATE INDEX idx_policies_company ON policies(company_id);
CREATE INDEX idx_policies_agent ON policies(agent_id);
CREATE INDEX idx_policies_expiry ON policies(expiry_date);
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_commissions_tenant ON commissions(tenant_id);
CREATE INDEX idx_commissions_policy ON commissions(policy_id);
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_alerts_due_date ON alerts(due_date);
CREATE INDEX idx_alerts_unread ON alerts(tenant_id, is_read) WHERE is_read = false;
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_policy ON documents(policy_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Funzione helper per ottenere il tenant_id dell'utente corrente
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- TENANTS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tenant"
  ON tenants FOR SELECT
  USING (id = get_user_tenant_id());

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view profiles in their tenant"
  ON profiles FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- INSURANCE COMPANIES
ALTER TABLE insurance_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for insurance_companies"
  ON insurance_companies FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- POLICIES
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for policies"
  ON policies FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- COMMISSIONS
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for commissions"
  ON commissions FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- ALERTS
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for alerts"
  ON alerts FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- DOCUMENTS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for documents"
  ON documents FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- ============================================
-- TRIGGER: updated_at automatico
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON insurance_companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
