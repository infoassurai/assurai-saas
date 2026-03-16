'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getExpiryAlerts, markAlertRead, dismissAlert, generateExpiryAlerts, markAllExpiryAlertsRead, getNotificationStatus, getPoliciesByExpiryMonth } from '@/lib/database'

// Categorie urgenza (solo alert)
const URGENCY_TABS = [
  { key: 'all',         label: 'Tutte',              dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-700',    activeBg: 'bg-gray-100 text-gray-700' },
  { key: 'scad_oltre',  label: 'Scadute > 15 gg',    dot: 'bg-red-800',     badge: 'bg-red-900 text-white',        activeBg: 'bg-red-900 text-white' },
  { key: 'scad_10',     label: 'Scadute 10–15 gg',   dot: 'bg-red-600',     badge: 'bg-red-700 text-white',        activeBg: 'bg-red-700 text-white' },
  { key: 'scad_recenti',label: 'Scadute < 10 gg',    dot: 'bg-red-500',     badge: 'bg-red-100 text-red-700',      activeBg: 'bg-red-100 text-red-700' },
  { key: '1gg',         label: '< 1 giorno',          dot: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700',activeBg: 'bg-orange-100 text-orange-700' },
  { key: '7gg',         label: '< 7 giorni',          dot: 'bg-yellow-500',  badge: 'bg-yellow-100 text-yellow-700',activeBg: 'bg-yellow-100 text-yellow-700' },
  { key: '15gg',        label: '< 15 giorni',         dot: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700',    activeBg: 'bg-blue-100 text-blue-700' },
  { key: '30gg',        label: '< 30 giorni',         dot: 'bg-blue-300',    badge: 'bg-blue-50 text-blue-600',     activeBg: 'bg-blue-50 text-blue-600' },
]

const typeLabels: Record<string, string> = {
  auto: 'Auto', home: 'Casa', life: 'Vita', health: 'Salute', other: 'Altro',
}
const MONTH_NAMES = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']

function getDaysLeft(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
}

function categorize(daysLeft: number): string {
  if (daysLeft < -15) return 'scad_oltre'
  if (daysLeft < -10) return 'scad_10'
  if (daysLeft < 0)   return 'scad_recenti'
  if (daysLeft <= 1)  return '1gg'
  if (daysLeft <= 7)  return '7gg'
  if (daysLeft <= 15) return '15gg'
  return '30gg'
}

function getUrgencyBorder(days: number) {
  if (days < -15) return 'border-l-4 border-l-red-900'
  if (days < -10) return 'border-l-4 border-l-red-700'
  if (days < 0)   return 'border-l-4 border-l-red-500'
  if (days <= 1)  return 'border-l-4 border-l-orange-500'
  if (days <= 7)  return 'border-l-4 border-l-yellow-400'
  if (days <= 15) return 'border-l-4 border-l-blue-400'
  return 'border-l-4 border-l-blue-200'
}

function getDaysChip(days: number) {
  if (days < -15) return { label: `Scaduta da ${Math.abs(days)} gg`, cls: 'bg-red-900 text-white' }
  if (days < -10) return { label: `Scaduta da ${Math.abs(days)} gg`, cls: 'bg-red-700 text-white' }
  if (days < 0)   return { label: `Scaduta da ${Math.abs(days)} gg`, cls: 'bg-red-100 text-red-700' }
  if (days <= 1)  return { label: '< 1 giorno',                       cls: 'bg-orange-100 text-orange-700' }
  return           { label: `${days} giorni`,                          cls: days <= 7 ? 'bg-yellow-100 text-yellow-700' : days <= 15 ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600' }
}

export default function ScadenzePage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showDismissed, setShowDismissed] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [sentEmail, setSentEmail] = useState<Set<string>>(new Set())
  const [sentWhatsapp, setSentWhatsapp] = useState<Set<string>>(new Set())
  const [vistaMode, setVistaMode] = useState<'alert' | 'mese'>('alert')

  // Vista mensile
  const now = new Date()
  const [meseAnno, setMeseAnno] = useState(now.getFullYear())
  const [meseMese, setMeseMese] = useState(now.getMonth() + 1)
  const [mesePolicies, setMesePolicies] = useState<any[]>([])
  const [meseLoading, setMeseLoading] = useState(false)

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

  const loadMese = async () => {
    setMeseLoading(true)
    try {
      const data = await getPoliciesByExpiryMonth(meseAnno, meseMese)
      setMesePolicies(data)
    } catch (err) {
      console.error(err)
    } finally {
      setMeseLoading(false)
    }
  }

  useEffect(() => { loadAlerts() }, [showDismissed])
  useEffect(() => { if (vistaMode === 'mese') loadMese() }, [vistaMode, meseAnno, meseMese])

  const handleMarkAllRead = async () => { await markAllExpiryAlertsRead(); await loadAlerts() }
  const handleMarkRead   = async (id: string) => { await markAlertRead(id); await loadAlerts() }
  const handleDismiss    = async (id: string) => { await dismissAlert(id); await loadAlerts() }

  const alertsWithDays = alerts.map(a => ({
    ...a,
    _daysLeft: a.due_date ? getDaysLeft(a.due_date) : 999,
    _category: a.due_date ? categorize(getDaysLeft(a.due_date)) : '30gg',
  }))

  const counts: Record<string, number> = { all: alertsWithDays.length }
  for (const a of alertsWithDays) counts[a._category] = (counts[a._category] || 0) + 1

  const filtered = activeTab === 'all'
    ? alertsWithDays
    : alertsWithDays.filter(a => a._category === activeTab)

  const unreadCount = alerts.filter(a => !a.is_read).length

  // ─── VISTA MENSILE ─────────────────────────────────────────────────────────
  if (vistaMode === 'mese') {
    return (
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Scadenze Polizze</h2>
          <button
            onClick={() => setVistaMode('alert')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            ← Vista alert
          </button>
        </div>

        {/* Month picker */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { if (meseMese === 1) { setMeseMese(12); setMeseAnno(meseAnno - 1) } else setMeseMese(meseMese - 1) }}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-lg font-medium transition"
            >‹</button>
            <div className="flex-1 text-center">
              <p className="text-lg font-bold text-gray-900">{MONTH_NAMES[meseMese - 1]} {meseAnno}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {meseLoading ? 'Caricamento...' : `${mesePolicies.length} polizze in scadenza`}
              </p>
            </div>
            <button
              onClick={() => { if (meseMese === 12) { setMeseMese(1); setMeseAnno(meseAnno + 1) } else setMeseMese(meseMese + 1) }}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 text-lg font-medium transition"
            >›</button>
          </div>
        </div>

        {meseLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Caricamento...</div>
        ) : mesePolicies.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
            <p className="text-gray-400 text-sm">Nessuna polizza in scadenza in {MONTH_NAMES[meseMese - 1]} {meseAnno}.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Compagnia</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Scadenza</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Premio</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mesePolicies.map((p: any) => {
                  const daysLeft = getDaysLeft(p.expiry_date)
                  const chip = getDaysChip(daysLeft)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.client_name}</td>
                      <td className="px-4 py-3 text-gray-600">{typeLabels[p.policy_type] ?? p.policy_type}</td>
                      <td className="px-4 py-3 text-gray-500">{(p as any).insurance_companies?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700">{new Date(p.expiry_date).toLocaleDateString('it-IT')}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${chip.cls}`}>{chip.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        {(p.premium_amount || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/policies/${p.id}`} className="text-xs text-primary-600 hover:underline font-medium whitespace-nowrap">
                          Rinnova →
                        </Link>
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

  // ─── VISTA ALERT ───────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Scadenze Polizze</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="text-sm text-primary-600 hover:text-primary-800 font-medium">
              Segna tutti come letti
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showDismissed} onChange={e => setShowDismissed(e.target.checked)} className="rounded border-gray-300" />
            Archiviati
          </label>
          <button
            onClick={() => setVistaMode('mese')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            📅 Vista mensile
          </button>
        </div>
      </div>

      {/* Tabs urgenza */}
      <div className="flex flex-wrap gap-2 mb-5">
        {URGENCY_TABS.map(tab => {
          const count = counts[tab.key] ?? 0
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                isActive
                  ? `${tab.activeBg} border-transparent ring-2 ring-offset-1 ring-gray-300`
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {!isActive && count > 0 && tab.key !== 'all' && (
                <span className={`w-2 h-2 rounded-full ${tab.dot}`} />
              )}
              {tab.label}
              {count > 0 && (
                <span className={`min-w-[20px] h-5 flex items-center justify-center rounded-full text-xs font-bold px-1.5 ${
                  isActive ? 'bg-black/10' : 'bg-gray-100 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lista alert */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Caricamento...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">
            {activeTab === 'all'
              ? 'Nessuna polizza in scadenza nei prossimi 30 giorni.'
              : 'Nessuna polizza in questa categoria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => {
            const chip = getDaysChip(alert._daysLeft)
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border flex items-start gap-4 p-4 transition ${
                  !alert.is_read ? 'border-primary-200 bg-primary-50/20' : 'border-gray-200'
                } ${alert.is_dismissed ? 'opacity-40' : ''} ${getUrgencyBorder(alert._daysLeft)}`}
              >
                <div className="flex-1 min-w-0">
                  {/* Badges riga */}
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${chip.cls}`}>
                      {chip.label}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      alert.type === 'payment' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.type === 'payment' ? 'Rata' : 'Polizza'}
                    </span>
                    {!alert.is_read && <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0" />}
                    {alert.policy_id && sentEmail.has(alert.policy_id) && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Email
                      </span>
                    )}
                    {alert.policy_id && sentWhatsapp.has(alert.policy_id) && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> WA
                      </span>
                    )}
                  </div>

                  {/* Titolo e link polizza */}
                  {alert.policies ? (
                    <Link href={`/dashboard/policies/${alert.policy_id}`} className="font-medium text-gray-900 text-sm hover:text-primary-600 transition">
                      {alert.policies.client_name} — {alert.policies.policy_number}
                    </Link>
                  ) : (
                    <p className="font-medium text-gray-900 text-sm">{alert.title}</p>
                  )}

                  {alert.message && <p className="text-gray-500 text-xs mt-0.5 truncate">{alert.message}</p>}

                  <p className={`text-xs mt-1 font-medium ${
                    alert._daysLeft < 0 ? 'text-red-500' : alert._daysLeft <= 7 ? 'text-yellow-600' : 'text-gray-400'
                  }`}>
                    {new Date(alert.due_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0 items-end">
                  {/* Azioni principali */}
                  {alert.policy_id && (
                    <div className="flex gap-1.5">
                      {(() => {
                        const method = alert.policies?.payment_method
                        const isAutomatic = method === 'rid' || method === 'finanziamento'
                        return isAutomatic ? (
                          <Link
                            href={`/dashboard/policies/${alert.policy_id}`}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 hover:bg-yellow-100 transition whitespace-nowrap"
                          >
                            Verifica pag.
                          </Link>
                        ) : (
                          <Link
                            href={`/dashboard/policies/${alert.policy_id}`}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition whitespace-nowrap"
                          >
                            Incassa
                          </Link>
                        )
                      })()}
                      <Link
                        href={`/dashboard/policies/new?renew=${alert.policy_id}`}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-100 transition whitespace-nowrap"
                      >
                        Rinnova
                      </Link>
                    </div>
                  )}
                  {/* Azioni secondarie */}
                  <div className="flex gap-2">
                    {!alert.is_read && (
                      <button onClick={() => handleMarkRead(alert.id)} className="text-xs text-primary-600 hover:underline whitespace-nowrap">
                        Segna letto
                      </button>
                    )}
                    {!alert.is_dismissed && (
                      <button onClick={() => handleDismiss(alert.id)} className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap">
                        Archivia
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
