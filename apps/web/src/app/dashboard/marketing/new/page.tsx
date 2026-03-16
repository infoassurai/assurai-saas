'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  createCampaign,
  updateCampaign,
  getCampaign,
  previewCampaignAudience,
  getInsuranceCompanies,
  getDistinctProfessioni,
  getProfile,
  uploadCampaignAttachment,
  deleteCampaignAttachment,
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
  const [professioni, setProfessioni] = useState<string[]>([])
  const [professioniList, setProfessioniList] = useState<string[]>([])
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
  const [campaignCode, setCampaignCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  // Recipient overrides
  const [removedRecipients, setRemovedRecipients] = useState<Set<string>>(new Set())

  // Recurring campaign
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'monthly' | 'quarterly'>('monthly')

  // Attachments
  type CampaignAttachment = { file_name: string; file_path: string }
  const [attachments, setAttachments] = useState<CampaignAttachment[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [tenantId, setTenantId] = useState<string | null>(null)

  const activeFilterCount = [
    policyTypes.length > 0, clientType, companyId, citta, cap, professioni.length > 0,
    etaMin, etaMax, premioMin, premioMax, statusFilter, scadenzaGiorni,
  ].filter(Boolean).length

  const resetFilters = () => {
    setPolicyTypes([])
    setClientType('')
    setCompanyId('')
    setCitta('')
    setCap('')
    setProfessioni([])
    setEtaMin('')
    setEtaMax('')
    setPremioMin('')
    setPremioMax('')
    setStatusFilter('')
    setScadenzaGiorni('')
    setPreview(null)
    setRemovedRecipients(new Set())
  }

  const toggleProfessione = (val: string) => {
    setProfessioni(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  useEffect(() => {
    getInsuranceCompanies().then(setCompanies).catch(() => {})
    getDistinctProfessioni().then(setProfessioniList).catch(() => {})
    getProfile().then(p => { if (p?.tenant_id) setTenantId(p.tenant_id) }).catch(() => {})
    if (editId) {
      getCampaign(editId).then(c => {
        if (!c) return
        setName(c.name)
        setChannel(c.channel)
        setSubject(c.subject ?? '')
        setBody(c.body)
        setScheduledAt(c.scheduled_at ?? '')
        if (c.code) setCampaignCode(c.code)
        if (c.attachments) setAttachments(c.attachments)
        const f = c.filters ?? {}
        if (f.policy_type) setPolicyTypes(f.policy_type)
        if (f.client_type) setClientType(f.client_type)
        if (f.company_id) setCompanyId(f.company_id)
        if (f.citta) setCitta(f.citta)
        if (f.cap) setCap(f.cap)
        if (f.professione) setProfessioni(Array.isArray(f.professione) ? f.professione : [f.professione])
        if (f.eta_min) setEtaMin(String(f.eta_min))
        if (f.eta_max) setEtaMax(String(f.eta_max))
        if (f.premio_min) setPremioMin(String(f.premio_min))
        if (f.premio_max) setPremioMax(String(f.premio_max))
        if (f.status) setStatusFilter(f.status)
        if (f.scadenza_entro_giorni) setScadenzaGiorni(String(f.scadenza_entro_giorni))
        if (c.is_recurring) setIsRecurring(c.is_recurring)
        if (c.recurrence_type) setRecurrenceType(c.recurrence_type)
        if (c.recipient_overrides?.removed) {
          setRemovedRecipients(new Set(c.recipient_overrides.removed))
        }
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
    if (professioni.length > 0) f.professione = professioni
    if (etaMin) f.eta_min = parseInt(etaMin)
    if (etaMax) f.eta_max = parseInt(etaMax)
    if (premioMin) f.premio_min = parseFloat(premioMin)
    if (premioMax) f.premio_max = parseFloat(premioMax)
    if (statusFilter) f.status = statusFilter
    if (scadenzaGiorni) f.scadenza_entro_giorni = parseInt(scadenzaGiorni)
    return f
  }, [policyTypes, clientType, companyId, citta, cap, professioni, etaMin, etaMax, premioMin, premioMax, statusFilter, scadenzaGiorni])

  const handlePreview = async () => {
    setPreviewLoading(true)
    setRemovedRecipients(new Set())
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

      const recipientOverrides = {
        added: [],
        removed: Array.from(removedRecipients),
      }

      const nextRunAt = isRecurring && scheduledAt
        ? new Date(scheduledAt).toISOString()
        : isRecurring
          ? new Date().toISOString()
          : null

      if (editId) {
        await updateCampaign(editId, {
          name, channel, subject: subject || null, body, filters,
          scheduled_at: scheduledAt || null,
          status: scheduledAt ? 'scheduled' : 'draft',
          recipient_overrides: recipientOverrides,
          is_recurring: isRecurring,
          recurrence_type: isRecurring ? recurrenceType : null,
          next_run_at: nextRunAt,
          attachments,
        } as any)
      } else {
        const created = await createCampaign({
          name, channel, subject: subject || undefined, body, filters,
          scheduled_at: scheduledAt || undefined,
          recipient_overrides: recipientOverrides,
          is_recurring: isRecurring,
          recurrence_type: isRecurring ? recurrenceType : undefined,
          next_run_at: nextRunAt,
        } as any)
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
          alert(`Errore: ${result.errors?.join(', ') || result.error}${result.details ? ` - ${result.details}` : ''}`)
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

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editId || !tenantId) return
    setUploadingAttachment(true)
    try {
      const att = await uploadCampaignAttachment(file, tenantId, editId)
      const newAttachments = [...attachments, att]
      setAttachments(newAttachments)
      await updateCampaign(editId, { attachments: newAttachments } as any)
    } catch (err: any) {
      alert(`Errore upload: ${err.message}`)
    } finally {
      setUploadingAttachment(false)
      e.target.value = ''
    }
  }

  const handleDeleteAttachment = async (filePath: string) => {
    if (!confirm('Rimuovere questo allegato?')) return
    try {
      await deleteCampaignAttachment(filePath)
      const newAttachments = attachments.filter(a => a.file_path !== filePath)
      setAttachments(newAttachments)
      if (editId) await updateCampaign(editId, { attachments: newAttachments } as any)
    } catch (err: any) {
      alert(`Errore: ${err.message}`)
    }
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

      {/* Destinatari */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Destinatari</h2>
            <p className="text-xs text-gray-400 mt-0.5">Scegli a chi inviare la campagna. Senza filtri, verra inviata a tutti i clienti.</p>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-red-500 hover:text-red-700 font-medium transition"
            >
              Rimuovi filtri ({activeFilterCount})
            </button>
          )}
        </div>

        {/* Filtri Cliente */}
        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtri cliente</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo cliente</label>
              <select
                value={clientType}
                onChange={e => setClientType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              >
                <option value="">Tutti</option>
                <option value="persona">Persona</option>
                <option value="azienda">Azienda</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Professione</label>
              {professioniList.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 min-h-[38px] px-2 py-1.5 border border-gray-300 rounded-lg bg-white">
                  {professioniList.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => toggleProfessione(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${
                        professioni.includes(p)
                          ? 'border-primary-500 bg-primary-500 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-2">Nessuna professione in anagrafica</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Citta</label>
              <input type="text" value={citta} onChange={e => setCitta(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                placeholder="Es. Roma" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">CAP</label>
              <input type="text" value={cap} onChange={e => setCap(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                placeholder="Es. 00100" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Eta min</label>
                <input type="number" value={etaMin} onChange={e => setEtaMin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  placeholder="18" />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">Eta max</label>
                <input type="number" value={etaMax} onChange={e => setEtaMax(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  placeholder="65" />
              </div>
            </div>
          </div>
        </div>

        {/* Filtri Polizza */}
        <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtri polizza</p>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Tipo polizza</label>
            <div className="flex flex-wrap gap-2">
              {POLICY_TYPES.map(pt => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => togglePolicyType(pt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition cursor-pointer ${
                    policyTypes.includes(pt.value)
                      ? 'border-primary-500 bg-primary-500 text-white shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Compagnia</label>
              <select
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
              >
                <option value="">Tutte</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Stato polizza</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white">
                <option value="">Tutti</option>
                <option value="active">Attiva</option>
                <option value="expired">Scaduta</option>
                <option value="pending">In attesa</option>
                <option value="cancelled">Annullata</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Premio min</label>
              <div className="relative">
                <input type="number" value={premioMin} onChange={e => setPremioMin(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  placeholder="0" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">EUR</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Premio max</label>
              <div className="relative">
                <input type="number" value={premioMax} onChange={e => setPremioMax(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  placeholder="5000" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">EUR</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Scadenza entro</label>
              <div className="relative">
                <input type="number" value={scadenzaGiorni} onChange={e => setScadenzaGiorni(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                  placeholder="30" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">gg</span>
              </div>
            </div>
          </div>
        </div>

        {/* Anteprima destinatari */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 border border-primary-200 transition disabled:opacity-50"
          >
            {previewLoading ? 'Calcolo...' : 'Verifica destinatari'}
          </button>
          {preview && (
            <span className={`text-sm font-semibold ${preview.count > 0 ? 'text-green-600' : 'text-orange-500'}`}>
              {preview.count} {preview.count === 1 ? 'destinatario' : 'destinatari'} trovati
            </span>
          )}
        </div>

        {preview && preview.sample.length > 0 && (
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 uppercase">Anteprima destinatari</p>
              {removedRecipients.size > 0 && (
                <span className="text-xs text-orange-600 font-medium">{removedRecipients.size} esclusi manualmente</span>
              )}
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase border-t border-gray-100">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Citta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.sample.map((c: any) => {
                  const isRemoved = removedRecipients.has(c.id)
                  return (
                    <tr key={c.id} className={isRemoved ? 'opacity-40' : ''}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={!isRemoved}
                          onChange={() => {
                            setRemovedRecipients(prev => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id)
                              else next.add(c.id)
                              return next
                            })
                          }}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-900">{c.name}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{c.email || '-'}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{c.citta || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {preview.count > preview.sample.length && (
              <div className="px-3 py-1.5 bg-gray-50 text-xs text-gray-400 text-center">
                ...e altri {preview.count - preview.sample.length} (visibili solo i primi 10; le esclusioni si applicano all&apos;intera lista al momento dell&apos;invio)
              </div>
            )}
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

      {/* Allegati */}
      {(channel === 'email' || channel === 'both') && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Allegati email</h2>
              <p className="text-xs text-gray-400 mt-0.5">I file allegati vengono inviati insieme all&apos;email a tutti i destinatari.</p>
            </div>
            {editId && (
              <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                uploadingAttachment
                  ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400'
                  : 'border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100'
              }`}>
                {uploadingAttachment ? 'Caricamento...' : '+ Aggiungi allegato'}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploadingAttachment}
                  onChange={handleAttachmentUpload}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
              </label>
            )}
          </div>

          {!editId ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-amber-500 mt-0.5">&#9888;</span>
              <p className="text-sm text-amber-700">Salva prima la campagna per poter aggiungere allegati.</p>
            </div>
          ) : attachments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
              Nessun allegato. PDF, immagini e documenti Word sono supportati.
            </div>
          ) : (
            <div className="space-y-2">
              {attachments.map(att => (
                <div key={att.file_path} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{att.file_name}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteAttachment(att.file_path)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0 font-medium"
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

        <div className="border-t border-gray-100 pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">Campagna ricorrente</span>
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-7">La campagna si ripete automaticamente alla frequenza selezionata</p>

          {isRecurring && (
            <div className="mt-3 ml-7">
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequenza</label>
              <div className="flex gap-2">
                {(['weekly', 'monthly', 'quarterly'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setRecurrenceType(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      recurrenceType === type
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {type === 'weekly' ? 'Settimanale' : type === 'monthly' ? 'Mensile' : 'Trimestrale'}
                  </button>
                ))}
              </div>
            </div>
          )}
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
