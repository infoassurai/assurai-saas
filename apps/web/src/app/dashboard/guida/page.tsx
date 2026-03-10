'use client'

import { useState } from 'react'

const sections = [
  {
    icon: '📊',
    title: 'Dashboard',
    content: [
      'Panoramica generale del tuo portafoglio assicurativo con statistiche chiave',
      'Indicatori rapidi: polizze attive, polizze in scadenza (30gg), nuove polizze del mese, premio totale portafoglio, premio medio, commissioni mensili',
      'Grafici interattivi: andamento commissioni mensili, distribuzione per tipo polizza, ripartizione stati polizze',
      'Tabella portafoglio per compagnia assicurativa con conteggi e premi',
      'Tabella performance subagenti (visibile solo agli admin)',
      'Attività recente: ultime polizze create o modificate con link diretto',
    ],
  },
  {
    icon: '📋',
    title: 'Polizze',
    content: [
      'Lista completa di tutte le polizze con ricerca e filtri avanzati (stato, tipo, tipo cliente)',
      'Creazione nuova polizza con tutti i dati: cliente, compagnia, tipo, numero, date, premio',
      'Frazionamento pagamento obbligatorio: annuale, semestrale, mensile o rateizzata (10 rate)',
      'Calcolo automatico della prossima scadenza rata in base al frazionamento scelto',
      'Colonna "Scad. Rata" nella lista con colori di urgenza: rosso (scaduta), arancione (< 7gg), giallo (< 30gg)',
      'Dettaglio polizza con modifica inline e breakdown commissioni',
      'Gestione rinnovo: rinnova una polizza con aggiornamento automatico delle date e pre-compilazione dati',
      'Rilevamento automatico duplicati prima della creazione',
      'Codice campagna: associa la polizza a una campagna marketing per il tracking',
      'Export CSV: scarica l\'elenco polizze filtrato con tutti i campi incluso frazionamento e scadenza rata',
      'Eliminazione polizza con conferma',
    ],
  },
  {
    icon: '👥',
    title: 'Clienti',
    content: [
      'Anagrafica completa dei clienti: persone fisiche e aziende',
      'Ricerca e filtri per nome, email, codice fiscale, tipo cliente, città',
      'Creazione nuovo cliente con dati anagrafici completi: nome, email, telefono, codice fiscale, data nascita, sesso, professione',
      'Indirizzo completo: città, CAP, provincia, via',
      'Scheda dettaglio cliente con elenco di tutte le polizze collegate e statistiche',
      'Modifica e eliminazione clienti',
    ],
  },
  {
    icon: '📤',
    title: 'Upload PDF',
    content: [
      'Import massivo di polizze da file PDF tramite OCR (riconoscimento ottico del testo)',
      'Drag & drop: trascina uno o più PDF per avviare l\'estrazione automatica dei dati',
      'Supporto multi-formato: Generali, Allianz, Assimedici e altri',
      'Estrazione automatica di: numero polizza, date, dati cliente, premio, targa, compagnia',
      'Riconoscimento tipo cliente (persona/azienda) con P.IVA e codice fiscale',
      'Supporto per più polizze estratte da un singolo PDF',
      'Revisione e modifica dei dati estratti prima dell\'approvazione',
      'Selezione obbligatoria del frazionamento pagamento prima dell\'approvazione',
      'Scadenza mancante: viene calcolata automaticamente a +1 anno dalla decorrenza',
      'Approvazione singola o massiva delle polizze estratte',
      'Rilevamento automatico dei duplicati per evitare inserimenti doppi',
      'Creazione automatica della compagnia se non presente nel sistema',
      'Collegamento automatico del documento PDF alla polizza creata',
      'Riepilogo sessione con conteggi: caricati, da approvare, approvati, rifiutati',
    ],
  },
  {
    icon: '💰',
    title: 'Commissioni',
    content: [
      'Due sezioni: lista commissioni e piani provvigionali',
      'Lista commissioni con filtro per stato: in attesa, pagate, annullate',
      'Tipologia commissione: iniziale, rinnovo, bonus',
      'Ruolo commissione: diretta (agente), subagente, override',
      'Piani commissione personalizzabili per combinazione compagnia + tipo polizza',
      'Creazione automatica della commissione alla creazione di una polizza',
      'Lookup gerarchico: piano specifico > piano per compagnia > piano globale > fallback 10%',
      'Applicazione retroattiva: aggiorna le commissioni su polizze già esistenti quando cambi un piano',
      'Segnalazione piani mancanti: alert automatico quando crei una polizza senza piano configurato',
      'Modifica percentuale inline direttamente dalla lista piani',
    ],
  },
  {
    icon: '⏰',
    title: 'Scadenze',
    content: [
      'Monitor scadenze polizze E rate organizzate per urgenza:',
      '• Già scadute – azione immediata richiesta',
      '• Entro 1 giorno – scadenza imminente',
      '• Entro 7 giorni – urgenza alta',
      '• Entro 15 giorni – urgenza media',
      '• Entro 30 giorni – preavviso standard',
      'Badge distinto per tipo: "Scadenza Polizza" (blu) vs "Scadenza Rata" (arancione)',
      'Bordi colorati per urgenza: rosso, arancione, giallo, blu',
      'Indicatori di stato email/WhatsApp: vedi se il cliente è già stato contattato',
      'Generazione automatica degli alert alla creazione della polizza e tramite cron giornaliero',
      'Segna come letto (singolo o tutti), archivia le scadenze gestite',
      'Filtro per mostrare/nascondere gli alert archiviati',
      'Badge nella sidebar con conteggio scadenze attive non lette',
    ],
  },
  {
    icon: '🔔',
    title: 'Alerts',
    content: [
      'Avvisi operativi automatici per situazioni che richiedono attenzione:',
      '• Scadenza rata pagamento – per polizze con frazionamento non annuale',
      '• Documenti mancanti o incompleti',
      '• Piani commissione non configurati per compagnie/tipi polizza in uso',
      '• Avvisi personalizzati',
      'Gestione degli avvisi: segna come letto o archivia',
      'Filtro per mostrare/nascondere gli archiviati',
    ],
  },
  {
    icon: '📣',
    title: 'Marketing',
    content: [
      'Creazione campagne di comunicazione via email e/o WhatsApp',
      'Targeting avanzato con filtri multipli:',
      '• Tipo polizza (auto, casa, vita, salute, altro)',
      '• Tipo cliente (persona/azienda)',
      '• Compagnia assicurativa',
      '• Città e CAP',
      '• Professione (selezione multipla dai dati estratti)',
      '• Fascia di età',
      '• Range premio annuo',
      '• Stato polizza e giorni alla scadenza',
      'Anteprima audience: vedi quanti clienti corrispondono ai filtri prima dell\'invio',
      'Codice campagna generato automaticamente per tracking conversioni',
      'Programmazione invio: invia subito o pianifica per una data futura',
      'Monitoraggio stato campagna: bozza, programmata, in invio, inviata, fallita',
      'Statistiche invio: messaggi inviati, destinatari totali',
      'Modifica campagne in bozza, eliminazione campagne',
    ],
  },
  {
    icon: '👤',
    title: 'Subagenti',
    content: [
      'Gestione rete subagenti con gerarchia agente-subagente',
      'Creazione subagente: email, nome, password, telefono (opzionale)',
      'Statistiche: subagenti attivi, commissioni override del mese',
      'Dettaglio subagente con 3 tab:',
      '• Piani: piani provvigionali specifici per il subagente (per compagnia + tipo)',
      '• Polizze: tutte le polizze assegnate al subagente con totali',
      '• Commissioni: tutte le commissioni del subagente con ruolo e stato',
      'Confronto piani subagente con piani dell\'agente principale',
      'Lookup commissione gerarchico: piano specifico compagnia+tipo > piano per compagnia > piano globale > 50% del tasso agente',
      'Commissione override automatica: l\'agente principale riceve la differenza tra il suo piano e quello del subagente',
    ],
  },
  {
    icon: '✉️',
    title: 'Template Notifiche',
    content: [
      'Personalizzazione dei messaggi di notifica scadenza per ogni fase:',
      '• Template 30 giorni – primo avviso',
      '• Template 15 giorni – sollecito',
      '• Template 7 giorni – urgente',
      '• Template scaduta – polizza già scaduta',
      'Canali separati: template email (oggetto + corpo) e template WhatsApp (solo corpo)',
      'Variabili dinamiche disponibili: {CLIENTE}, {POLIZZA}, {TIPO}, {SCADENZA}, {AGENTE}, {AGENZIA}',
      'Se non personalizzi: vengono usati i template predefiniti del sistema',
    ],
  },
  {
    icon: '💳',
    title: 'Frazionamento Pagamento',
    content: [
      'Ogni polizza richiede obbligatoriamente il tipo di frazionamento:',
      '• Annuale – scadenza rata coincide con scadenza polizza',
      '• Semestrale – rata ogni 6 mesi dalla decorrenza',
      '• Mensile – rata ogni mese dalla decorrenza',
      '• Rateizzata – 10 rate su 12 mesi (si salta il mese dopo e il mese prima dell\'anniversario)',
      'Calcolo automatico della prossima scadenza rata (>= oggi)',
      'Campo "Prossima Scadenza Rata" visibile in tempo reale nel form',
      'Colonna "Scad. Rata" nella lista polizze con colorazione urgenza',
      'Notifiche separate: la scadenza rata genera un alert distinto dalla scadenza polizza',
      'Nessun duplicato: se scadenza rata e polizza coincidono viene inviata una sola notifica',
      'Ricalcolo automatico della prossima rata dopo che quella corrente è scaduta',
      'Gestione edge case: giorno 31 in mesi corti (cap all\'ultimo giorno del mese)',
      'Incluso nell\'export CSV e nel rinnovo polizza',
    ],
  },
  {
    icon: '⚙️',
    title: 'Impostazioni',
    content: [
      'Profilo utente: modifica nome, telefono e nome dell\'agenzia',
      'Lista cose da fare (Todo): crea e gestisci promemoria operativi',
      'Gestione compagnie assicurative: aggiungi o rimuovi le compagnie con cui lavori',
      'Preferenze notifiche:',
      '• Indirizzo email mittente per le notifiche',
      '• Numero WhatsApp mittente',
      '• Orario invio notifiche automatiche (ora CET)',
      '• Attiva/disattiva email e WhatsApp per ogni fase di scadenza (30gg, 15gg, 7gg, scaduta)',
    ],
  },
]

const globalFeatures = [
  {
    icon: '🔍',
    title: 'Ricerca Globale',
    description: 'Dalla barra di ricerca in alto puoi cercare polizze, clienti e campagne in un unico punto. I risultati appaiono in tempo reale mentre digiti.',
  },
  {
    icon: '🔴',
    title: 'Badge Notifiche',
    description: 'Nella sidebar vengono mostrati i badge con il conteggio delle scadenze attive e degli avvisi non letti, così sai sempre cosa richiede la tua attenzione.',
  },
  {
    icon: '🤖',
    title: 'Automazioni',
    description: 'Commissioni create automaticamente alla creazione polizza. Alert scadenza generati in tempo reale. Notifiche email/WhatsApp inviate automaticamente tramite cron giornaliero. Ricalcolo scadenza rata dopo ogni rata scaduta.',
  },
  {
    icon: '🏢',
    title: 'Multi-Tenant',
    description: 'Ogni agenzia ha il proprio spazio isolato. I dati sono separati per tenant e i subagenti vedono solo le proprie polizze e commissioni.',
  },
]

export default function GuidaPage() {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set())

  const toggle = (index: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const expandAll = () => {
    setOpenSections(new Set(sections.map((_, i) => i)))
  }

  const collapseAll = () => {
    setOpenSections(new Set())
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guida</h1>
          <p className="text-gray-500 mt-1">
            Scopri tutte le funzionalità di ASSURAI e come utilizzarle al meglio.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1.5 rounded-lg hover:bg-primary-50 transition"
          >
            Espandi tutto
          </button>
          <button
            onClick={collapseAll}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            Comprimi tutto
          </button>
        </div>
      </div>

      {/* Sezioni principali */}
      <div className="space-y-3 mb-8">
        {sections.map((section, index) => {
          const isOpen = openSections.has(index)
          return (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => toggle(index)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition"
              >
                <span className="text-xl">{section.icon}</span>
                <span className="font-semibold text-gray-900 flex-1">
                  {section.title}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {isOpen && (
                <div className="px-5 pb-4 pt-0">
                  <ul className="space-y-2 ml-9">
                    {section.content.map((line, i) => (
                      <li key={i} className="text-sm text-gray-600 leading-relaxed">
                        {line.startsWith('•') ? (
                          <span className="ml-2">{line}</span>
                        ) : (
                          <>
                            <span className="text-gray-300 mr-2">–</span>
                            {line}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Funzionalità globali */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Funzionalità globali
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {globalFeatures.map((feature, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-xl p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{feature.icon}</span>
                <h3 className="font-semibold text-gray-900">{feature.title}</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
