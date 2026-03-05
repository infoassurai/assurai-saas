'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadDocument, createPolicy, getInsuranceCompanies, createInsuranceCompany, checkDuplicatePolicy, linkDocumentToPolicy } from '@/lib/database'
import { parsePolicyPDF, type ParsedPolicyData } from '@/lib/pdfParser'


interface ParsedItem {
  id: string
  fileName: string
  docId: string | null
  parsed: ParsedPolicyData | null
  status: 'pending' | 'approved' | 'rejected'
  error?: string
  saving: boolean
}

const policyTypeOptions = [
  { value: 'auto', label: 'Auto' },
  { value: 'home', label: 'Casa' },
  { value: 'life', label: 'Vita' },
  { value: 'health', label: 'Salute' },
  { value: 'other', label: 'Altro' },
]

export default function UploadPage() {
  const router = useRouter()
  const [items, setItems] = useState<ParsedItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [globalError, setGlobalError] = useState('')

  const counts = {
    total: items.length,
    pending: items.filter(i => i.status === 'pending').length,
    approved: items.filter(i => i.status === 'approved').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  }

  const pendingItems = items.filter(i => i.status === 'pending')
  const safeIndex = pendingItems.length > 0 ? Math.min(currentIndex, pendingItems.length - 1) : -1
  const currentItem = safeIndex >= 0 ? pendingItems[safeIndex] : null

  const updateParsedField = (itemId: string, field: keyof ParsedPolicyData, value: any) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId || !i.parsed) return i
      return { ...i, parsed: { ...i.parsed, [field]: value } }
    }))
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setGlobalError('')
    setProcessing(true)

    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf')
    if (pdfFiles.length === 0) {
      setGlobalError('Solo file PDF sono accettati.')
      setProcessing(false)
      return
    }

    const newItems: ParsedItem[] = []

    for (const file of pdfFiles) {
      let docId: string | null = null
      let parsedResults: ParsedPolicyData[] = []
      let error: string | undefined

      try {
        parsedResults = await parsePolicyPDF(file)
      } catch {
        error = 'Impossibile leggere il PDF'
      }

      try {
        const doc = await uploadDocument(file)
        docId = doc.id
      } catch (err: any) {
        error = err.message || 'Errore upload'
      }

      if (parsedResults.length === 0) {
        newItems.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          docId,
          parsed: null,
          status: 'pending',
          saving: false,
          error,
        })
      } else {
        for (let i = 0; i < parsedResults.length; i++) {
          newItems.push({
            id: crypto.randomUUID(),
            fileName: parsedResults.length > 1
              ? `${file.name} (polizza ${i + 1}/${parsedResults.length})`
              : file.name,
            docId,
            parsed: parsedResults[i],
            status: 'pending',
            saving: false,
            error,
          })
        }
      }
    }

    setItems(prev => [...prev, ...newItems])
    setCurrentIndex(0)
    setProcessing(false)
  }

  const updateItem = (id: string, updates: Partial<ParsedItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const handleApprove = async (item: ParsedItem) => {
    if (!item.parsed) return
    updateItem(item.id, { saving: true, error: undefined })

    try {
      let companyId: string | undefined
      if (item.parsed.companyName) {
        const companies = await getInsuranceCompanies()
        const existing = companies.find(
          (c: any) => c.name.toLowerCase() === item.parsed!.companyName!.toLowerCase()
        )
        if (existing) {
          companyId = existing.id
        } else {
          const newCompany = await createInsuranceCompany({ name: item.parsed.companyName })
          companyId = newCompany.id
        }
      }

      const policyNumber = item.parsed.policyNumber || 'DA_ASSEGNARE'

      if (policyNumber !== 'DA_ASSEGNARE') {
        const duplicates = await checkDuplicatePolicy(policyNumber, companyId)
        if (duplicates.length > 0) {
          const dup = duplicates[0]
          const dupCompany = (dup as any).insurance_companies?.name || 'N/D'
          const confirmed = window.confirm(
            `Esiste già polizza "${policyNumber}" (${dupCompany}).\nCliente: ${dup.client_name}\n\nCreare comunque?`
          )
          if (!confirmed) {
            updateItem(item.id, { saving: false })
            return
          }
        }
      }

      const policy = await createPolicy({
        policy_number: policyNumber,
        policy_type: item.parsed.policyType || 'other',
        client_name: item.parsed.clientType === 'azienda'
          ? (item.parsed.clientCompanyName || item.parsed.clientName || 'Sconosciuto')
          : (item.parsed.clientName || 'Sconosciuto'),
        client_email: item.parsed.clientEmail,
        client_phone: item.parsed.clientPhone,
        client_fiscal_code: item.parsed.clientType === 'azienda'
          ? (item.parsed.clientVatNumber || item.parsed.clientFiscalCode)
          : item.parsed.clientFiscalCode,
        premium_amount: item.parsed.premiumAmount || 0,
        effective_date: item.parsed.effectiveDate || new Date().toISOString().split('T')[0],
        expiry_date: item.parsed.expiryDate || new Date().toISOString().split('T')[0],
        company_id: companyId,
        notes: `Importata da PDF - ${item.parsed.companyName || 'N/D'} - ${item.parsed.clientType === 'azienda' ? 'Azienda' : 'Persona'}${item.parsed.productName ? ` - ${item.parsed.productName}` : ''}${item.parsed.plate ? ` - Targa: ${item.parsed.plate}` : ''}`,
      })

      if (item.docId && policy) {
        await linkDocumentToPolicy(item.docId, policy.id)
      }

      updateItem(item.id, { status: 'approved', saving: false })
    } catch (err: any) {
      updateItem(item.id, { error: err.message || 'Errore creazione polizza', saving: false })
    }
  }

  const handleReject = (item: ParsedItem) => {
    updateItem(item.id, { status: 'rejected' })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }, [])

  const inputClass = "w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Documenti</h2>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition mb-6 ${
          dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'
        }`}
      >
        <div className="text-4xl mb-3">📄</div>
        <p className="text-gray-600 mb-2">
          {processing ? 'Elaborazione PDF in corso...' : 'Trascina qui i tuoi PDF oppure'}
        </p>
        <label className="inline-block bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition cursor-pointer">
          Seleziona file
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={processing}
          />
        </label>
        <p className="text-xs text-gray-400 mt-2">Puoi selezionare più PDF contemporaneamente</p>
      </div>

      {globalError && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{globalError}</div>}

      {/* Riepilogo sessione */}
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-xs text-gray-500">Caricati</p>
            <p className="text-xl font-bold text-gray-900">{counts.total}</p>
          </div>
          <div className="bg-white rounded-xl border border-amber-200 p-3 text-center">
            <p className="text-xs text-gray-500">Da approvare</p>
            <p className="text-xl font-bold text-amber-600">{counts.pending}</p>
          </div>
          <div className="bg-white rounded-xl border border-green-200 p-3 text-center">
            <p className="text-xs text-gray-500">Approvati</p>
            <p className="text-xl font-bold text-green-600">{counts.approved}</p>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-3 text-center">
            <p className="text-xs text-gray-500">Rifiutati</p>
            <p className="text-xl font-bold text-red-500">{counts.rejected}</p>
          </div>
        </div>
      )}

      {/* Card dati editabili - solo item pending */}
      {currentItem && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {/* Header navigazione */}
          <div className="flex items-center justify-between mb-5">
            {pendingItems.length > 1 ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentIndex(Math.max(0, safeIndex - 1))}
                  disabled={safeIndex <= 0}
                  className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <span className="text-sm text-gray-600 font-medium">{safeIndex + 1} / {pendingItems.length} da approvare</span>
                <button
                  onClick={() => setCurrentIndex(Math.min(pendingItems.length - 1, safeIndex + 1))}
                  disabled={safeIndex >= pendingItems.length - 1}
                  className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </div>
            ) : (
              <span className="text-sm text-gray-600 font-medium">1 da approvare</span>
            )}
            <span className="text-sm text-gray-500 truncate max-w-[250px]">{currentItem.fileName}</span>
          </div>

          {currentItem.error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{currentItem.error}</div>
          )}

          {currentItem.parsed ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Colonna Cliente */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Dati Cliente</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tipo Cliente</label>
                      <div className="flex gap-2">
                        {(['persona', 'azienda'] as const).map(t => (
                          <button key={t} type="button"
                            onClick={() => updateParsedField(currentItem.id, 'clientType', t)}
                            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                              currentItem.parsed!.clientType === t
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}>
                            {t === 'persona' ? 'Persona' : 'Azienda'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {currentItem.parsed!.clientType === 'azienda' && (
                      <>
                        <Field label="Ragione Sociale" value={currentItem.parsed.clientCompanyName ?? ''}
                          onChange={(v) => updateParsedField(currentItem.id, 'clientCompanyName', v)} inputClass={inputClass} />
                        <Field label="P.IVA" value={currentItem.parsed.clientVatNumber ?? ''}
                          onChange={(v) => updateParsedField(currentItem.id, 'clientVatNumber', v)} inputClass={inputClass} />
                      </>
                    )}
                    <Field label={currentItem.parsed!.clientType === 'azienda' ? 'Riferimento' : 'Nome'} value={currentItem.parsed.clientName ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'clientName', v)} inputClass={inputClass} />
                    {currentItem.parsed!.clientType !== 'azienda' && (
                      <Field label="Data Nascita" value={currentItem.parsed.clientBirthDate ?? ''}
                        onChange={(v) => updateParsedField(currentItem.id, 'clientBirthDate', v)} inputClass={inputClass} />
                    )}
                    <Field label="Codice Fiscale" value={currentItem.parsed.clientFiscalCode ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'clientFiscalCode', v)} inputClass={inputClass} />
                    <Field label="Email" value={currentItem.parsed.clientEmail ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'clientEmail', v)} inputClass={inputClass} />
                    <Field label="Telefono" value={currentItem.parsed.clientPhone ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'clientPhone', v)} inputClass={inputClass} />
                    <Field label="Indirizzo" value={currentItem.parsed.clientAddress ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'clientAddress', v)} inputClass={inputClass} />
                    {currentItem.parsed!.clientType !== 'azienda' && (
                      <Field label="Professione" value={currentItem.parsed.clientProfession ?? ''}
                        onChange={(v) => updateParsedField(currentItem.id, 'clientProfession', v)} inputClass={inputClass} />
                    )}
                  </div>
                </div>

                {/* Colonna Polizza */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Dati Polizza</h4>
                  <div className="space-y-3">
                    <Field label="Compagnia" value={currentItem.parsed.companyName ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'companyName', v)} inputClass={inputClass} />
                    <Field label="Prodotto" value={currentItem.parsed.productName ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'productName', v)} inputClass={inputClass} />
                    <Field label="N. Contratto" value={currentItem.parsed.policyNumber ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'policyNumber', v)} inputClass={inputClass} />
                    <Field label="Targa" value={currentItem.parsed.plate ?? ''}
                      onChange={(v) => updateParsedField(currentItem.id, 'plate', v)} inputClass={inputClass} />
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                      <select
                        value={currentItem.parsed.policyType ?? 'other'}
                        onChange={(e) => updateParsedField(currentItem.id, 'policyType', e.target.value)}
                        className={inputClass}
                      >
                        {policyTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <Field label="Decorrenza" value={currentItem.parsed.effectiveDate ?? ''} type="date"
                      onChange={(v) => updateParsedField(currentItem.id, 'effectiveDate', v)} inputClass={inputClass} />
                    <Field label="Scadenza" value={currentItem.parsed.expiryDate ?? ''} type="date"
                      onChange={(v) => updateParsedField(currentItem.id, 'expiryDate', v)} inputClass={inputClass} />
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Premio (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={currentItem.parsed.premiumAmount ?? ''}
                        onChange={(e) => updateParsedField(currentItem.id, 'premiumAmount', e.target.value ? parseFloat(e.target.value) : null)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3">
                <button
                  onClick={() => handleApprove(currentItem)}
                  disabled={currentItem.saving}
                  className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {currentItem.saving ? 'Creazione...' : 'Approva e Crea Polizza'}
                </button>
                <button
                  onClick={() => handleReject(currentItem)}
                  disabled={currentItem.saving}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-300 hover:bg-red-50 transition disabled:opacity-50"
                >
                  Rifiuta
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Nessun dato estratto da questo PDF
            </div>
          )}
        </div>
      )}

      {/* Lista miniature */}
      {items.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Tutti i documenti</h4>
          <div className="flex flex-wrap gap-2">
            {items.map((item) => {
              const isPending = item.status === 'pending'
              const pendingIdx = pendingItems.findIndex(p => p.id === item.id)
              const isActive = currentItem?.id === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => isPending && pendingIdx >= 0 && setCurrentIndex(pendingIdx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    isActive
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : item.status === 'approved'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : item.status === 'rejected'
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  } ${isPending ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    item.status === 'approved' ? 'bg-green-500' :
                    item.status === 'rejected' ? 'bg-red-500' :
                    'bg-amber-400'
                  }`} />
                  {item.fileName.length > 20 ? item.fileName.slice(0, 17) + '...' : item.fileName}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pulsante finale */}
      {items.length > 0 && counts.pending === 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/dashboard/policies')}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            Vai alle Polizze ({counts.approved} create)
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', inputClass }: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  inputClass: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </div>
  )
}
