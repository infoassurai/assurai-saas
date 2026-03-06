-- Aggiunge colonna client_type alla tabella policies
-- Valori: 'persona' (persona fisica) o 'azienda' (azienda/società)
ALTER TABLE policies
ADD COLUMN client_type TEXT DEFAULT 'persona' CHECK (client_type IN ('persona', 'azienda'));
