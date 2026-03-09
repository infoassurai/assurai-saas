'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { getPolicy, updatePolicy, deletePolicy, getInsuranceCompanies, getPolicyCommissionBreakdown } from '@/lib/database'
import { useProfile } from '@/contexts/ProfileContext'

export default function PolicyDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const { isAdmin } = useProfile()
  const [companies, setCompanies] = useState<any[]>([])
  const [commBreakdown, setCommBreakdown] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
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
    Promise.all([
      getPolicy(id),
      getInsuranceCompanies(),
      getPolicyCommissionBreakdown(id),
    ]).then(([policy, comps, breakdown]) => {
      setCompanies(comps)
      setCommBreakdown(breakdown)
      setForm({
        policy_number: policy.policy_number,
        policy_type: policy.policy_type,
        client_name: policy.client_name,
        client_email: policy.client_email ?? '',
        client_phone: policy.client_phone ?? '',
        client_fiscal_code: policy.client_fiscal_code ?? '',
        premium_amount: String(policy.premium_amount),
        effective_date: policy.effective_date,
        expiry_date: policy.expiry_date,
        company_id: policy.company_id ?? '',
        status: policy.status,
        notes: policy.notes ?? '',
      })
      setLoading(false)
    }).catch((err) => {
      setError(err.message)
      setLoading(false)
    })
  }, [id])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await updatePolicy(id, {
        ...form,
        premium_amount: parseFloat(form.premium_amount) || 0,
        company_id: form.company_id || null,
      })
      setEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Sei sicuro di voler eliminare questa polizza?')) return
    try {
      await deletePolicy(id)
      router.push('/dashboard/policies')
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) return <div className="text-gray-400 p-8">Caricamento...</div>

  const inputClass = editing
    ? 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none'
    : 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 cursor-default'

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/policies" className="text-gray-400 hover:text-gray-600">&larr;</Link>
        <h2 className="text-2xl font-bold text-gray-900">Polizza {form.policy_number}</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N. Polizza</label>
            <input name="policy_number" value={form.policy_number} onChange={handleChange} readOnly={!editing} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select name="policy_type" value={form.policy_type} onChange={handleChange} disabled={!editing} className={inputClass}>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Cliente</label>
              <input name="client_name" value={form.client_name} onChange={handleChange} readOnly={!editing} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="client_email" value={form.client_email} onChange={handleChange} readOnly={!editing} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
              <input name="client_phone" value={form.client_phone} onChange={handleChange} readOnly={!editing} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
              <input name="client_fiscal_code" value={form.client_fiscal_code} onChange={handleChange} readOnly={!editing} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Dettagli</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compagnia</label>
              <select name="company_id" value={form.company_id} onChange={handleChange} disabled={!editing} className={inputClass}>
                <option value="">—</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Premio Annuo (€)</label>
              <input name="premium_amount" type="number" step="0.01" value={form.premium_amount} onChange={handleChange} readOnly={!editing} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Decorrenza</label>
              <input name="effective_date" type="date" value={form.effective_date} onChange={handleChange} readOnly={!editing} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza</label>
              <input name="expiry_date" type="date" value={form.expiry_date} onChange={handleChange} readOnly={!editing} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
              <select name="status" value={form.status} onChange={handleChange} disabled={!editing} className={inputClass}>
                <option value="active">Attiva</option>
                <option value="pending">In attesa</option>
                <option value="expired">Scaduta</option>
                <option value="cancelled">Annullata</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
          <textarea name="notes" rows={3} value={form.notes} onChange={handleChange} readOnly={!editing}
            className={`${inputClass} resize-none`} />
        </div>

        {/* Breakdown Commissioni */}
        {isAdmin && commBreakdown.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Commissioni</h3>
            <div className="space-y-2">
              {commBreakdown.map((c) => {
                const roleLabel = c.commission_role === 'subagent' ? 'Subagente' : c.commission_role === 'override' ? 'Override' : 'Diretta'
                const roleColor = c.commission_role === 'subagent' ? 'bg-indigo-100 text-indigo-700'
                  : c.commission_role === 'override' ? 'bg-teal-100 text-teal-700'
                  : 'bg-blue-100 text-blue-700'
                return (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColor}`}>{roleLabel}</span>
                      <span className="text-sm text-gray-700">{c.profiles?.full_name ?? '—'}</span>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      {Number(c.amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                      <span className="text-gray-400 ml-1">({c.percentage}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

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
              {(form.status === 'active' || form.status === 'expired') && (
                <Link href={`/dashboard/policies/new?renew=${id}`}
                  className="px-6 py-2.5 rounded-lg text-sm font-medium text-green-700 border border-green-300 hover:bg-green-50 transition inline-flex items-center gap-1">
                  Rinnova polizza
                </Link>
              )}
              <button onClick={handleDelete}
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition">
                Elimina
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
