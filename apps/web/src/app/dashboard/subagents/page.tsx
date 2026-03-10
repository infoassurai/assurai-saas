'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSubAgents, getSubAgentStats } from '@/lib/database'

export default function SubAgentsPage() {
  const [subAgents, setSubAgents] = useState<any[]>([])
  const [stats, setStats] = useState({ activeSubAgents: 0, overrideMonth: 0 })
  const [loading, setLoading] = useState(true)

  // Modal creazione
  const [showModal, setShowModal] = useState(false)
  const [formEmail, setFormEmail] = useState('')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')

  const loadData = async () => {
    try {
      const sa = await getSubAgents()
      console.log('SubAgents risultato:', sa)
      setSubAgents(sa)
    } catch (err) {
      console.error('Errore caricamento subagenti:', err)
    }
    try {
      const st = await getSubAgentStats()
      setStats(st)
    } catch (err) {
      console.error('Errore caricamento stats:', err)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formEmail || !formName || !formPassword) return
    setCreating(true)
    setCreateMsg('')
    try {
      const res = await fetch('/api/subagents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formEmail,
          full_name: formName,
          phone: formPhone || undefined,
          password: formPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Errore creazione')
      setCreateMsg(`Subagente "${formName}" creato con successo!`)
      setFormEmail('')
      setFormName('')
      setFormPhone('')
      setFormPassword('')
      await loadData()
      setTimeout(() => { setShowModal(false); setCreateMsg('') }, 2000)
    } catch (err: any) {
      setCreateMsg(`Errore: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  if (loading) return <div className="text-gray-400 p-8">Caricamento...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Subagenti</h2>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          + Nuovo Subagente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Subagenti Attivi</p>
          <p className="text-xl font-bold text-gray-900">{stats.activeSubAgents}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Totale Subagenti</p>
          <p className="text-xl font-bold text-gray-900">{subAgents.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Override Mese</p>
          <p className="text-xl font-bold text-teal-600">{fmt(stats.overrideMonth)}</p>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {subAgents.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nessun subagente. Crea il primo con il pulsante sopra.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Telefono</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Stato</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Creato</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subAgents.map((sa) => (
                  <tr key={sa.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900 font-medium">{sa.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{sa.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{sa.phone ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        sa.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {sa.is_active ? 'Attivo' : 'Inattivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(sa.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link
                        href={`/dashboard/subagents/${sa.id}`}
                        className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                      >
                        Dettaglio
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal creazione */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Nuovo Subagente</h3>
              <button onClick={() => { setShowModal(false); setCreateMsg('') }} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password temporanea *</label>
                <input
                  type="text"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 caratteri"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Comunica queste credenziali al subagente</p>
              </div>

              {createMsg && (
                <p className={`text-sm ${createMsg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
                  {createMsg}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating || !formEmail || !formName || !formPassword}
                  className="flex-1 bg-primary-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {creating ? 'Creazione...' : 'Crea Subagente'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setCreateMsg('') }}
                  className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition"
                >
                  Annulla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
