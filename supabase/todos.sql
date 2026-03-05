-- ============================================
-- TODOS - Note implementazioni future
-- Eseguire su Supabase SQL Editor
-- ============================================

CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  text TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_todos_tenant ON todos(tenant_id);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY todos_all ON todos FOR ALL USING (true) WITH CHECK (true);

-- Seed TODO iniziali (da eseguire DOPO aver creato almeno un utente)
-- Sostituire TENANT_ID con il proprio tenant_id reale
-- INSERT INTO todos (tenant_id, text) VALUES
--   ('TENANT_ID', 'Template OCR per altre compagnie (Allianz, UnipolSai, AXA, Zurich)'),
--   ('TENANT_ID', 'Rinnovo automatico polizze in scadenza'),
--   ('TENANT_ID', 'Notifiche email/SMS scadenze'),
--   ('TENANT_ID', 'Integrazione Stripe per abbonamenti'),
--   ('TENANT_ID', 'Dashboard multi-agente (ruoli e permessi)'),
--   ('TENANT_ID', 'Report PDF mensile commissioni'),
--   ('TENANT_ID', 'App mobile (PWA)');
