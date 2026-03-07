-- Aggiunge colonne per configurazione notifiche per tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_email TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_whatsapp TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS notification_cron_hour INTEGER DEFAULT 8;

-- Aggiunge policy UPDATE per tenants (mancante)
CREATE POLICY "Users can update their own tenant"
  ON tenants FOR UPDATE
  USING (id = get_user_tenant_id());
