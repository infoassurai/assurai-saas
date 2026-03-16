'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getClients } from '@/lib/database'

export default function ClientsPage() {
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [clientType, setClientType] = useState('')
  const [citta, setCitta] = useState('')

  const loadClients = async () => {
    setLoading(true)
    try {
      const data = await getClients({
        search: search || undefined,
        client_type: clientType || undefined,
        citta: citta || undefined,
      })
      setClients(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [clientType, citta])

  useEffect(() => {
    const t = setTimeout(() => loadClients(), 300)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Clienti</h2>
        <Link
          href="/dashboard/clients/new"
          className="bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition"
        >
          + Nuovo Cliente
        </Link>
      </div>

      {/* Filtri */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cerca per nome, email, CF..."
          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
        <select
          value={clientType}
          onChange={(e) => setClientType(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
        >
          <option value="">Tutti i tipi</option>
          <option value="persona">Persona</option>
          <option value="azienda">Azienda</option>
        </select>
        <input
          type="text"
          value={citta}
          onChange={(e) => setCitta(e.target.value)}
          placeholder="Filtra per citta..."
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Caricamento...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            Nessun cliente trovato.{' '}
            <Link href="/dashboard/clients/new" className="text-primary-600 hover:underline">
              Crea il primo cliente
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Telefono</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Citta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/clients/${c.id}`} className="text-primary-600 hover:underline font-medium">
                        {c.name}
                      </Link>
                      {c.do_not_contact && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">
                          Non contattare
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{c.client_type || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.citta || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
