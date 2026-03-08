'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { getClient, updateClient, deleteClient } from '@/lib/database'

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
      await updateClient(id, form)
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
        <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
      </div>

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
      <div className="bg-white rounded-xl border border-gray-200 p-6">
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
    </div>
  )
}
