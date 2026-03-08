'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getCampaigns, deleteCampaign } from '@/lib/database'

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Bozza' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Programmata' },
  sending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In invio...' },
  sent: { bg: 'bg-green-100', text: 'text-green-700', label: 'Inviata' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Errore' },
}

const channelLabel: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  both: 'Email + WhatsApp',
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const data = await getCampaigns()
      setCampaigns(data)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questa campagna?')) return
    try {
      await deleteCampaign(id)
      setCampaigns(prev => prev.filter(c => c.id !== id))
    } catch { }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing</h1>
          <p className="text-gray-500 text-sm mt-1">Campagne mirate email e WhatsApp</p>
        </div>
        <Link
          href="/dashboard/marketing/new"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-sm font-medium"
        >
          + Nuova Campagna
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-lg mb-2">Nessuna campagna</p>
          <p className="text-gray-400 text-sm">Crea la tua prima campagna marketing</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Canale</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Destinatari</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {campaigns.map((c) => {
                const badge = statusBadge[c.status] ?? statusBadge.draft
                const stats = c.stats ?? { sent: 0, failed: 0, total: 0 }
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/marketing/${c.id}`} className="font-medium text-primary-600 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{channelLabel[c.channel] ?? c.channel}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {stats.total > 0 ? `${stats.sent}/${stats.total}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {c.sent_at
                        ? new Date(c.sent_at).toLocaleDateString('it-IT')
                        : c.scheduled_at
                        ? `Prog. ${new Date(c.scheduled_at).toLocaleDateString('it-IT')}`
                        : new Date(c.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/marketing/${c.id}`}
                          className="text-xs text-primary-600 hover:underline"
                        >
                          Dettaglio
                        </Link>
                        {c.status === 'draft' && (
                          <>
                            <Link
                              href={`/dashboard/marketing/new?edit=${c.id}`}
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Modifica
                            </Link>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Elimina
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
