-- Migration: nuove funzionalità clienti, campagne, documenti

-- 1. Flag "Non contattare" per i clienti
ALTER TABLE clients ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN DEFAULT false;

-- 2. Proprietà immobiliare per i clienti
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS proprieta_immobiliare TEXT DEFAULT 'no'
    CHECK (proprieta_immobiliare IN ('no', 'si', 'piu_immobili'));

-- 3. Override destinatari per campagne
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS recipient_overrides JSONB DEFAULT '{"added":[],"removed":[]}';

-- 4. Campagne ricorrenti
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('weekly','monthly','quarterly')),
  ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;

-- 5. Collegamento documenti ai clienti
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);
