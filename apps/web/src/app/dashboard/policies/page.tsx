'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/contexts/ProfileContext'
import { getPolicies, deletePolicy, getDocumentSignedUrl } from '@/lib/database'

const statusLabels: Record<string, string> = {
  active: 'Attiva',
  expired: 'Scaduta',
  pending: 'In attesa',
  cancelled: 'Annullata',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const typeLabels: Record<string, string> = {
  auto: 'Auto',
  home: 'Casa',
  life: 'Vita',
  health: 'Salute',
  other: 'Altro',
}

const clientTypeLabels: Record<string, string> = {
  persona: 'Persona',
  azienda: 'Azienda',
}

const clientTypeColors: Record<string, string> = {
  persona: 'bg-blue-100 text-blue-700',
  azienda: 'bg-purple-100 text-purple-700',
}

const frequencyLabels: Record<string, string> = {
  annuale: 'Annuale',
  semestrale: 'Semestrale',
  mensile: 'Mensile',
  rateizzata: 'Rateizzata',
}

function getPaymentExpiryColor(dateStr: string | null): string {
  if (!dateStr) return 'text-gray-400'
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'text-red-600 font-semibold'
  if (days <= 7) return 'text-orange-600 font-medium'
  if (days <= 30) return 'text-yellow-600'
  return 'text-gray-600'
}

export default function PoliciesPage() {
  const router = useRouter()
  const { isAdmin } = useProfile()
  const [policies, setPolicies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [clientTypeFilter, setClientTypeFilter] = useState('')

  const handleDelete = async (id: string, policyNumber: string) => {
    if (!confirm(`Sei sicuro di voler eliminare la polizza "${policyNumber}"?`)) return
    try {
      await deletePolicy(id)
      await loadPolicies()
    } catch (err: any) {
      alert(err.message || 'Errore durante l\'eliminazione')
    }
  }

  const loadPolicies = async () => {
    setLoading(true)
    try {
      const data = await getPolicies({
        status: statusFilter || undefined,
        policyType: typeFilter || undefined,
        clientType: clientTypeFilter || undefined,
        search: search || undefined,
      })
      setPolicies(data)
    } catch (err) {
      console.error('Errore caricamento polizze:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPolicies()
  }, [statusFilter, typeFilter, clientTypeFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    loadPolicies()
  }

  const exportCSV = () => {
    if (policies.length === 0) return
    const headers = ['N. Polizza', 'Cliente', 'Tipo Cliente', 'Tipo', 'Compagnia', 'Premio', 'Decorrenza', 'Scadenza', 'Frazionamento', 'Scad. Rata', 'Stato']
    const rows = policies.map(p => [
      p.policy_number,
      p.client_name,
      clientTypeLabels[p.client_type || (p.client_fiscal_code && /^\d{11}$/.test(p.client_fiscal_code) ? 'azienda' : 'persona')],
      typeLabels[p.policy_type] ?? p.policy_type,
      p.insurance_companies?.name ?? '',
      Number(p.premium_amount).toFixed(2),
      new Date(p.effective_date).toLocaleDateString('it-IT'),
      new Date(p.expiry_date).toLocaleDateString('it-IT'),
      frequencyLabels[p.payment_frequency] ?? 'Annuale',
      p.payment_expiry_date ? new Date(p.payment_expiry_date).toLocaleDateString('it-IT') : '',
      statusLabels[p.status] ?? p.status,
    ])
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `polizze_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Polizze</h2>
        <div className="flex gap-2">
          <button
            onClick={exportCSV}
            disabled={policies.length === 0}
            className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            Esporta CSV
          </button>
          <Link
            href="/dashboard/policies/new"
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
          + Nuova Polizza
        </Link>
        </div>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-end">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 mb-1">Cerca</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome cliente o n. polizza..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </form>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Stato</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Tutti</option>
            <option value="active">Attiva</option>
            <option value="pending">In attesa</option>
            <option value="expired">Scaduta</option>
            <option value="cancelled">Annullata</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Tutti</option>
            <option value="auto">Auto</option>
            <option value="home">Casa</option>
            <option value="life">Vita</option>
            <option value="health">Salute</option>
            <option value="other">Altro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo Cliente</label>
          <select
            value={clientTypeFilter}
            onChange={(e) => setClientTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="">Tutti</option>
            <option value="persona">Persona</option>
            <option value="azienda">Azienda</option>
          </select>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : policies.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="mb-2">Nessuna polizza trovata</p>
            <Link href="/dashboard/policies/new" className="text-primary-600 hover:underline text-sm font-medium">
              Crea la tua prima polizza
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">N. Polizza</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Compagnia</th>
                  {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600">Agente</th>}
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Premio</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Scadenza</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Scad. Rata</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {policies.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/policies/${p.id}`} className="text-primary-600 hover:underline font-medium">
                        {p.policy_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-900">{p.client_name}</td>
                    <td className="px-4 py-3">
                      {(() => {
                        // Derive client type: from DB column, or from fiscal code format
                        const ct = p.client_type
                          || (p.client_fiscal_code && /^\d{11}$/.test(p.client_fiscal_code) ? 'azienda' : 'persona')
                        return (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${clientTypeColors[ct]}`}>
                            {clientTypeLabels[ct]}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{typeLabels[p.policy_type] ?? p.policy_type}</td>
                    <td className="px-4 py-3 text-gray-600">{p.insurance_companies?.name ?? '—'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-gray-600">
                        {p.profiles?.full_name ?? '—'}
                        {p.profiles?.role === 'subagent' && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">SUB</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {Number(p.premium_amount).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(p.expiry_date).toLocaleDateString('it-IT')}
                    </td>
                    <td className={`px-4 py-3 ${getPaymentExpiryColor(p.payment_expiry_date)}`}>
                      {p.payment_expiry_date
                        ? new Date(p.payment_expiry_date).toLocaleDateString('it-IT')
                        : '—'}
                      {p.payment_frequency && p.payment_frequency !== 'annuale' && (
                        <span className="block text-[10px] text-gray-400">{frequencyLabels[p.payment_frequency]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status]}`}>
                        {statusLabels[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {p.documents && p.documents.length > 0 && (
                          <button
                            onClick={async () => {
                              try {
                                const url = await getDocumentSignedUrl(p.documents[0].file_path)
                                window.open(url, '_blank')
                              } catch {
                                alert('Impossibile aprire il PDF')
                              }
                            }}
                            title={`Apri PDF: ${p.documents[0].file_name}`}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" x2="8" y1="13" y2="13" />
                              <line x1="16" x2="8" y1="17" y2="17" />
                              <line x1="10" x2="8" y1="9" y2="9" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/dashboard/policies/${p.id}`)}
                          title="Modifica"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.policy_number)}
                          title="Elimina"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </td>
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
