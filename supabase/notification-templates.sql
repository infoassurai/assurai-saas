-- Aggiunge colonne per configurazione notifiche per tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_whatsapp TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_cron_hour INTEGER DEFAULT 8;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{
  "30gg": {"email": true, "whatsapp": false},
  "15gg": {"email": true, "whatsapp": false},
  "7gg": {"email": true, "whatsapp": false},
  "scaduta": {"email": true, "whatsapp": false}
}'::jsonb;

-- Aggiunge policy UPDATE per tenants (mancante)
DO $$ BEGIN
  CREATE POLICY "Users can update their own tenant"
    ON tenants FOR UPDATE
    USING (id = get_user_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabella template notifiche personalizzati per tenant
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('30gg', '15gg', '7gg', 'scaduta')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject TEXT, -- solo per email
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, stage, channel)
);

-- RLS per notification_templates
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own templates"
  ON notification_templates FOR SELECT
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can insert their own templates"
  ON notification_templates FOR INSERT
  WITH CHECK (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can update their own templates"
  ON notification_templates FOR UPDATE
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Users can delete their own templates"
  ON notification_templates FOR DELETE
  USING (tenant_id = get_user_tenant_id());
