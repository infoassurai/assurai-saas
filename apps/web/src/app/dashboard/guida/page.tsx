'use client'

import { useState } from 'react'

const sections = [
  {
    icon: '📊',
    title: 'Dashboard',
    content: [
      'Panoramica generale del tuo portafoglio assicurativo con statistiche chiave',
      'Grafici interattivi: andamento polizze, premi, distribuzione per compagnia',
      'Ripartizione del portafoglio per compagnia assicurativa',
      'Attività recente: ultime polizze create, modificate o in scadenza',
      'Indicatori rapidi: totale polizze attive, premi annuali, clienti',
    ],
  },
  {
    icon: '📋',
    title: 'Polizze',
    content: [
      'Lista completa di tutte le polizze con ricerca e filtri avanzati (stato, compagnia, tipo, date)',
      'Creazione nuova polizza con tutti i dati: cliente, compagnia, tipo, numero, date, premio',
      'Dettaglio polizza con storico modifiche e documenti allegati',
      'Modifica e eliminazione polizze esistenti',
      'Gestione rinnovo: rinnova una polizza con aggiornamento automatico delle date',
      'Export CSV: scarica l\'elenco polizze filtrato in formato CSV',
    ],
  },
  {
    icon: '👥',
    title: 'Clienti',
    content: [
      'Anagrafica completa dei clienti (persone fisiche e aziende)',
      'Ricerca e filtri per nome, email, codice fiscale, tipo cliente',
      'Creazione nuovo cliente con dati anagrafici, contatti e indirizzo',
      'Scheda dettaglio cliente con elenco di tutte le polizze collegate',
      'Modifica e eliminazione clienti',
    ],
  },
  {
    icon: '📤',
    title: 'Upload',
    content: [
      'Import massivo di polizze da file PDF tramite OCR (riconoscimento ottico)',
      'Drag & drop: trascina uno o più PDF per avviare l\'estrazione automatica dei dati',
      'Revisione dei dati estratti prima dell\'importazione definitiva',
      'Approvazione singola o massiva delle polizze estratte',
      'Rilevamento automatico dei duplicati per evitare inserimenti doppi',
      'Supporto per documenti di diverse compagnie assicurative',
    ],
  },
  {
    icon: '💰',
    title: 'Commissioni',
    content: [
      'Tracking delle commissioni maturate sulle polizze',
      'Piani commissione personalizzabili per compagnia e tipo polizza',
      'Configurazione percentuali provvigionali per ogni combinazione compagnia/tipo',
      'Applicazione retroattiva: aggiorna le commissioni su polizze già esistenti',
      'Riepilogo commissioni con totali per periodo',
    ],
  },
  {
    icon: '⏰',
    title: 'Scadenze',
    content: [
      'Monitor scadenze polizze organizzate per urgenza:',
      '• Entro 30 giorni – preavviso standard',
      '• Entro 15 giorni – urgenza media',
      '• Entro 7 giorni – urgenza alta',
      '• Già scadute – azione immediata richiesta',
      'Archiviazione scadenze già gestite per mantenere la lista pulita',
      'Indicatori di stato email/WhatsApp: vedi se il cliente è già stato contattato',
      'Badge nella sidebar con il conteggio delle scadenze attive',
    ],
  },
  {
    icon: '🔔',
    title: 'Alerts',
    content: [
      'Avvisi operativi automatici per situazioni che richiedono attenzione:',
      '• Pagamenti mancanti o in ritardo',
      '• Documenti mancanti o incompleti',
      '• Piani commissione non configurati per compagnie/tipi polizza in uso',
      'Gestione degli avvisi: segna come letto o archivia',
    ],
  },
  {
    icon: '📣',
    title: 'Marketing',
    content: [
      'Creazione campagne di comunicazione email e WhatsApp',
      'Targeting clienti: seleziona i destinatari in base a filtri (tipo polizza, scadenza, compagnia)',
      'Composizione messaggio con editor integrato',
      'Invio campagna ai destinatari selezionati',
      'Monitoraggio stato: vedi quanti messaggi sono stati inviati, consegnati, aperti',
    ],
  },
  {
    icon: '✉️',
    title: 'Template Invio',
    content: [
      'Personalizzazione dei messaggi di notifica scadenza per ogni fase:',
      '• Template 30 giorni – primo avviso',
      '• Template 15 giorni – sollecito',
      '• Template 7 giorni – urgente',
      '• Template scaduta – polizza già scaduta',
      'Variabili dinamiche disponibili: nome cliente, numero polizza, data scadenza, tipo polizza',
      'Anteprima del messaggio prima del salvataggio',
    ],
  },
  {
    icon: '⚙️',
    title: 'Impostazioni',
    content: [
      'Profilo utente: modifica nome, email e dati dell\'agenzia',
      'Preferenze notifiche: scegli orario di invio e canali (email/WhatsApp) per ogni fase di scadenza',
      'Gestione compagnie assicurative: aggiungi, modifica o rimuovi le compagnie con cui lavori',
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
