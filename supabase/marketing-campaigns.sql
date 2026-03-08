-- ============================================
-- MARKETING CAMPAIGNS - Migration
-- ============================================

-- 1. Tabella clients (profilo esteso clienti)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  fiscal_code TEXT,
  client_type TEXT DEFAULT 'persona' CHECK (client_type IN ('persona', 'azienda')),
  data_nascita DATE,
  sesso TEXT CHECK (sesso IN ('M', 'F')),
  professione TEXT,
  citta TEXT,
  cap TEXT,
  indirizzo TEXT,
  provincia TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indici clients
CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_clients_tenant_email ON clients(tenant_id, email);
CREATE INDEX idx_clients_tenant_fiscal ON clients(tenant_id, fiscal_code);
CREATE INDEX idx_clients_tenant_citta ON clients(tenant_id, citta);
CREATE INDEX idx_clients_tenant_cap ON clients(tenant_id, cap);

-- RLS clients
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for clients"
  ON clients FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- 2. FK su policies -> clients
ALTER TABLE policies ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);
CREATE INDEX IF NOT EXISTS idx_policies_client ON policies(client_id);

-- 3. Migrazione dati esistenti: crea clients da policies
-- Deduplica per fiscal_code > email > name (entro lo stesso tenant)
INSERT INTO clients (tenant_id, name, email, phone, fiscal_code, client_type)
SELECT DISTINCT ON (
  p.tenant_id,
  COALESCE(NULLIF(p.client_fiscal_code, ''), COALESCE(NULLIF(p.client_email, ''), p.client_name))
)
  p.tenant_id,
  p.client_name,
  p.client_email,
  p.client_phone,
  p.client_fiscal_code,
  COALESCE(p.client_type, 'persona')
FROM policies p
WHERE p.client_id IS NULL
ORDER BY
  p.tenant_id,
  COALESCE(NULLIF(p.client_fiscal_code, ''), COALESCE(NULLIF(p.client_email, ''), p.client_name)),
  p.created_at DESC;

-- 4. Link policies ai clients appena creati
-- Match per fiscal_code (priorita massima)
UPDATE policies p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NULL
  AND p.tenant_id = c.tenant_id
  AND p.client_fiscal_code IS NOT NULL
  AND p.client_fiscal_code != ''
  AND p.client_fiscal_code = c.fiscal_code;

-- Match per email
UPDATE policies p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NULL
  AND p.tenant_id = c.tenant_id
  AND p.client_email IS NOT NULL
  AND p.client_email != ''
  AND p.client_email = c.email;

-- Match per nome (fallback)
UPDATE policies p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NULL
  AND p.tenant_id = c.tenant_id
  AND p.client_name = c.name;

-- 5. Tabella campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  filters JSONB DEFAULT '{}'::jsonb,
  stats JSONB DEFAULT '{"sent":0,"failed":0,"total":0}'::jsonb,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for campaigns"
  ON campaigns FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- 6. Tabella campaign_sends
CREATE TABLE IF NOT EXISTS campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaign_sends_campaign ON campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_client ON campaign_sends(client_id);
CREATE INDEX idx_campaign_sends_status ON campaign_sends(campaign_id, status);

ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for campaign_sends"
  ON campaign_sends FOR ALL
  USING (tenant_id = get_user_tenant_id());
