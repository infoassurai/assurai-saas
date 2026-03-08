'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCampaign, getCampaignSends } from '@/lib/database'

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Bozza' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Programmata' },
  sending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'In invio...' },
  sent: { bg: 'bg-green-100', text: 'text-green-700', label: 'Inviata' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Errore' },
}

const sendStatusBadge: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'In attesa' },
  sent: { bg: 'bg-green-100', text: 'text-green-700', label: 'Inviato' },
  failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Errore' },
}

const channelLabel: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  both: 'Email + WhatsApp',
}

export default function CampaignDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [campaign, setCampaign] = useState<any>(null)
  const [sends, setSends] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    Promise.all([
      getCampaign(id),
      getCampaignSends(id),
    ]).then(([c, s]) => {
      setCampaign(c)
      setSends(s)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [id])

  const handleResend = async () => {
    if (!confirm('Riprendere l\'invio della campagna?')) return
    setResending(true)
    try {
      const res = await fetch('/api/campaigns/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: id }),
      })
      const result = await res.json()
      alert(result.success
        ? `Invio completato! ${result.sent} invii, ${result.failed} errori.`
        : `Errore: ${result.error}`)
      // Reload data
      const [c, s] = await Promise.all([getCampaign(id), getCampaignSends(id)])
      setCampaign(c)
      setSends(s)
    } catch { }
    setResending(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">Caricamento...</div>
  if (!campaign) return <div className="text-center py-12 text-gray-400">Campagna non trovata</div>

  const badge = statusBadge[campaign.status] ?? statusBadge.draft
  const stats = campaign.stats ?? { sent: 0, failed: 0, total: 0 }
  const filters = campaign.filters ?? {}
  const filterKeys = Object.keys(filters).filter(k => {
    const v = filters[k]
    if (Array.isArray(v)) return v.length > 0
    return v !== '' && v !== null && v !== undefined
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700 mb-1">
            &larr; Torna alle campagne
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm px-3 py-1 rounded-full font-medium ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
          {campaign.status === 'sending' && (
            <button
              onClick={handleResend}
              disabled={resending}
              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {resending ? 'Invio...' : 'Riprendi invio'}
            </button>
          )}
          {campaign.status === 'draft' && (
            <Link
              href={`/dashboard/marketing/new?edit=${campaign.id}`}
              className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Modifica
            </Link>
          )}
        </div>
      </div>

      {/* Info + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Canale</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{channelLabel[campaign.channel]}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Totale</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Inviati</p>
          <p className="text-lg font-bold text-green-600 mt-1">{stats.sent}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Errori</p>
          <p className="text-lg font-bold text-red-600 mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* Filtri applicati */}
      {filterKeys.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Filtri applicati</h3>
          <div className="flex flex-wrap gap-2">
            {filterKeys.map(k => (
              <span key={k} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                {k}: {Array.isArray(filters[k]) ? filters[k].join(', ') : String(filters[k])}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Anteprima messaggio */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Messaggio</h3>
        {campaign.subject && (
          <p className="text-sm text-gray-500 mb-2">
            <strong>Oggetto:</strong> {campaign.subject}
          </p>
        )}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
          {campaign.body}
        </div>
      </div>

      {/* Date */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex gap-6 text-sm text-gray-600">
        <span>Creata: {new Date(campaign.created_at).toLocaleString('it-IT')}</span>
        {campaign.scheduled_at && <span>Programmata: {new Date(campaign.scheduled_at).toLocaleString('it-IT')}</span>}
        {campaign.sent_at && <span>Inviata: {new Date(campaign.sent_at).toLocaleString('it-IT')}</span>}
      </div>

      {/* Tabella sends */}
      {sends.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Dettaglio invii ({sends.length})</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2">Canale</th>
                <th className="px-4 py-2">Stato</th>
                <th className="px-4 py-2">Errore</th>
                <th className="px-4 py-2">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sends.map(s => {
                const sb = sendStatusBadge[s.status] ?? sendStatusBadge.pending
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {(s.clients as any)?.name ?? '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {s.channel === 'email' ? 'Email' : 'WhatsApp'}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sb.bg} ${sb.text}`}>
                        {sb.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-red-500">{s.error_message ?? ''}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">
                      {s.sent_at ? new Date(s.sent_at).toLocaleString('it-IT') : '-'}
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
