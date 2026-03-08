'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  createCampaign,
  updateCampaign,
  getCampaign,
  previewCampaignAudience,
  getInsuranceCompanies,
} from '@/lib/database'
import { CAMPAIGN_PLACEHOLDERS } from '@/lib/notification-defaults'

const POLICY_TYPES = [
  { value: 'auto', label: 'Auto/Moto' },
  { value: 'home', label: 'Casa' },
  { value: 'life', label: 'Vita' },
  { value: 'health', label: 'Salute' },
  { value: 'other', label: 'Altro' },
]

function NewCampaignContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')

  const [name, setName] = useState('')
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('email')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // Filters
  const [policyTypes, setPolicyTypes] = useState<string[]>([])
  const [clientType, setClientType] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [citta, setCitta] = useState('')
  const [cap, setCap] = useState('')
  const [professione, setProfessione] = useState('')
  const [etaMin, setEtaMin] = useState('')
  const [etaMax, setEtaMax] = useState('')
  const [premioMin, setPremioMin] = useState('')
  const [premioMax, setPremioMax] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [scadenzaGiorni, setScadenzaGiorni] = useState('')

  const [companies, setCompanies] = useState<any[]>([])
  const [preview, setPreview] = useState<{ count: number; sample: any[] } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [campaignCode, setCampaignCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  useEffect(() => {
    getInsuranceCompanies().then(setCompanies).catch(() => {})
    if (editId) {
      getCampaign(editId).then(c => {
        if (!c) return
        setName(c.name)
        setChannel(c.channel)
        setSubject(c.subject ?? '')
        setBody(c.body)
        setScheduledAt(c.scheduled_at ?? '')
        if (c.code) setCampaignCode(c.code)
        const f = c.filters ?? {}
        if (f.policy_type) setPolicyTypes(f.policy_type)
        if (f.client_type) setClientType(f.client_type)
        if (f.company_id) setCompanyId(f.company_id)
        if (f.citta) setCitta(f.citta)
        if (f.cap) setCap(f.cap)
        if (f.professione) setProfessione(f.professione)
        if (f.eta_min) setEtaMin(String(f.eta_min))
        if (f.eta_max) setEtaMax(String(f.eta_max))
        if (f.premio_min) setPremioMin(String(f.premio_min))
        if (f.premio_max) setPremioMax(String(f.premio_max))
        if (f.status) setStatusFilter(f.status)
        if (f.scadenza_entro_giorni) setScadenzaGiorni(String(f.scadenza_entro_giorni))
        setShowFilters(true)
      }).catch(() => {})
    }
  }, [editId])

  const buildFilters = useCallback(() => {
    const f: Record<string, any> = {}
    if (policyTypes.length > 0) f.policy_type = policyTypes
    if (clientType) f.client_type = clientType
    if (companyId) f.company_id = companyId
    if (citta) f.citta = citta
    if (cap) f.cap = cap
    if (professione) f.professione = professione
    if (etaMin) f.eta_min = parseInt(etaMin)
    if (etaMax) f.eta_max = parseInt(etaMax)
    if (premioMin) f.premio_min = parseFloat(premioMin)
    if (premioMax) f.premio_max = parseFloat(premioMax)
    if (statusFilter) f.status = statusFilter
    if (scadenzaGiorni) f.scadenza_entro_giorni = parseInt(scadenzaGiorni)
    return f
  }, [policyTypes, clientType, companyId, citta, cap, professione, etaMin, etaMax, premioMin, premioMax, statusFilter, scadenzaGiorni])

  const handlePreview = async () => {
    setPreviewLoading(true)
    try {
      const result = await previewCampaignAudience(buildFilters(), channel)
      setPreview(result)
    } catch { }
    setPreviewLoading(false)
  }

  const handleSave = async (andSend = false) => {
    if (!name || !body) return alert('Nome e messaggio sono obbligatori')
    if (channel !== 'whatsapp' && !subject) return alert('Oggetto email obbligatorio')

    setSaving(true)
    try {
      const filters = buildFilters()
      let campaignId = editId

      if (editId) {
        await updateCampaign(editId, {
          name, channel, subject: subject || null, body, filters,
          scheduled_at: scheduledAt || null,
          status: scheduledAt ? 'scheduled' : 'draft',
        })
      } else {
        const created = await createCampaign({
          name, channel, subject: subject || undefined, body, filters,
          scheduled_at: scheduledAt || undefined,
        })
        campaignId = created.id
      }

      if (andSend && campaignId) {
        setSending(true)
        const res = await fetch('/api/campaigns/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaignId }),
        })
        const result = await res.json()
        if (result.success) {
          alert(`Campagna inviata! ${result.sent} invii, ${result.failed} errori.`)
        } else {
          alert(`Errore: ${result.errors?.join(', ') || result.error}`)
        }
      }

      router.push('/dashboard/marketing')
    } catch (err: any) {
      alert(`Errore: ${err.message}`)
    }
    setSaving(false)
    setSending(false)
  }

  const togglePolicyType = (val: string) => {
    setPolicyTypes(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  const insertPlaceholder = (key: string) => {
    setBody(prev => prev + key)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {editId ? 'Modifica Campagna' : 'Nuova Campagna'}
        </h1>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">
          Annulla
        </button>
      </div>

      {/* Info base */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Informazioni</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome campagna</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Es. Promozione primavera 2026"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Canale</label>
          <div className="flex gap-3">
            {(['email', 'whatsapp', 'both'] as const).map(ch => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                  channel === ch
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {ch === 'email' ? 'Email' : ch === 'whatsapp' ? 'WhatsApp' : 'Entrambi'}
              </button>
            ))}
          </div>
        </div>

        {/* Codice campagna */}
        {campaignCode ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Codice campagna</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-semibold text-gray-900">
                {campaignCode}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(campaignCode)
                  setCodeCopied(true)
                  setTimeout(() => setCodeCopied(false), 2000)
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                {codeCopied ? 'Copiato!' : 'Copia'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Inserisci questo codice quando crei una polizza originata da questa campagna</p>
          </div>
        ) : (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-600">Il codice campagna verra generato automaticamente al salvataggio</p>
          </div>
        )}
      </div>

      {/* Filtri target */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition"
        >
          <h2 className="font-semibold text-gray-900">Filtri Target</h2>
          <span className="text-gray-400">{showFilters ? '−' : '+'}</span>
        </button>

        {showFilters && (
          <div className="px-6 pb-6 space-y-4 border-t border-gray-100 pt-4">
            {/* Tipo polizza */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo polizza</label>
              <div className="flex flex-wrap gap-2">
                {POLICY_TYPES.map(pt => (
                  <button
                    key={pt.value}
                    onClick={() => togglePolicyType(pt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                      policyTypes.includes(pt.value)
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo cliente</label>
              <select
                value={clientType}
                onChange={e => setClientType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Tutti</option>
                <option value="persona">Persona</option>
                <option value="azienda">Azienda</option>
              </select>
            </div>

            {/* Compagnia */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compagnia assicurativa</label>
              <select
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              >
                <option value="">Tutte</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Citta + CAP + Professione */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Citta</label>
                <input type="text" value={citta} onChange={e => setCitta(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Roma" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
                <input type="text" value={cap} onChange={e => setCap(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="00100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Professione</label>
                <input type="text" value={professione} onChange={e => setProfessione(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="Medico" />
              </div>
            </div>

            {/* Eta */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Eta minima</label>
                <input type="number" value={etaMin} onChange={e => setEtaMin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="18" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Eta massima</label>
                <input type="number" value={etaMax} onChange={e => setEtaMax(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="65" />
              </div>
            </div>

            {/* Premio */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Premio min (EUR)</label>
                <input type="number" value={premioMin} onChange={e => setPremioMin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Premio max (EUR)</label>
                <input type="number" value={premioMax} onChange={e => setPremioMax(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="5000" />
              </div>
            </div>

            {/* Stato polizza + Scadenza */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stato polizza</label>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Tutti</option>
                  <option value="active">Attiva</option>
                  <option value="expired">Scaduta</option>
                  <option value="pending">In attesa</option>
                  <option value="cancelled">Annullata</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza entro (giorni)</label>
                <input type="number" value={scadenzaGiorni} onChange={e => setScadenzaGiorni(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  placeholder="30" />
              </div>
            </div>

            {/* Preview */}
            <div className="pt-2">
              <button
                onClick={handlePreview}
                disabled={previewLoading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50"
              >
                {previewLoading ? 'Calcolo...' : 'Anteprima destinatari'}
              </button>
              {preview && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">
                    {preview.count} destinatari trovati
                  </p>
                  {preview.sample.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {preview.sample.map((c: any) => (
                        <li key={c.id} className="text-xs text-gray-600">
                          {c.name} {c.email ? `(${c.email})` : ''} {c.citta ? `- ${c.citta}` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messaggio */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Messaggio</h2>

        {channel !== 'whatsapp' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto email</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              placeholder="Es. Offerta speciale per te"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Corpo del messaggio</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {CAMPAIGN_PLACEHOLDERS.map(p => (
              <button
                key={p.key}
                onClick={() => insertPlaceholder(p.key)}
                className="px-2 py-1 bg-primary-50 text-primary-700 rounded text-xs font-medium hover:bg-primary-100 transition"
                title={p.desc}
              >
                {p.key}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-y"
            placeholder="Scrivi il messaggio della campagna..."
          />
        </div>
      </div>

      {/* Programmazione */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Programmazione (opzionale)</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data e ora di invio</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">Lascia vuoto per salvare come bozza o inviare subito</p>
        </div>
      </div>

      {/* Azioni */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
        >
          {scheduledAt ? 'Programma invio' : 'Salva bozza'}
        </button>
        {!scheduledAt && (
          <button
            onClick={() => {
              if (!confirm('Inviare la campagna subito a tutti i destinatari?')) return
              handleSave(true)
            }}
            disabled={saving || sending}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            {sending ? 'Invio in corso...' : 'Invia subito'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">Caricamento...</div>}>
      <NewCampaignContent />
    </Suspense>
  )
}
