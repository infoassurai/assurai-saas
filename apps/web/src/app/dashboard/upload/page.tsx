'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { uploadDocument, createPolicy, getInsuranceCompanies, createInsuranceCompany, checkDuplicatePolicy, linkDocumentToPolicy } from '@/lib/database'
import { parsePolicyPDF, type ParsedPolicyData } from '@/lib/pdfParser'

export default function UploadPage() {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null)

  // Dati estratti dal PDF
  const [parsedData, setParsedData] = useState<ParsedPolicyData | null>(null)
  const [saving, setSaving] = useState(false)

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]

    if (file.type !== 'application/pdf') {
      setError('Solo file PDF sono accettati.')
      return
    }

    setError('')
    setSuccess('')
    setParsedData(null)

    // Step 1: Parse OCR
    setParsing(true)
    try {
      const data = await parsePolicyPDF(file)
      setParsedData(data)
    } catch (err: any) {
      console.error('Errore parsing:', err)
      setError('Impossibile leggere il PDF. Verrà caricato senza estrazione dati.')
    } finally {
      setParsing(false)
    }

    // Step 2: Upload su storage
    setUploading(true)
    try {
      const doc = await uploadDocument(file)
      setUploadedDocId(doc.id)
      setSuccess('File caricato con successo')
    } catch (err: any) {
      setError(err.message || 'Errore durante il caricamento')
    } finally {
      setUploading(false)
    }
  }

  const handleCreatePolicy = async () => {
    if (!parsedData) return
    setSaving(true)
    try {
      // Se c'è una compagnia nel PDF, cercala o creala automaticamente
      let companyId: string | undefined
      if (parsedData.companyName) {
        const companies = await getInsuranceCompanies()
        const existing = companies.find(
          (c: any) => c.name.toLowerCase() === parsedData.companyName!.toLowerCase()
        )
        if (existing) {
          companyId = existing.id
        } else {
          const newCompany = await createInsuranceCompany({ name: parsedData.companyName })
          companyId = newCompany.id
        }
      }

      const policyNumber = parsedData.policyNumber || 'DA_ASSEGNARE'

      // Check duplicato
      if (policyNumber !== 'DA_ASSEGNARE') {
        const duplicates = await checkDuplicatePolicy(policyNumber, companyId)
        if (duplicates.length > 0) {
          const dup = duplicates[0]
          const dupCompany = (dup as any).insurance_companies?.name || 'N/D'
          const confirmed = window.confirm(
            `Attenzione: esiste già una polizza con numero "${policyNumber}" (${dupCompany}).\n\n` +
            `Cliente: ${dup.client_name}\nStato: ${dup.status}\n\n` +
            `Vuoi crearla comunque?`
          )
          if (!confirmed) {
            setSaving(false)
            return
          }
        }
      }

      const policy = await createPolicy({
        policy_number: policyNumber,
        policy_type: parsedData.policyType || 'other',
        client_name: parsedData.clientName || 'Sconosciuto',
        client_email: parsedData.clientEmail,
        client_phone: parsedData.clientPhone,
        client_fiscal_code: parsedData.clientFiscalCode,
        premium_amount: parsedData.premiumAmount || 0,
        effective_date: parsedData.effectiveDate || new Date().toISOString().split('T')[0],
        expiry_date: parsedData.expiryDate || new Date().toISOString().split('T')[0],
        company_id: companyId,
        notes: `Importata da PDF - ${parsedData.companyName || 'N/D'}${parsedData.productName ? ` - ${parsedData.productName}` : ''}`,
      })

      // Collega il documento alla polizza creata
      if (uploadedDocId && policy) {
        await linkDocumentToPolicy(uploadedDocId, policy.id)
      }

      router.push('/dashboard/policies')
    } catch (err: any) {
      setError(err.message || 'Errore creazione polizza')
    } finally {
      setSaving(false)
    }
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
          {parsing ? 'Analisi PDF in corso...' : uploading ? 'Caricamento...' : 'Trascina qui il tuo PDF oppure'}
        </p>
        <label className="inline-block bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition cursor-pointer">
          Seleziona file
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
            disabled={uploading || parsing}
          />
        </label>
        <p className="text-xs text-gray-400 mt-2">Solo file PDF — i dati verranno estratti automaticamente</p>
      </div>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3 mb-4">{success}</div>}

      {/* Dati Estratti */}
      {parsedData && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Dati Estratti dal PDF</h3>
            {parsedData.companyName && (
              <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">
                {parsedData.companyName}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Colonna cliente */}
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Dati Cliente</h4>
              <div className="space-y-2 text-sm">
                <DataRow label="Nome" value={parsedData.clientName} />
                <DataRow label="Data Nascita" value={parsedData.clientBirthDate} />
                <DataRow label="Codice Fiscale" value={parsedData.clientFiscalCode} />
                <DataRow label="Email" value={parsedData.clientEmail} />
                <DataRow label="Telefono" value={parsedData.clientPhone} />
                <DataRow label="Indirizzo" value={parsedData.clientAddress} />
                <DataRow label="Professione" value={parsedData.clientProfession} />
              </div>
            </div>

            {/* Colonna polizza */}
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Dati Polizza</h4>
              <div className="space-y-2 text-sm">
                <DataRow label="Compagnia" value={parsedData.companyName} />
                <DataRow label="Prodotto" value={parsedData.productName} />
                <DataRow label="N. Contratto" value={parsedData.policyNumber} />
                <DataRow label="Tipo" value={parsedData.policyType} />
                <DataRow label="Decorrenza" value={parsedData.effectiveDate} />
                <DataRow label="Scadenza" value={parsedData.expiryDate} />
                <DataRow label="Premio" value={parsedData.premiumAmount != null ? `€ ${parsedData.premiumAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : undefined} />
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={handleCreatePolicy}
              disabled={saving}
              className="bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
            >
              {saving ? 'Creazione...' : 'Crea Polizza dai Dati Estratti'}
            </button>
            <button
              onClick={() => setParsedData(null)}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition"
            >
              Ignora
            </button>
          </div>
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
