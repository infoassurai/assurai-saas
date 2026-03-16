'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { getClient, updateClient, deleteClient, getClientDocuments, uploadClientDocument, deleteDocument, getDocumentSignedUrl, getProfile, getClientCommunications, uploadCommunicationAttachment, deleteCommunicationAttachment } from '@/lib/database'

const statusLabels: Record<string, string> = {
  active: 'Attiva', expired: 'Scaduta', pending: 'In attesa', cancelled: 'Annullata',
}
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-500',
}
const typeLabels: Record<string, string> = {
  auto: 'Auto', home: 'Casa', life: 'Vita', health: 'Salute', other: 'Altro',
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', email: '', phone: '', fiscal_code: '', client_type: 'persona',
    data_nascita: '', sesso: '', professione: '', citta: '', cap: '',
    indirizzo: '', provincia: '', notes: '',
  })
  const [doNotContact, setDoNotContact] = useState(false)
  const [proprietaImmobiliare, setProprietaImmobiliare] = useState('no')

  // Documents
  const [documents, setDocuments] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)

  // Communications
  type CommAttachment = { file_name: string; file_path: string }
  const [showCommForm, setShowCommForm] = useState(false)
  const [commChannel, setCommChannel] = useState<'email' | 'whatsapp' | 'both'>('email')
  const [commSubject, setCommSubject] = useState('')
  const [commBody, setCommBody] = useState('')
  const [commAttachments, setCommAttachments] = useState<CommAttachment[]>([])
  const [sendingComm, setSendingComm] = useState(false)
  const [uploadingCommAtt, setUploadingCommAtt] = useState(false)
  const [communications, setCommunications] = useState<any[]>([])
  const [tenantId, setTenantId] = useState<string | null>(null)

  useEffect(() => {
    getClient(id).then((data) => {
      setClient(data)
      setForm({
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        fiscal_code: data.fiscal_code || '',
        client_type: data.client_type || 'persona',
        data_nascita: data.data_nascita || '',
        sesso: data.sesso || '',
        professione: data.professione || '',
        citta: data.citta || '',
        cap: data.cap || '',
        indirizzo: data.indirizzo || '',
        provincia: data.provincia || '',
        notes: data.notes || '',
      })
      setDoNotContact(data.do_not_contact ?? false)
      setProprietaImmobiliare(data.proprieta_immobiliare ?? 'no')
      setLoading(false)
    }).catch((err) => {
      setError(err.message)
      setLoading(false)
    })
    loadDocuments()
    loadCommunications()
    getProfile().then(p => { if (p?.tenant_id) setTenantId(p.tenant_id) }).catch(() => {})
  }, [id])

  const loadDocuments = async () => {
    setDocsLoading(true)
    try {
      const docs = await getClientDocuments(id)
      setDocuments(docs)
    } catch (err) {
      console.error(err)
    } finally {
      setDocsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await updateClient(id, { ...form, do_not_contact: doNotContact, proprieta_immobiliare: proprietaImmobiliare })
      setEditing(false)
      const updated = await getClient(id)
      setClient(updated)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Sei sicuro di voler eliminare questo cliente?')) return
    try {
      await deleteClient(id)
      router.push('/dashboard/clients')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    try {
      await uploadClientDocument(file, id)
      await loadDocuments()
    } catch (err: any) {
      alert(`Errore upload: ${err.message}`)
    } finally {
      setUploadLoading(false)
      e.target.value = ''
    }
  }

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const url = await getDocumentSignedUrl(filePath)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
    } catch (err: any) {
      alert(`Errore download: ${err.message}`)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Eliminare questo documento?')) return
    try {
      await deleteDocument(docId)
      await loadDocuments()
    } catch (err: any) {
      alert(`Errore: ${err.message}`)
    }
  }

  const loadCommunications = async () => {
    try {
      const comms = await getClientCommunications(id)
      setCommunications(comms)
    } catch (err) {
      console.error(err)
    }
  }

  const handleCommAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    setUploadingCommAtt(true)
    try {
      const att = await uploadCommunicationAttachment(file, id, tenantId)
      setCommAttachments(prev => [...prev, att])
    } catch (err: any) {
      alert(`Errore upload: ${err.message}`)
    } finally {
      setUploadingCommAtt(false)
      e.target.value = ''
    }
  }

  const handleDeleteCommAttachment = async (filePath: string) => {
    try {
      await deleteCommunicationAttachment(filePath)
      setCommAttachments(prev => prev.filter(a => a.file_path !== filePath))
    } catch (err: any) {
      alert(`Errore: ${err.message}`)
    }
  }

  const handleSendCommunication = async () => {
    if (!commBody.trim()) return alert('Scrivi un messaggio')
    if ((commChannel === 'email' || commChannel === 'both') && !commSubject.trim()) return alert('Inserisci un oggetto')
    setSendingComm(true)
    try {
      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: id,
          channel: commChannel,
          subject: commSubject || undefined,
          body: commBody,
          attachments: commAttachments,
        }),
      })
      const result = await res.json()
      if (result.success || result.status === 'partial') {
        setShowCommForm(false)
        setCommBody('')
        setCommSubject('')
        setCommAttachments([])
        setCommChannel('email')
        await loadCommunications()
        if (result.status === 'partial') alert(`Comunicazione inviata parzialmente: ${result.error}`)
      } else {
        alert(`Errore: ${result.error || 'Invio fallito'}`)
      }
    } catch (err: any) {
      alert(`Errore: ${err.message}`)
    } finally {
      setSendingComm(false)
    }
  }

  if (loading) return <div className="text-gray-400 p-8">Caricamento...</div>
  if (!client) return <div className="text-red-500 p-8">Cliente non trovato</div>

  const policies = client.policies || []
  const activePolicies = policies.filter((p: any) => p.status === 'active')
  const totalPremium = activePolicies.reduce((s: number, p: any) => s + (p.premium_amount || 0), 0)

  const inputClass = editing
    ? 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none'
    : 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-default'

  const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/clients" className="text-gray-400 hover:text-gray-600">&larr;</Link>
        <h2 className="text-2xl font-bold text-gray-900 flex-1">{client.name}</h2>
        {client.do_not_contact && (
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Non contattare</span>
        )}
        {!client.do_not_contact && (
          <button
            onClick={() => setShowCommForm(v => !v)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            {showCommForm ? 'Annulla' : 'Invia comunicazione'}
          </button>
        )}
      </div>

      {/* Pannello comunicazione */}
      {showCommForm && (
        <div className="bg-white rounded-xl border border-primary-200 p-6 space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Nuova comunicazione</h3>

          {/* Canale */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Canale</label>
            <div className="flex gap-2">
              {(['email', 'whatsapp', 'both'] as const).map(ch => (
                <button
                  key={ch}
                  onClick={() => setCommChannel(ch)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                    commChannel === ch
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {ch === 'email' ? 'Email' : ch === 'whatsapp' ? 'WhatsApp' : 'Entrambi'}
                </button>
              ))}
            </div>
          </div>

          {/* Subject (email only) */}
          {(commChannel === 'email' || commChannel === 'both') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto</label>
              <input
                type="text"
                value={commSubject}
                onChange={e => setCommSubject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Oggetto email"
              />
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio</label>
            <textarea
              value={commBody}
              onChange={e => setCommBody(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y"
              placeholder="Scrivi il messaggio..."
            />
          </div>

          {/* Allegati (solo email) */}
          {(commChannel === 'email' || commChannel === 'both') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Allegati</label>
                <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  uploadingCommAtt
                    ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400'
                    : 'border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100'
                }`}>
                  {uploadingCommAtt ? 'Caricamento...' : '+ Allega file'}
                  <input type="file" className="hidden" disabled={uploadingCommAtt} onChange={handleCommAttachmentUpload} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                </label>
              </div>
              {commAttachments.length === 0 ? (
                <p className="text-xs text-gray-400">Nessun allegato</p>
              ) : (
                <div className="space-y-1">
                  {commAttachments.map(att => (
                    <div key={att.file_path} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-sm">
                      <span className="flex-1 truncate text-gray-800">{att.file_name}</span>
                      <button onClick={() => handleDeleteCommAttachment(att.file_path)} className="text-xs text-red-500 hover:text-red-700 shrink-0">Rimuovi</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={handleSendCommunication}
              disabled={sendingComm}
              className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
            >
              {sendingComm ? 'Invio in corso...' : 'Invia'}
            </button>
            <button
              onClick={() => { setShowCommForm(false); setCommBody(''); setCommSubject(''); setCommAttachments([]) }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Polizze Attive</p>
          <p className="text-xl font-bold text-blue-700">{activePolicies.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Totale Polizze</p>
          <p className="text-xl font-bold text-gray-700">{policies.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Premio Totale Attivo</p>
          <p className="text-xl font-bold text-green-700">{fmt(totalPremium)}</p>
        </div>
      </div>

      {/* Dati Anagrafici */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Dati Anagrafici</h3>
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input name="name" value={form.name} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" value={form.email} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
            <input name="phone" value={form.phone} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
            <input name="fiscal_code" value={form.fiscal_code} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select name="client_type" value={form.client_type} onChange={handleChange} disabled={!editing} className={inputClass}>
              <option value="persona">Persona</option>
              <option value="azienda">Azienda</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data di Nascita</label>
            <input name="data_nascita" type="date" value={form.data_nascita} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sesso</label>
            <select name="sesso" value={form.sesso} onChange={handleChange} disabled={!editing} className={inputClass}>
              <option value="">—</option>
              <option value="M">Maschio</option>
              <option value="F">Femmina</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Professione</label>
            <input name="professione" value={form.professione} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Proprieta Immobiliare</label>
            <select name="proprieta_immobiliare" value={proprietaImmobiliare} onChange={e => setProprietaImmobiliare(e.target.value)} disabled={!editing} className={inputClass}>
              <option value="no">No</option>
              <option value="si">Si (1 immobile)</option>
              <option value="piu_immobili">Si (piu immobili)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Citta</label>
            <input name="citta" value={form.citta} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
            <input name="cap" value={form.cap} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
            <input name="provincia" value={form.provincia} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
            <input name="indirizzo" value={form.indirizzo} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea name="notes" rows={3} value={form.notes} onChange={handleChange} readOnly={!editing}
              className={`${inputClass} resize-none`} />
          </div>
        </div>

        {/* Non contattare toggle */}
        <div className="border-t border-gray-100 pt-4">
          <label className={`flex items-center gap-3 ${editing ? 'cursor-pointer' : 'cursor-default'}`}>
            <input
              type="checkbox"
              checked={doNotContact}
              onChange={e => editing && setDoNotContact(e.target.checked)}
              disabled={!editing}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium text-gray-700">Non contattare</span>
            {doNotContact && (
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Attivo</span>
            )}
          </label>
          <p className="text-xs text-gray-400 mt-1 ml-7">Questo cliente non ricevera notifiche o campagne marketing</p>
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-100">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving}
                className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                {saving ? 'Salvataggio...' : 'Salva'}
              </button>
              <button onClick={() => setEditing(false)}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition">
                Annulla
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition">
                Modifica
              </button>
              <button onClick={handleDelete}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition">
                Elimina
              </button>
            </>
          )}
        </div>
      </div>

      {/* Polizze collegate */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Polizze Collegate</h3>
        {policies.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessuna polizza collegata a questo cliente.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 font-medium text-gray-600">N. Polizza</th>
                  <th className="text-left py-2 font-medium text-gray-600">Tipo</th>
                  <th className="text-left py-2 font-medium text-gray-600">Stato</th>
                  <th className="text-left py-2 font-medium text-gray-600">Scadenza</th>
                  <th className="text-right py-2 font-medium text-gray-600">Premio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {policies.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/dashboard/policies/${p.id}`} className="text-primary-600 hover:underline font-medium">
                        {p.policy_number}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-600">{typeLabels[p.policy_type] ?? p.policy_type}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status]}`}>
                        {statusLabels[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-600">{p.expiry_date ? new Date(p.expiry_date).toLocaleDateString('it-IT') : '—'}</td>
                    <td className="py-2 text-right text-gray-900">{fmt(p.premium_amount || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Documenti cliente */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Documenti</h3>
          <label className={`cursor-pointer px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition ${uploadLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {uploadLoading ? 'Caricamento...' : '+ Carica documento'}
            <input
              type="file"
              className="hidden"
              disabled={uploadLoading}
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            />
          </label>
        </div>

        {docsLoading ? (
          <p className="text-gray-400 text-sm">Caricamento documenti...</p>
        ) : documents.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessun documento caricato per questo cliente.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.file_name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(doc.created_at).toLocaleDateString('it-IT')} &middot; {(doc.file_size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(doc.file_path, doc.file_name)}
                  className="text-xs text-primary-600 hover:underline font-medium shrink-0"
                >
                  Scarica
                </button>
                <button
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="text-xs text-red-500 hover:text-red-700 shrink-0"
                >
                  Elimina
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Storico comunicazioni */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Storico comunicazioni</h3>
        {communications.length === 0 ? (
          <p className="text-gray-400 text-sm">Nessuna comunicazione inviata a questo cliente.</p>
        ) : (
          <div className="space-y-3">
            {communications.map((comm: any) => {
              const statusColors: Record<string, string> = {
                sent: 'bg-green-100 text-green-700',
                failed: 'bg-red-100 text-red-700',
                partial: 'bg-yellow-100 text-yellow-700',
              }
              const channelLabel: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp', both: 'Email + WhatsApp' }
              return (
                <div key={comm.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    {comm.subject && <p className="text-sm font-medium text-gray-900 truncate">{comm.subject}</p>}
                    <p className="text-sm text-gray-600 line-clamp-2">{comm.body}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{new Date(comm.sent_at).toLocaleString('it-IT')}</span>
                      <span className="text-xs text-gray-400">&middot;</span>
                      <span className="text-xs text-gray-500">{channelLabel[comm.channel] ?? comm.channel}</span>
                      {comm.attachments?.length > 0 && (
                        <>
                          <span className="text-xs text-gray-400">&middot;</span>
                          <span className="text-xs text-gray-500">{comm.attachments.length} allegat{comm.attachments.length === 1 ? 'o' : 'i'}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusColors[comm.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {comm.status === 'sent' ? 'Inviata' : comm.status === 'failed' ? 'Fallita' : 'Parziale'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
