'use client'

import { useEffect, useState } from 'react'
import { useProfile } from '@/contexts/ProfileContext'
import {
  getCommissions,
  getCommissionPlans,
  upsertCommissionPlan,
  deleteCommissionPlan,
  applyRetroactiveCommissions,
  getMissingCommissionPlans,
  getInsuranceCompanies,
} from '@/lib/database'

const statusLabels: Record<string, string> = {
  pending: 'In attesa',
  paid: 'Pagata',
  cancelled: 'Annullata',
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const commTypeLabels: Record<string, string> = {
  initial: 'Iniziale',
  renewal: 'Rinnovo',
  bonus: 'Bonus',
}

const commRoleLabels: Record<string, string> = {
  agent: 'Diretta',
  subagent: 'Subagente',
  override: 'Override',
}

const commRoleColors: Record<string, string> = {
  agent: 'bg-blue-100 text-blue-700',
  subagent: 'bg-indigo-100 text-indigo-700',
  override: 'bg-teal-100 text-teal-700',
}

const policyTypeLabels: Record<string, string> = {
  auto: 'Auto',
  home: 'Casa',
  life: 'Vita',
  health: 'Salute',
  other: 'Altro',
}

const policyTypes = ['auto', 'home', 'life', 'health', 'other']

export default function CommissionsPage() {
  const { isAdmin } = useProfile()
  const [tab, setTab] = useState<'commissions' | 'plans'>('commissions')

  // Commissioni
  const [commissions, setCommissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  // Piani
  const [plans, setPlans] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [missingPlans, setMissingPlans] = useState<any[]>([])
  const [plansLoading, setPlansLoading] = useState(false)

  // Form nuovo piano
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newPolicyType, setNewPolicyType] = useState('')
  const [newPercentage, setNewPercentage] = useState('')
  const [retroactive, setRetroactive] = useState(false)
  const [saving, setSaving] = useState(false)
  const [planMsg, setPlanMsg] = useState('')

  // Edit inline
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPercentage, setEditPercentage] = useState('')

  const loadCommissions = async () => {
    setLoading(true)
    try {
      const data = await getCommissions({ status: statusFilter || undefined })
      setCommissions(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPlans = async () => {
    setPlansLoading(true)
    try {
      const [p, c, m] = await Promise.all([
        getCommissionPlans(),
        getInsuranceCompanies(),
        getMissingCommissionPlans(),
      ])
      setPlans(p)
      setCompanies(c)
      setMissingPlans(m)
    } catch (err) {
      console.error(err)
    } finally {
      setPlansLoading(false)
    }
  }

  useEffect(() => { loadCommissions() }, [statusFilter])
  useEffect(() => { if (tab === 'plans') loadPlans() }, [tab])

  const totalAmount = commissions.reduce((sum, c) => sum + Number(c.amount), 0)
  const pendingAmount = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + Number(c.amount), 0)
  const paidAmount = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + Number(c.amount), 0)

  const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompanyId || !newPolicyType || !newPercentage) return
    setSaving(true)
    setPlanMsg('')
    try {
      await upsertCommissionPlan(newCompanyId, newPolicyType, parseFloat(newPercentage))
      if (retroactive) {
        const count = await applyRetroactiveCommissions(newCompanyId, newPolicyType, parseFloat(newPercentage))
        setPlanMsg(`Piano salvato. ${count} commissioni aggiornate retroattivamente.`)
      } else {
        setPlanMsg('Piano salvato.')
      }
      setNewCompanyId('')
      setNewPolicyType('')
      setNewPercentage('')
      setRetroactive(false)
      await loadPlans()
    } catch (err: any) {
      setPlanMsg(`Errore: ${err.message}`)
    } finally {
      setSaving(false)
      setTimeout(() => setPlanMsg(''), 4000)
    }
  }

  const handleDeletePlan = async (id: string, companyName: string, policyType: string) => {
    if (!confirm(`Eliminare il piano per "${companyName} - ${policyTypeLabels[policyType]}"?`)) return
    try {
      await deleteCommissionPlan(id)
      await loadPlans()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEditSave = async (plan: any) => {
    if (!editPercentage) return
    setSaving(true)
    try {
      await upsertCommissionPlan(plan.company_id, plan.policy_type, parseFloat(editPercentage))
      if (retroactive) {
        await applyRetroactiveCommissions(plan.company_id, plan.policy_type, parseFloat(editPercentage))
      }
      setEditingId(null)
      await loadPlans()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Commissioni</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('commissions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === 'commissions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Commissioni
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab('plans')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === 'plans' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Piani Provvigionali
          </button>
        )}
      </div>

      {tab === 'commissions' ? (
        <>
          {/* Riepilogo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Totale</p>
              <p className="text-xl font-bold text-gray-900">{fmt(totalAmount)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Da incassare</p>
              <p className="text-xl font-bold text-yellow-600">{fmt(pendingAmount)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">Incassate</p>
              <p className="text-xl font-bold text-green-600">{fmt(paidAmount)}</p>
            </div>
          </div>

          {/* Filtro */}
          <div className="mb-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            >
              <option value="">Tutti gli stati</option>
              <option value="pending">In attesa</option>
              <option value="paid">Pagata</option>
              <option value="cancelled">Annullata</option>
            </select>
          </div>

          {/* Tabella commissioni */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Caricamento...</div>
            ) : commissions.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Nessuna commissione trovata. Le commissioni verranno create automaticamente con le polizze.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Polizza</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      {isAdmin && <th className="text-left px-4 py-3 font-medium text-gray-600">Ruolo</th>}
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Importo</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">%</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {commissions.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-primary-600 font-medium">{c.policies?.policy_number ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-900">{c.policies?.client_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{commTypeLabels[c.type] ?? c.type}</td>
                        {isAdmin && (
                          <td className="px-4 py-3">
                            {c.commission_role && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${commRoleColors[c.commission_role] ?? 'bg-gray-100 text-gray-500'}`}>
                                {commRoleLabels[c.commission_role] ?? c.commission_role}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmt(Number(c.amount))}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{c.percentage ? `${c.percentage}%` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[c.status]}`}>
                            {statusLabels[c.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(c.created_at).toLocaleDateString('it-IT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Banner combinazioni mancanti */}
          {missingPlans.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <h4 className="text-sm font-semibold text-amber-800 mb-2">
                Piani provvigionali mancanti ({missingPlans.length})
              </h4>
              <p className="text-xs text-amber-600 mb-3">
                Le seguenti combinazioni hanno polizze attive ma nessun piano provvigionale definito. Viene applicata la commissione default.
              </p>
              <div className="flex flex-wrap gap-2">
                {missingPlans.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                    {m.company_name} — {policyTypeLabels[m.policy_type] ?? m.policy_type}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Form nuovo piano */}
          <form onSubmit={handleAddPlan} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Aggiungi Piano Provvigionale</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs text-gray-500 mb-1">Compagnia</label>
                <select
                  value={newCompanyId}
                  onChange={(e) => setNewCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Seleziona...</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[140px]">
                <label className="block text-xs text-gray-500 mb-1">Tipo Polizza</label>
                <select
                  value={newPolicyType}
                  onChange={(e) => setNewPolicyType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="">Seleziona...</option>
                  {policyTypes.map(t => (
                    <option key={t} value={t}>{policyTypeLabels[t]}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-500 mb-1">%</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2 pb-0.5">
                <input
                  type="checkbox"
                  id="retroactive"
                  checked={retroactive}
                  onChange={(e) => setRetroactive(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="retroactive" className="text-xs text-gray-600">Retroattivo</label>
              </div>
              <button
                type="submit"
                disabled={saving || !newCompanyId || !newPolicyType || !newPercentage}
                className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 whitespace-nowrap"
              >
                {saving ? 'Salvataggio...' : '+ Aggiungi'}
              </button>
            </div>
            {planMsg && (
              <p className={`mt-3 text-sm ${planMsg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
                {planMsg}
              </p>
            )}
          </form>

          {/* Tabella piani */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {plansLoading ? (
              <div className="p-8 text-center text-gray-400">Caricamento...</div>
            ) : plans.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Nessun piano provvigionale definito. Aggiungi il primo piano sopra.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Compagnia</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo Polizza</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">% Commissione</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Aggiornato</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plans.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {(p.insurance_companies as any)?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {policyTypeLabels[p.policy_type] ?? p.policy_type}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingId === p.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                value={editPercentage}
                                onChange={(e) => setEditPercentage(e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-primary-500 outline-none"
                                autoFocus
                              />
                              <span className="text-gray-400">%</span>
                              <button
                                onClick={() => handleEditSave(p)}
                                disabled={saving}
                                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                              >
                                Salva
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600"
                              >
                                Annulla
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingId(p.id); setEditPercentage(String(p.percentage)) }}
                              className="text-gray-900 font-medium hover:text-primary-600 transition"
                              title="Clicca per modificare"
                            >
                              {p.percentage}%
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(p.updated_at).toLocaleDateString('it-IT')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeletePlan(p.id, (p.insurance_companies as any)?.name ?? '', p.policy_type)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Elimina"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
