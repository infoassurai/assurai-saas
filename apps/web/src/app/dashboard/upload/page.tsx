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

  const currentItem = items[currentIndex] ?? null

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
      const item: ParsedItem = {
        id: crypto.randomUUID(),
        fileName: file.name,
        docId: null,
        parsed: null,
        status: 'pending',
        saving: false,
      }

      // Parse
      try {
        item.parsed = await parsePolicyPDF(file)
      } catch {
        item.error = 'Impossibile leggere il PDF'
      }

      // Upload
      try {
        const doc = await uploadDocument(file)
        item.docId = doc.id
      } catch (err: any) {
        item.error = err.message || 'Errore upload'
      }

      newItems.push(item)
    }

    setItems(prev => {
      const updated = [...prev, ...newItems]
      // Naviga al primo nuovo item pending
      const firstNewIndex = prev.length
      setCurrentIndex(firstNewIndex)
      return updated
    })
    setProcessing(false)
  }

  const updateItem = (id: string, updates: Partial<ParsedItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i))
  }

  const handleApprove = async (item: ParsedItem) => {
    if (!item.parsed) return
    updateItem(item.id, { saving: true })

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
        client_name: item.parsed.clientName || 'Sconosciuto',
        client_email: item.parsed.clientEmail,
        client_phone: item.parsed.clientPhone,
        client_fiscal_code: item.parsed.clientFiscalCode,
        premium_amount: item.parsed.premiumAmount || 0,
        effective_date: item.parsed.effectiveDate || new Date().toISOString().split('T')[0],
        expiry_date: item.parsed.expiryDate || new Date().toISOString().split('T')[0],
        company_id: companyId,
        notes: `Importata da PDF - ${item.parsed.companyName || 'N/D'}${item.parsed.productName ? ` - ${item.parsed.productName}` : ''}`,
      })

      if (item.docId && policy) {
        await linkDocumentToPolicy(item.docId, policy.id)
      }

      updateItem(item.id, { status: 'approved', saving: false })
      goToNextPending(item.id)
    } catch (err: any) {
      updateItem(item.id, { error: err.message || 'Errore creazione polizza', saving: false })
    }
  }

  const handleReject = (item: ParsedItem) => {
    updateItem(item.id, { status: 'rejected' })
    goToNextPending(item.id)
  }

  const goToNextPending = (currentId: string) => {
    setItems(prev => {
      const nextIndex = prev.findIndex((i, idx) => idx > prev.findIndex(x => x.id === currentId) && i.status === 'pending')
      if (nextIndex !== -1) {
        setTimeout(() => setCurrentIndex(nextIndex), 100)
      }
      return prev
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleUpload(e.dataTransfer.files)
  }, [])

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

      {/* Navigazione + Card dati */}
      {items.length > 0 && currentItem && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          {/* Header con navigazione */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <span className="text-sm text-gray-600 font-medium">
                {currentIndex + 1} / {items.length}
              </span>
              <button
                onClick={() => setCurrentIndex(Math.min(items.length - 1, currentIndex + 1))}
                disabled={currentIndex === items.length - 1}
                className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 truncate max-w-[200px]">{currentItem.fileName}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                currentItem.status === 'approved' ? 'bg-green-100 text-green-700' :
                currentItem.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {currentItem.status === 'approved' ? 'Approvato' :
                 currentItem.status === 'rejected' ? 'Rifiutato' : 'In attesa'}
              </span>
            </div>
          </div>

          {currentItem.error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{currentItem.error}</div>
          )}

          {currentItem.parsed ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Dati Estratti</h3>
                {currentItem.parsed.companyName && (
                  <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
                    {currentItem.parsed.companyName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Dati Cliente</h4>
                  <div className="space-y-2 text-sm">
                    <DataRow label="Nome" value={currentItem.parsed.clientName} />
                    <DataRow label="Data Nascita" value={currentItem.parsed.clientBirthDate} />
                    <DataRow label="Codice Fiscale" value={currentItem.parsed.clientFiscalCode} />
                    <DataRow label="Email" value={currentItem.parsed.clientEmail} />
                    <DataRow label="Telefono" value={currentItem.parsed.clientPhone} />
                    <DataRow label="Indirizzo" value={currentItem.parsed.clientAddress} />
                    <DataRow label="Professione" value={currentItem.parsed.clientProfession} />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Dati Polizza</h4>
                  <div className="space-y-2 text-sm">
                    <DataRow label="Compagnia" value={currentItem.parsed.companyName} />
                    <DataRow label="Prodotto" value={currentItem.parsed.productName} />
                    <DataRow label="N. Contratto" value={currentItem.parsed.policyNumber} />
                    <DataRow label="Tipo" value={currentItem.parsed.policyType} />
                    <DataRow label="Decorrenza" value={currentItem.parsed.effectiveDate} />
                    <DataRow label="Scadenza" value={currentItem.parsed.expiryDate} />
                    <DataRow label="Premio" value={currentItem.parsed.premiumAmount != null ? `€ ${currentItem.parsed.premiumAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : undefined} />
                  </div>
                </div>
              </div>

              {currentItem.status === 'pending' && (
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
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-400">
              Nessun dato estratto da questo PDF
            </div>
          )}
        </div>
      )}

      {/* Lista miniature tutti i PDF */}
      {items.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Tutti i documenti</h4>
          <div className="flex flex-wrap gap-2">
            {items.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setCurrentIndex(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  idx === currentIndex
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : item.status === 'approved'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : item.status === 'rejected'
                    ? 'border-red-200 bg-red-50 text-red-600'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  item.status === 'approved' ? 'bg-green-500' :
                  item.status === 'rejected' ? 'bg-red-500' :
                  'bg-amber-400'
                }`} />
                {item.fileName.length > 20 ? item.fileName.slice(0, 17) + '...' : item.fileName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pulsante vai a polizze quando tutto approvato */}
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

function DataRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex">
      <span className="text-gray-400 w-32 shrink-0">{label}</span>
      <span className={value ? 'text-gray-900 font-medium' : 'text-gray-300'}>
        {value || '—'}
      </span>
    </div>
  )
}
