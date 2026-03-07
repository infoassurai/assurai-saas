'use client'

import { useEffect, useState } from 'react'
import {
  getProfile,
  updateProfile,
  updateTenant,
  getInsuranceCompanies,
  createInsuranceCompany,
  deleteInsuranceCompany,
  getTodos,
  createTodo,
  updateTodo,
  deleteTodo,
} from '@/lib/database'

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form profilo
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  // Todos
  const [todos, setTodos] = useState<any[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [todoSaving, setTodoSaving] = useState(false)

  // Notifiche
  const [notifEmail, setNotifEmail] = useState('')
  const [notifWhatsapp, setNotifWhatsapp] = useState('')
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifMsg, setNotifMsg] = useState('')

  // Form compagnia
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyCode, setNewCompanyCode] = useState('')
  const [companySaving, setCompanySaving] = useState(false)

  const loadData = async () => {
    try {
      const [prof, comps, td] = await Promise.all([getProfile(), getInsuranceCompanies(), getTodos()])
      setProfile(prof)
      setCompanies(comps)

      // Seed TODO iniziali se lista vuota
      if (td.length === 0) {
        const seedTodos = [
          'Template OCR per altre compagnie (Allianz, UnipolSai, AXA, Zurich)',
          'Rinnovo automatico polizze in scadenza',
          'Notifiche email/SMS scadenze',
          'Integrazione Stripe per abbonamenti',
          'Dashboard multi-agente (ruoli e permessi)',
          'Report PDF mensile commissioni',
          'App mobile (PWA)',
        ]
        const created = []
        for (const text of seedTodos) {
          try {
            const todo = await createTodo(text)
            created.push(todo)
          } catch { /* ignore */ }
        }
        setTodos(created)
      } else {
        setTodos(td)
      }
      if (prof) {
        setFullName(prof.full_name ?? '')
        setPhone(prof.phone ?? '')
        setTenantName(prof.tenants?.name ?? '')
        setNotifEmail(prof.tenants?.notification_email ?? '')
        setNotifWhatsapp(prof.tenants?.notification_whatsapp ?? '')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg('')
    try {
      await updateProfile({ full_name: fullName, phone })
      if (profile?.tenant_id) {
        await updateTenant(profile.tenant_id, { name: tenantName })
      }
      setProfileMsg('Salvato con successo')
    } catch (err: any) {
      setProfileMsg(`Errore: ${err.message}`)
    } finally {
      setProfileSaving(false)
    }
  }

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCompanyName.trim()) return
    setCompanySaving(true)
    try {
      await createInsuranceCompany({ name: newCompanyName, code: newCompanyCode || undefined })
      setNewCompanyName('')
      setNewCompanyCode('')
      const comps = await getInsuranceCompanies()
      setCompanies(comps)
    } catch (err) {
      console.error(err)
    } finally {
      setCompanySaving(false)
    }
  }

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!confirm(`Eliminare "${name}"?`)) return
    try {
      await deleteInsuranceCompany(id)
      setCompanies(companies.filter(c => c.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodo.trim()) return
    setTodoSaving(true)
    try {
      const todo = await createTodo(newTodo.trim())
      setTodos([...todos, todo])
      setNewTodo('')
    } catch (err) {
      console.error(err)
    } finally {
      setTodoSaving(false)
    }
  }

  const handleToggleTodo = async (id: string, isDone: boolean) => {
    try {
      await updateTodo(id, { is_done: !isDone })
      setTodos(todos.map(t => t.id === id ? { ...t, is_done: !isDone } : t))
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteTodo = async (id: string) => {
    try {
      await deleteTodo(id)
      setTodos(todos.filter(t => t.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div className="text-gray-400 p-8">Caricamento...</div>

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-2xl font-bold text-gray-900">Impostazioni</h2>

      {/* Profilo */}
      <form onSubmit={handleSaveProfile} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Profilo</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome Agenzia</label>
          <input value={tenantName} onChange={(e) => setTenantName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={profileSaving}
            className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
            {profileSaving ? 'Salvataggio...' : 'Salva Profilo'}
          </button>
          {profileMsg && (
            <span className={`text-sm ${profileMsg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
              {profileMsg}
            </span>
          )}
        </div>
      </form>

      {/* Notifiche */}
      <form onSubmit={async (e) => {
        e.preventDefault()
        if (!profile?.tenant_id) return
        setNotifSaving(true)
        setNotifMsg('')
        try {
          await updateTenant(profile.tenant_id, {
            notification_email: notifEmail || undefined,
            notification_whatsapp: notifWhatsapp || undefined,
          })
          setNotifMsg('Salvato con successo')
        } catch (err: any) {
          setNotifMsg(`Errore: ${err.message}`)
        } finally {
          setNotifSaving(false)
        }
      }} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Notifiche Scadenze</h3>
        <p className="text-sm text-gray-500">
          Configura l&apos;email e il numero WhatsApp da cui inviare le notifiche di scadenza ai tuoi clienti.
          Se lasci vuoto, verranno usati i valori predefiniti del sistema.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email mittente</label>
            <input
              type="email"
              value={notifEmail}
              onChange={(e) => setNotifEmail(e.target.value)}
              placeholder="es. noreply@tuaagenzia.it"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Richiede dominio verificato su Resend</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Numero WhatsApp</label>
            <input
              type="tel"
              value={notifWhatsapp}
              onChange={(e) => setNotifWhatsapp(e.target.value)}
              placeholder="es. +39 333 1234567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Richiede account Twilio WhatsApp Business</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={notifSaving}
            className="bg-primary-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50">
            {notifSaving ? 'Salvataggio...' : 'Salva Notifiche'}
          </button>
          {notifMsg && (
            <span className={`text-sm ${notifMsg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
              {notifMsg}
            </span>
          )}
        </div>
      </form>

      {/* Compagnie Assicurative */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Compagnie Assicurative</h3>

        {companies.length > 0 && (
          <div className="space-y-2">
            {companies.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-900">{c.name}</span>
                  {c.code && <span className="text-xs text-gray-400 ml-2">({c.code})</span>}
                </div>
                <button
                  onClick={() => handleDeleteCompany(c.id, c.name)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Elimina
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddCompany} className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Nome compagnia</label>
            <input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)}
              placeholder="Es. Allianz, Generali..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <div className="w-28">
            <label className="block text-xs text-gray-500 mb-1">Codice</label>
            <input value={newCompanyCode} onChange={(e) => setNewCompanyCode(e.target.value)}
              placeholder="ALZ"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
          </div>
          <button type="submit" disabled={companySaving || !newCompanyName.trim()}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 whitespace-nowrap">
            + Aggiungi
          </button>
        </form>
      </div>

      {/* TODO - Prossime implementazioni */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">TODO - Prossime Implementazioni</h3>
          <span className="text-xs text-gray-400">
            {todos.filter(t => t.is_done).length}/{todos.length} completati
          </span>
        </div>

        {todos.length > 0 && (
          <div className="space-y-1">
            {todos.map((t) => (
              <div key={t.id} className="flex items-center gap-3 group px-2 py-1.5 rounded-lg hover:bg-gray-50">
                <button
                  onClick={() => handleToggleTodo(t.id, t.is_done)}
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition ${
                    t.is_done
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {t.is_done && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span className={`flex-1 text-sm ${t.is_done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {t.text}
                </span>
                <button
                  onClick={() => handleDeleteTodo(t.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddTodo} className="flex gap-2">
          <input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Aggiungi una nota..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
          <button
            type="submit"
            disabled={todoSaving || !newTodo.trim()}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50 whitespace-nowrap"
          >
            + Aggiungi
          </button>
        </form>
      </div>
    </div>
  )
}
