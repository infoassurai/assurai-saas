'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createPolicy, getPolicy, getInsuranceCompanies, checkDuplicatePolicy } from '@/lib/database'
import { calculateNextPaymentDate, PAYMENT_FREQUENCY_OPTIONS, type PaymentFrequency } from '@/lib/paymentUtils'

export default function NewPolicyPage() {
  return (
    <Suspense fallback={<div className="text-gray-400 text-sm">Caricamento...</div>}>
      <NewPolicyForm />
    </Suspense>
  )
}

function NewPolicyForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const renewId = searchParams.get('renew')
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [renewFrom, setRenewFrom] = useState('')

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
    campaign_code: '',
    payment_frequency: '' as string,
    payment_method: 'contanti',
    manual_commission_amount: '',
    policy_duration: '1y',
  })

  useEffect(() => {
    getInsuranceCompanies().then(setCompanies).catch(console.error)

    if (renewId) {
      getPolicy(renewId).then((policy) => {
        const oldExpiry = policy.expiry_date
        const newExpiry = oldExpiry ? (() => {
          const d = new Date(oldExpiry)
          d.setFullYear(d.getFullYear() + 1)
          return d.toISOString().split('T')[0]
        })() : ''

        setRenewFrom(policy.policy_number)
        setForm({
          policy_number: '',
          policy_type: policy.policy_type,
          client_name: policy.client_name,
          client_email: policy.client_email ?? '',
          client_phone: policy.client_phone ?? '',
          client_fiscal_code: policy.client_fiscal_code ?? '',
          premium_amount: String(policy.premium_amount),
          effective_date: oldExpiry || '',
          expiry_date: newExpiry,
          company_id: policy.company_id ?? '',
          status: 'active',
          notes: '',
          campaign_code: '',
          payment_frequency: policy.payment_frequency || '',
          payment_method: (policy as any).payment_method || 'contanti',
          manual_commission_amount: '',
          policy_duration: '1y',
        })
      }).catch(console.error)
    }
  }, [renewId])

  // Calcola automaticamente data scadenza da data decorrenza + durata
  useEffect(() => {
    if (!form.effective_date || form.policy_duration === 'personalizzata') return
    const base = new Date(form.effective_date)
    const durations: Record<string, () => Date> = {
      '1m':  () => { const d = new Date(base); d.setMonth(d.getMonth() + 1); return d },
      '3m':  () => { const d = new Date(base); d.setMonth(d.getMonth() + 3); return d },
      '6m':  () => { const d = new Date(base); d.setMonth(d.getMonth() + 6); return d },
      '1y':  () => { const d = new Date(base); d.setFullYear(d.getFullYear() + 1); return d },
      '2y':  () => { const d = new Date(base); d.setFullYear(d.getFullYear() + 2); return d },
    }
    const calc = durations[form.policy_duration]
    if (calc) {
      setForm((f) => ({ ...f, expiry_date: calc().toISOString().split('T')[0] }))
    }
  }, [form.effective_date, form.policy_duration])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const savePolicy = async () => {
    setLoading(true)
    try {
      const { policy_duration, manual_commission_amount, ...formRest } = form
      await createPolicy({
        ...formRest,
        premium_amount: parseFloat(form.premium_amount) || 0,
        company_id: form.company_id || undefined,
        campaign_code: form.campaign_code || undefined,
        payment_frequency: form.payment_frequency as PaymentFrequency,
        payment_method: form.payment_method || 'contanti',
        manual_commission_amount: manual_commission_amount ? parseFloat(manual_commission_amount) : undefined,
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

    // Frazionamento obbligatorio
    if (!form.payment_frequency) {
      alert('Seleziona il tipo di frazionamento prima di salvare la polizza.')
      return
    }

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
        {renewFrom && (
          <div className="bg-blue-50 text-blue-700 text-sm rounded-lg p-3">
            Rinnovo della polizza N. <strong>{renewFrom}</strong> — i dati sono stati pre-compilati.
          </div>
        )}
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
              <option value="previdenza">Previdenza</option>
              <option value="infortuni">Infortuni</option>
              <option value="rc">RC</option>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Durata</label>
              <select name="policy_duration" value={form.policy_duration} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="1m">1 mese</option>
                <option value="3m">3 mesi</option>
                <option value="6m">6 mesi</option>
                <option value="1y">1 anno</option>
                <option value="2y">2 anni</option>
                <option value="personalizzata">Personalizzata</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Scadenza *</label>
              <input name="expiry_date" type="date" required value={form.expiry_date} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frazionamento *</label>
              <select name="payment_frequency" value={form.payment_frequency} onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none ${!form.payment_frequency ? 'border-orange-300 bg-orange-50' : 'border-gray-300'}`}>
                <option value="">— Seleziona —</option>
                {PAYMENT_FREQUENCY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {form.effective_date && form.expiry_date && form.payment_frequency && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prossima Scadenza Rata</label>
                <input type="date" readOnly
                  value={calculateNextPaymentDate(form.effective_date, form.expiry_date, form.payment_frequency as PaymentFrequency)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-default" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
              <select name="status" value={form.status} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="active">Attiva</option>
                <option value="pending">In attesa</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modalità Pagamento</label>
              <select name="payment_method" value={form.payment_method} onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                <option value="contanti">Contanti</option>
                <option value="carta">Carta</option>
                <option value="rid">RID / Domiciliazione</option>
                <option value="finanziamento">Finanziamento</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commissione manuale (€)</label>
              <input name="manual_commission_amount" type="number" step="0.01" min="0"
                value={form.manual_commission_amount} onChange={handleChange}
                placeholder="Lascia vuoto per usare il piano provvigionale"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              <p className="text-xs text-gray-400 mt-1">Se inserita, sovrascrive il calcolo automatico da piano provvigionale</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Codice campagna (opzionale)</label>
            <input name="campaign_code" value={form.campaign_code} onChange={handleChange}
              placeholder="Es. CAMP-A1B2C3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
            <p className="text-xs text-gray-400 mt-1">Se questa polizza proviene da una campagna marketing, inserisci il codice</p>
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
