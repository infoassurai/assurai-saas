# ASSURAI - AI-Powered Insurance SaaS

ASSURAI è una piattaforma SaaS intelligente per agenti e broker assicurativi. Gestisci polizze, clienti, commissioni, scadenze e campagne marketing da un'unica dashboard.

## Funzionalità

### Gestione Polizze
- CRUD completo polizze con ricerca, filtri avanzati e export CSV
- Frazionamento pagamento: annuale, semestrale, mensile, rateizzata (10 rate su 12 mesi)
- Calcolo automatico prossima scadenza rata con colorazione urgenza
- Rinnovo polizza con pre-compilazione dati
- Rilevamento automatico duplicati
- Codice campagna per tracking conversioni

### Import PDF (OCR)
- Upload drag & drop singolo o massivo
- Estrazione automatica dati da PDF (Generali, Allianz, Assimedici e altri)
- Riconoscimento tipo cliente (persona/azienda), targa, P.IVA
- Revisione, modifica e approvazione (singola o massiva) dei dati estratti
- Creazione automatica compagnia se non presente
- Collegamento automatico del documento alla polizza

### Clienti
- Anagrafica completa: persone fisiche e aziende
- Dati anagrafici, contatti, indirizzo, professione
- Scheda cliente con polizze collegate e statistiche

### Commissioni
- Tracking commissioni: iniziale, rinnovo, bonus
- Piani provvigionali per compagnia + tipo polizza
- Creazione automatica alla creazione polizza
- Applicazione retroattiva dei piani
- Alert automatico per piani mancanti

### Subagenti
- Rete subagenti con gerarchia agente-subagente
- Piani provvigionali specifici per subagente
- Commissione override automatica (differenza tra piano agente e piano subagente)
- Dashboard performance subagenti

### Scadenze e Notifiche
- Monitor scadenze per urgenza (scadute, 1gg, 7gg, 15gg, 30gg)
- Alert separati per scadenza polizza e scadenza rata
- Notifiche automatiche via email (Resend) e WhatsApp (Twilio)
- Cron giornaliero con orario configurabile per tenant
- Template notifiche personalizzabili per ogni fase
- Deduplicazione notifiche (nessun doppio invio)

### Marketing
- Campagne email e/o WhatsApp
- Targeting avanzato: tipo polizza, tipo cliente, compagnia, città, CAP, professione, età, premio, scadenza
- Anteprima audience con conteggio destinatari
- Codice campagna per tracking
- Programmazione invio o invio immediato

### Dashboard
- Statistiche: polizze attive, in scadenza, premi, commissioni
- Grafici: andamento commissioni, distribuzione tipo polizza, stati
- Portafoglio per compagnia
- Performance subagenti (admin)
- Attività recente

### Impostazioni
- Profilo utente e dati agenzia
- Gestione compagnie assicurative
- Preferenze notifiche (canali, orario, fasi)
- Todo list operativa

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Database**: PostgreSQL (Supabase) con RLS multi-tenant
- **Auth**: Supabase Auth (email/password)
- **Email**: Resend
- **WhatsApp**: Twilio (opzionale)
- **OCR PDF**: pdfjs-dist
- **Charts**: Recharts
- **Package Manager**: pnpm (monorepo)

## Quick Start

```bash
pnpm install
pnpm dev
```

App: http://localhost:3000

## Variabili d'Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=ASSURAI <noreply@tuodominio.it>
CRON_SECRET=tuo-secret-random
# Opzionali
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

## Migrazione Database

Eseguire gli script SQL nella cartella `supabase/` nel Supabase SQL Editor:

1. `schema.sql` - Schema base
2. `add-client-type.sql` - Tipo cliente persona/azienda
3. `sub-agents.sql` - Subagenti e piani commissione
4. `commission-plans.sql` - Piani provvigionali
5. `notification-templates.sql` - Template notifiche
6. `marketing-campaigns.sql` - Campagne marketing
7. `campaign-tracking.sql` - Tracking campagne
8. `todos.sql` - Todo list
9. `add-payment-frequency.sql` - Frazionamento pagamento

## Cron Notifiche

Configurare un cron job (Vercel Cron o cron-job.org) per chiamare ogni giorno:

```
GET /api/cron/notify
Authorization: Bearer <CRON_SECRET>
```

## Licenza

MIT
