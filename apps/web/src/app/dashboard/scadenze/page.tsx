'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getExpiryAlerts, markAlertRead, dismissAlert, generateExpiryAlerts, markAllExpiryAlertsRead, getNotificationStatus } from '@/lib/database'

const TABS = [
  { key: 'all', label: 'Tutte', color: 'bg-gray-100 text-gray-700' },
  { key: 'scadute', label: 'Scadute', color: 'bg-red-100 text-red-700' },
  { key: '1gg', label: '< 1 giorno', color: 'bg-red-50 text-red-600' },
  { key: '7gg', label: '< 7 giorni', color: 'bg-orange-100 text-orange-700' },
  { key: '15gg', label: '< 15 giorni', color: 'bg-yellow-100 text-yellow-700' },
  { key: '30gg', label: '< 30 giorni', color: 'bg-blue-100 text-blue-700' },
]

function getDaysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

function categorize(daysLeft: number): string {
  if (daysLeft < 0) return 'scadute'
  if (daysLeft <= 1) return '1gg'
  if (daysLeft <= 7) return '7gg'
  if (daysLeft <= 15) return '15gg'
  return '30gg'
}

function getUrgencyBorder(days: number) {
  if (days < 0) return 'border-l-4 border-l-red-500'
  if (days <= 1) return 'border-l-4 border-l-red-400'
  if (days <= 7) return 'border-l-4 border-l-orange-500'
  if (days <= 15) return 'border-l-4 border-l-yellow-400'
  return 'border-l-4 border-l-blue-300'
}

export default function ScadenzePage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDismissed, setShowDismissed] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [sentEmail, setSentEmail] = useState<Set<string>>(new Set())
  const [sentWhatsapp, setSentWhatsapp] = useState<Set<string>>(new Set())

  const loadAlerts = async () => {
    setLoading(true)
    try {
      await generateExpiryAlerts()
      const data = await getExpiryAlerts(showDismissed)
      setAlerts(data)
      const policyIds = [...new Set(data.map((a: any) => a.policy_id).filter(Boolean))]
      if (policyIds.length > 0) {
        const status = await getNotificationStatus(policyIds)
        setSentEmail(status.email)
        setSentWhatsapp(status.whatsapp)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAlerts() }, [showDismissed])

  const handleMarkAllRead = async () => {
    await markAllExpiryAlertsRead()
    await loadAlerts()
  }

  const handleMarkRead = async (id: string) => {
    await markAlertRead(id)
    await loadAlerts()
  }

  const handleDismiss = async (id: string) => {
    await dismissAlert(id)
    await loadAlerts()
  }

  // Categorizza gli alert
  const alertsWithDays = alerts.map(a => ({
    ...a,
    _daysLeft: a.due_date ? getDaysLeft(a.due_date) : 999,
    _category: a.due_date ? categorize(getDaysLeft(a.due_date)) : '30gg',
  }))

  // Conteggi per tab
  const counts: Record<string, number> = { all: alertsWithDays.length }
  for (const a of alertsWithDays) {
    counts[a._category] = (counts[a._category] || 0) + 1
  }

  // Filtra per tab attivo
  const filtered = activeTab === 'all'
    ? alertsWithDays
    : alertsWithDays.filter(a => a._category === activeTab)

  const unreadCount = alerts.filter(a => !a.is_read).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Scadenze Polizze</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm text-primary-600 hover:text-primary-800 font-medium"
            >
              Segna tutti come letti
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
              className="rounded border-gray-300"
            />
            Mostra archiviati
          </label>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map(tab => {
          const count = counts[tab.key] ?? 0
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === tab.key
                  ? `${tab.color} ring-2 ring-offset-1 ring-gray-300`
                  : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold px-1.5 ${
                  activeTab === tab.key
                    ? 'bg-white/60 text-inherit'
                    : tab.key === 'scadute' ? 'bg-red-500 text-white'
                    : tab.key === '1gg' ? 'bg-red-400 text-white'
                    : tab.key === '7gg' ? 'bg-orange-500 text-white'
                    : tab.key === '15gg' ? 'bg-yellow-500 text-white'
                    : tab.key === '30gg' ? 'bg-blue-500 text-white'
                    : 'bg-gray-400 text-white'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          {activeTab === 'all'
            ? 'Nessuna polizza in scadenza. Le notifiche appariranno qui quando una polizza si avvicina alla scadenza.'
            : 'Nessuna polizza in questa categoria.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition ${
                !alert.is_read ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'
              } ${alert.is_dismissed ? 'opacity-50' : ''} ${getUrgencyBorder(alert._daysLeft)}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    alert._daysLeft < 0 ? 'bg-red-100 text-red-700' :
                    alert._daysLeft <= 1 ? 'bg-red-50 text-red-600' :
                    alert._daysLeft <= 7 ? 'bg-orange-100 text-orange-700' :
                    alert._daysLeft <= 15 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {alert._daysLeft < 0 ? 'Scaduta' :
                     alert._daysLeft <= 1 ? '< 1 giorno' :
                     `${alert._daysLeft} giorni`}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                    alert.type === 'payment'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {alert.type === 'payment' ? 'Scadenza Rata' : 'Scadenza Polizza'}
                  </span>
                  {!alert.is_read && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full" />
                  )}
                  {alert.policy_id && sentEmail.has(alert.policy_id) && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700" title="Email inviata">
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      Email
                    </span>
                  )}
                  {alert.policy_id && sentWhatsapp.has(alert.policy_id) && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700" title="WhatsApp inviato">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      WhatsApp
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-gray-900 text-sm">{alert.title}</h3>
                {alert.message && <p className="text-gray-500 text-sm mt-0.5">{alert.message}</p>}
                {alert.policies && (
                  <p className="text-xs text-gray-400 mt-1">
                    <Link href={`/dashboard/policies/${alert.policy_id}`} className="text-primary-600 hover:underline">
                      Polizza: {alert.policies.policy_number} — {alert.policies.client_name}
                    </Link>
                  </p>
                )}
                <p className={`text-xs mt-1 ${
                  alert._daysLeft < 0 ? 'text-red-500 font-medium' :
                  alert._daysLeft <= 7 ? 'text-yellow-600' : 'text-gray-400'
                }`}>
                  Scadenza: {new Date(alert.due_date).toLocaleDateString('it-IT')}
                  {alert._daysLeft < 0 && ' (scaduta)'}
                </p>
              </div>

              <div className="flex gap-2 shrink-0">
                {!alert.is_read && (
                  <button
                    onClick={() => handleMarkRead(alert.id)}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Segna letto
                  </button>
                )}
                {!alert.is_dismissed && (
                  <button
                    onClick={() => handleDismiss(alert.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Archivia
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
