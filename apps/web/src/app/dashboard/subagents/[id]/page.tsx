'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  getSubAgentById,
  updateSubAgent,
  getSubAgentCommissionPlans,
  upsertSubAgentCommissionPlan,
  deleteSubAgentCommissionPlan,
  getSubAgentPolicies,
  getSubAgentCommissions,
  getInsuranceCompanies,
  getCommissionPlans,
} from '@/lib/database'

const policyTypeLabels: Record<string, string> = {
  auto: 'Auto', home: 'Casa', life: 'Vita', health: 'Salute', other: 'Altro',
}
const policyTypes = ['auto', 'home', 'life', 'health', 'other']

const statusLabels: Record<string, string> = {
  active: 'Attiva', expired: 'Scaduta', pending: 'In attesa', cancelled: 'Annullata',
}
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700', expired: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700', cancelled: 'bg-gray-100 text-gray-500',
}

const commStatusLabels: Record<string, string> = { pending: 'In attesa', paid: 'Pagata', cancelled: 'Annullata' }
const commStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-500',
}

export default function SubAgentDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [subAgent, setSubAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'plans' | 'policies' | 'commissions'>('plans')

  // Profile edit
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // Plans
  const [plans, setPlans] = useState<any[]>([])
  const [mainPlans, setMainPlans] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newPolicyType, setNewPolicyType] = useState('')
  const [newPercentage, setNewPercentage] = useState('')
  const [planSaving, setPlanSaving] = useState(false)
  const [planMsg, setPlanMsg] = useState('')

  // Policies
  const [policies, setPolicies] = useState<any[]>([])

  // Commissions
  const [commissions, setCommissions] = useState<any[]>([])

  const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

  const loadSubAgent = async () => {
    try {
      const sa = await getSubAgentById(id)
      setSubAgent(sa)
      setEditName(sa.full_name ?? '')
      setEditPhone(sa.phone ?? '')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadPlans = async () => {
    const [p, c, mp] = await Promise.all([
      getSubAgentCommissionPlans(id),
      getInsuranceCompanies(),
      getCommissionPlans(),
    ])
    setPlans(p)
    setCompanies(c)
    setMainPlans(mp)
  }

  const loadPolicies = async () => {
    const data = await getSubAgentPolicies(id)
    setPolicies(data)
  }

  const loadCommissions = async () => {
    const data = await getSubAgentCommissions(id)
    setCommissions(data)
  }

  useEffect(() => { loadSubAgent() }, [id])
  useEffect(() => {
    if (tab === 'plans') loadPlans().catch(console.error)
    if (tab === 'policies') loadPolicies().catch(console.error)
    if (tab === 'commissions') loadCommissions().catch(console.error)
  }, [tab, id])

  // Trova la rata agente principale per una combinazione
  const getMainRate = (companyId: string | null, policyType: string | null) => {
    if (companyId && policyType) {
      const plan = mainPlans.find(p => p.company_id === companyId && p.policy_type === policyType)
      if (plan) return Number(plan.percentage)
    }
    return 10 // default
  }

  const handleSaveProfile = async () => {
    setProfileSaving(true)
    setProfileMsg('')
    try {
      await updateSubAgent(id, { full_name: editName, phone: editPhone })
      setProfileMsg('Salvato')
      loadSubAgent()
    } catch (err: any) {
      setProfileMsg(`Errore: ${err.message}`)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleToggleActive = async () => {
    if (!subAgent) return
    const newState = !subAgent.is_active
    if (!newState && !confirm('Disattivare questo subagente?')) return
    try {
      await updateSubAgent(id, { is_active: newState })
      loadSubAgent()
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPercentage) return
    setPlanSaving(true)
    setPlanMsg('')
    try {
      await upsertSubAgentCommissionPlan(
        id,
        newCompanyId || null,
        newPolicyType || null,
        parseFloat(newPercentage)
      )
      setPlanMsg('Piano salvato')
      setNewCompanyId('')
      setNewPolicyType('')
      setNewPercentage('')
      await loadPlans()
    } catch (err: any) {
      setPlanMsg(`Errore: ${err.message}`)
    } finally {
      setPlanSaving(false)
      setTimeout(() => setPlanMsg(''), 3000)
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Eliminare questo piano?')) return
    try {
      await deleteSubAgentCommissionPlan(planId)
      await loadPlans()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="text-gray-400 p-8">Caricamento...</div>
  if (!subAgent) return <div className="text-red-500 p-8">Subagente non trovato</div>

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/subagents" className="text-gray-400 hover:text-gray-600">&larr;</Link>
        <h2 className="text-2xl font-bold text-gray-900">{subAgent.full_name}</h2>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          subAgent.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {subAgent.is_active ? 'Attivo' : 'Inattivo'}
        </span>
      </div>

      {/* Profilo */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Profilo</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome completo</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefono</label>
            <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSaveProfile} disabled={profileSaving}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
            {profileSaving ? 'Salvataggio...' : 'Salva'}
          </button>
          <button onClick={handleToggleActive}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              subAgent.is_active
                ? 'text-red-600 border-red-200 hover:bg-red-50'
                : 'text-green-600 border-green-200 hover:bg-green-50'
            }`}>
            {subAgent.is_active ? 'Disattiva' : 'Riattiva'}
          </button>
          {profileMsg && (
            <span className={`text-sm ${profileMsg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
              {profileMsg}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(['plans', 'policies', 'commissions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'plans' ? 'Piani Provvigionali' : t === 'policies' ? 'Polizze' : 'Commissioni'}
          </button>
        ))}
      </div>

      {/* Tab: Piani Provvigionali */}
      {tab === 'plans' && (
        <>
          <form onSubmit={handleAddPlan} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Aggiungi Piano Subagente</h3>
            <p className="text-xs text-gray-400 mb-4">
              Lascia vuota la compagnia per un piano globale. Lascia vuoto il tipo per un piano per compagnia.
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs text-gray-500 mb-1">Compagnia (opzionale)</label>
                <select value={newCompanyId} onChange={(e) => setNewCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Globale (tutte)</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="min-w-[130px]">
                <label className="block text-xs text-gray-500 mb-1">Tipo (opzionale)</label>
                <select value={newPolicyType} onChange={(e) => setNewPolicyType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                  <option value="">Tutti i tipi</option>
                  {policyTypes.map(t => <option key={t} value={t}>{policyTypeLabels[t]}</option>)}
                </select>
              </div>
              <div className="w-24">
                <label className="block text-xs text-gray-500 mb-1">% Subagente</label>
                <input type="number" min="0" max="100" step="0.5"
                  value={newPercentage} onChange={(e) => setNewPercentage(e.target.value)}
                  placeholder="8" required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              {newPercentage && (
                <div className="text-xs text-gray-500 pb-2">
                  Override: {(getMainRate(newCompanyId || null, newPolicyType || null) - parseFloat(newPercentage || '0')).toFixed(1)}%
                </div>
              )}
              <button type="submit" disabled={planSaving || !newPercentage}
                className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
                {planSaving ? 'Salvataggio...' : '+ Aggiungi'}
              </button>
            </div>
            {planMsg && (
              <p className={`mt-3 text-sm ${planMsg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
                {planMsg}
              </p>
            )}
          </form>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {plans.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Nessun piano definito. Verra applicato il fallback (50% della rata agente).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Compagnia</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">% Subagente</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">% Override</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-600">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {plans.map((p) => {
                      const mainRate = getMainRate(p.company_id, p.policy_type)
                      const overrideRate = mainRate - Number(p.percentage)
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900">
                            {(p.insurance_companies as any)?.name ?? <span className="text-gray-400 italic">Globale</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {p.policy_type ? policyTypeLabels[p.policy_type] : <span className="text-gray-400 italic">Tutti</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-900 font-medium">{p.percentage}%</td>
                          <td className="px-4 py-3 text-right text-teal-600 font-medium">{overrideRate.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleDeletePlan(p.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Elimina">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Tab: Polizze */}
      {tab === 'policies' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {policies.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nessuna polizza creata da questo subagente.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">N. Polizza</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Premio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {policies.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/policies/${p.id}`} className="text-primary-600 hover:underline font-medium">
                          {p.policy_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-900">{p.client_name}</td>
                      <td className="px-4 py-3 text-gray-600">{policyTypeLabels[p.policy_type] ?? p.policy_type}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmt(Number(p.premium_amount))}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status]}`}>
                          {statusLabels[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString('it-IT')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Commissioni */}
      {tab === 'commissions' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {commissions.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Nessuna commissione per questo subagente.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Polizza</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
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
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">{fmt(Number(c.amount))}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{c.percentage ? `${c.percentage}%` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${commStatusColors[c.status]}`}>
                          {commStatusLabels[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.created_at).toLocaleDateString('it-IT')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
