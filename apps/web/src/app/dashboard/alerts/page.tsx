'use client'

import { useEffect, useState } from 'react'
import { getAlerts, markAlertRead, dismissAlert } from '@/lib/database'

const typeLabels: Record<string, string> = {
  expiry: 'Scadenza',
  payment: 'Pagamento',
  document: 'Documento',
  custom: 'Personalizzato',
}

const typeColors: Record<string, string> = {
  expiry: 'bg-red-100 text-red-700',
  payment: 'bg-yellow-100 text-yellow-700',
  document: 'bg-blue-100 text-blue-700',
  custom: 'bg-gray-100 text-gray-600',
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDismissed, setShowDismissed] = useState(false)

  const loadAlerts = async () => {
    setLoading(true)
    try {
      const data = await getAlerts(showDismissed)
      setAlerts(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAlerts() }, [showDismissed])

  const handleMarkRead = async (id: string) => {
    await markAlertRead(id)
    await loadAlerts()
  }

  const handleDismiss = async (id: string) => {
    await dismissAlert(id)
    await loadAlerts()
  }

  const unreadCount = alerts.filter(a => !a.is_read).length

  const isOverdue = (date: string) => new Date(date) < new Date()
  const isSoon = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 7
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Alerts</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
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

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Caricamento...</div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Nessun alert. Le notifiche per le scadenze appariranno qui.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition ${
                !alert.is_read ? 'border-primary-200 bg-primary-50/30' : 'border-gray-200'
              } ${alert.is_dismissed ? 'opacity-50' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[alert.type]}`}>
                    {typeLabels[alert.type]}
                  </span>
                  {!alert.is_read && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full" />
                  )}
                </div>
                <h3 className="font-medium text-gray-900 text-sm">{alert.title}</h3>
                {alert.message && <p className="text-gray-500 text-sm mt-0.5">{alert.message}</p>}
                {alert.policies && (
                  <p className="text-xs text-gray-400 mt-1">
                    Polizza: {alert.policies.policy_number} — {alert.policies.client_name}
                  </p>
                )}
                <p className={`text-xs mt-1 ${
                  isOverdue(alert.due_date) ? 'text-red-500 font-medium' :
                  isSoon(alert.due_date) ? 'text-yellow-600' : 'text-gray-400'
                }`}>
                  Scadenza: {new Date(alert.due_date).toLocaleDateString('it-IT')}
                  {isOverdue(alert.due_date) && ' (scaduto)'}
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
