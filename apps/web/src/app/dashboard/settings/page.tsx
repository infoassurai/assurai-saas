'use client'

import { useEffect, useState } from 'react'
import {
  getProfile,
  updateProfile,
  updateTenant,
  getInsuranceCompanies,
  createInsuranceCompany,
  deleteInsuranceCompany,
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

  // Form compagnia
  const [newCompanyName, setNewCompanyName] = useState('')
  const [newCompanyCode, setNewCompanyCode] = useState('')
  const [companySaving, setCompanySaving] = useState(false)

  const loadData = async () => {
    try {
      const [prof, comps] = await Promise.all([getProfile(), getInsuranceCompanies()])
      setProfile(prof)
      setCompanies(comps)
      if (prof) {
        setFullName(prof.full_name ?? '')
        setPhone(prof.phone ?? '')
        setTenantName(prof.tenants?.name ?? '')
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
    </div>
  )
}
