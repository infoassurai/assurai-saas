-- Aggiunge frazionamento pagamento alle polizze
-- Eseguire in Supabase SQL Editor

-- Colonna tipo frazionamento
ALTER TABLE policies
ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'annuale'
  CHECK (payment_frequency IN ('annuale', 'semestrale', 'mensile', 'rateizzata'));

-- Colonna data scadenza prossima rata
ALTER TABLE policies
ADD COLUMN IF NOT EXISTS payment_expiry_date DATE;

-- Indice per query scadenze rata
CREATE INDEX IF NOT EXISTS idx_policies_payment_expiry ON policies(payment_expiry_date);

-- Popola le polizze esistenti: annuale = scadenza rata coincide con scadenza polizza
UPDATE policies SET payment_expiry_date = expiry_date WHERE payment_expiry_date IS NULL;
