'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createPolicy, getInsuranceCompanies, checkDuplicatePolicy } from '@/lib/database'

export default function NewPolicyPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    policy_number: '',
    policy_type: 'auto',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_fiscal_code: '',
    premium_amount: '',
    effective_date: '',
    expiry_date: '',
    company_id: '',
    status: 'active',
    notes: '',
  })

  useEffect(() => {
    getInsuranceCompanies().then(setCompanies).catch(console.error)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const savePolicy = async () => {
    setLoading(true)
    try {
      await createPolicy({
        ...form,
        premium_amount: parseFloat(form.premium_amount) || 0,
        company_id: form.company_id || undefined,
      })
      router.push('/dashboard/policies')
    } catch (err: any) {
      setError(err.message || 'Errore durante il salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Check duplicato: stessa polizza + stessa compagnia
    if (form.policy_number) {
      try {
        const duplicates = await checkDuplicatePolicy(form.policy_number, form.company_id || undefined)
        if (duplicates.length > 0) {
          const dup = duplicates[0]
          const companyName = (dup as any).insurance_companies?.name || 'N/D'
          const confirmed = window.confirm(
            `Attenzione: esiste già una polizza con numero "${form.policy_number}" (${companyName}).\n\n` +
            `Cliente: ${dup.client_name}\nStato: ${dup.status}\n\n` +
            `Vuoi crearla comunque?`
          )
          if (!confirmed) return
        }
      } catch {
        // Se il check fallisce, procedi comunque
      }
    }

    await savePolicy()
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/policies" className="text-gray-400 hover:text-gray-600">
          &larr;
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">Nuova Polizza</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N. Polizza *</label>
            <input name="policy_number" required value={form.policy_number} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
            <select name="policy_type" value={form.policy_type} onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
              <option value="auto">Auto</option>
              <option value="home">Casa</option>
              <option value="life">Vita</option>
              <option value="health">Salute</option>
              <option value="other">Altro</option>
            </select>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Dati Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Cliente *</label>
              <input name="client_name" required value={form.client_name} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="client_email" type="email" value={form.client_email} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input name="client_phone" value={form.client_phone} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
              <input name="client_fiscal_code" value={form.client_fiscal_code} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Dettagli Polizza</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compagnia</label>
              <select name="company_id" value={form.company_id} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="">— Seleziona —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Premio Annuo (€) *</label>
              <input name="premium_amount" type="number" step="0.01" required value={form.premium_amount} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Decorrenza *</label>
              <input name="effective_date" type="date" required value={form.effective_date} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Scadenza *</label>
              <input name="expiry_date" type="date" required value={form.expiry_date} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
              <select name="status" value={form.status} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="active">Attiva</option>
                <option value="pending">In attesa</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <textarea name="notes" rows={3} value={form.notes} onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
            {loading ? 'Salvataggio...' : 'Salva Polizza'}
          </button>
          <Link href="/dashboard/policies"
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition">
            Annulla
          </Link>
        </div>
      </form>
    </div>
  )
}
