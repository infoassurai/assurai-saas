-- Migration: comunicazioni dirette ai clienti
CREATE TABLE IF NOT EXISTS client_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  subject TEXT,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  sent_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'partial')),
  attachments JSONB DEFAULT '[]',
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_client_comms_client ON client_communications(client_id);
ALTER TABLE client_communications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for client_communications"
  ON client_communications FOR ALL
  USING (tenant_id = get_user_tenant_id());
