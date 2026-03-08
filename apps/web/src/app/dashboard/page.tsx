'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import {
  getDashboardStats,
  getRecentPolicies,
  generateExpiryAlerts,
  getPolicyTypeDistribution,
  getMonthlyCommissions,
  getPolicyStatusDistribution,
  getPortfolioByCompany,
} from '@/lib/database'

const DashboardCharts = dynamic(() => import('@/components/DashboardCharts'), { ssr: false })

const typeLabels: Record<string, string> = {
  auto: 'Auto', home: 'Casa', life: 'Vita', health: 'Salute', other: 'Altro',
}

const statusLabels: Record<string, string> = {
  active: 'Attiva', expired: 'Scaduta', pending: 'In attesa', cancelled: 'Annullata',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const monthNames: Record<string, string> = {
  '01': 'Gen', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'Mag', '06': 'Giu', '07': 'Lug', '08': 'Ago',
  '09': 'Set', '10': 'Ott', '11': 'Nov', '12': 'Dic',
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState({ activePolicies: 0, expiringPolicies: 0, monthCommissions: 0, totalDocuments: 0, totalPremium: 0, avgPremium: 0, clientiPersona: 0, clientiAzienda: 0, newPoliciesMonth: 0 })
  const [recentPolicies, setRecentPolicies] = useState<any[]>([])
  const [typeData, setTypeData] = useState<any[]>([])
  const [commissionData, setCommissionData] = useState<any[]>([])
  const [statusData, setStatusData] = useState<any[]>([])
  const [portfolioData, setPortfolioData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    generateExpiryAlerts().catch(() => {})
    Promise.all([
      getDashboardStats(),
      getRecentPolicies(),
      getPolicyTypeDistribution(),
      getMonthlyCommissions(),
      getPolicyStatusDistribution(),
      getPortfolioByCompany(),
    ])
      .then(([s, rp, td, cd, sd, pd]) => {
        setStats(s)
        setRecentPolicies(rp)
        setTypeData(td.map(d => ({ ...d, name: typeLabels[d.type] ?? d.type })))
        setCommissionData(cd.map(d => ({
          ...d,
          name: monthNames[d.month.split('-')[1]] ?? d.month,
        })))
        setStatusData(sd.map(d => ({ ...d, name: statusLabels[d.status] ?? d.status })))
        setPortfolioData(pd)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [authLoading])

  if (authLoading || loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-400">Caricamento...</div></div>
  }

  const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

  const statCards = [
    { label: 'Polizze Attive', value: String(stats.activePolicies), color: 'bg-blue-50 text-blue-700' },
    { label: 'In Scadenza (30gg)', value: String(stats.expiringPolicies), color: 'bg-amber-50 text-amber-700' },
    { label: 'Nuove Polizze Mese', value: String(stats.newPoliciesMonth), color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Premio Portafoglio', value: fmt(stats.totalPremium), color: 'bg-green-50 text-green-700' },
    { label: 'Premio Medio', value: fmt(stats.avgPremium), color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Commissioni Mese', value: fmt(stats.monthCommissions), color: 'bg-teal-50 text-teal-700' },
    { label: 'Clienti Persona', value: String(stats.clientiPersona), color: 'bg-sky-50 text-sky-700' },
    { label: 'Clienti Azienda', value: String(stats.clientiAzienda), color: 'bg-purple-50 text-purple-700' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Bentornato{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}
      </h2>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => {
          const isExpiring = stat.label === 'In Scadenza (30gg)'
          const Wrapper = isExpiring ? Link : 'div' as any
          const wrapperProps = isExpiring ? { href: '/dashboard/scadenze' } : {}
          return (
            <Wrapper
              key={stat.label}
              {...wrapperProps}
              className={`bg-white rounded-xl border border-gray-200 p-5 block ${
                isExpiring ? 'hover:border-amber-400 hover:shadow-md transition cursor-pointer' : ''
              }`}
            >
              <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color} inline-block px-2 py-0.5 rounded`}>
                {stat.value}
              </p>
            </Wrapper>
          )
        })}
      </div>

      {/* Grafici - caricati solo client-side */}
      <DashboardCharts
        commissionData={commissionData}
        typeData={typeData}
        statusData={statusData}
      />

      {/* Portafoglio per Compagnia */}
      {portfolioData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Portafoglio per Compagnia</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 font-medium text-gray-600">Compagnia</th>
                  <th className="text-right py-2 font-medium text-gray-600">Polizze Attive</th>
                  <th className="text-right py-2 font-medium text-gray-600">Premio Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {portfolioData.map((row) => (
                  <tr key={row.company_id || '__none__'} className="hover:bg-gray-50">
                    <td className="py-2">
                      {row.company_id ? (
                        <Link href={`/dashboard/policies?company=${row.company_id}`} className="text-primary-600 hover:underline font-medium">
                          {row.company_name}
                        </Link>
                      ) : (
                        <span className="text-gray-500 italic">{row.company_name}</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-gray-900">{row.count}</td>
                    <td className="py-2 text-right text-gray-900">{fmt(row.totalPremium)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 font-semibold">
                  <td className="py-2 text-gray-900">Totale</td>
                  <td className="py-2 text-right text-gray-900">{portfolioData.reduce((s, r) => s + r.count, 0)}</td>
                  <td className="py-2 text-right text-gray-900">{fmt(portfolioData.reduce((s, r) => s + r.totalPremium, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attività Recente */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Attività Recente</h3>
          <Link href="/dashboard/policies" className="text-sm text-primary-600 hover:underline">
            Vedi tutte
          </Link>
        </div>

        {recentPolicies.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Nessuna attività recente.{' '}
            <Link href="/dashboard/policies/new" className="text-primary-600 hover:underline">
              Crea la tua prima polizza
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left py-2 font-medium text-gray-600">N. Polizza</th>
                  <th className="text-left py-2 font-medium text-gray-600">Cliente</th>
                  <th className="text-left py-2 font-medium text-gray-600">Tipo</th>
                  <th className="text-left py-2 font-medium text-gray-600">Stato</th>
                  <th className="text-left py-2 font-medium text-gray-600">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentPolicies.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="py-2">
                      <Link href={`/dashboard/policies/${p.id}`} className="text-primary-600 hover:underline font-medium">
                        {p.policy_number}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-900">{p.client_name}</td>
                    <td className="py-2 text-gray-600">{typeLabels[p.policy_type] ?? p.policy_type}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[p.status]}`}>
                        {statusLabels[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500">{new Date(p.created_at).toLocaleDateString('it-IT')}</td>
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
