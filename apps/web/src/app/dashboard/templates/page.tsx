'use client'

import { useEffect, useState } from 'react'
import { getProfile, getNotificationTemplates, upsertNotificationTemplate } from '@/lib/database'
import {
  NOTIFICATION_STAGES,
  STAGE_LABELS,
  TEMPLATE_PLACEHOLDERS,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_WHATSAPP_TEMPLATES,
  type NotificationStage,
} from '@/lib/notification-defaults'

type TemplateData = {
  email_subject: string
  email_body: string
  whatsapp_body: string
}

export default function TemplatesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeStage, setActiveStage] = useState<NotificationStage>('30gg')
  const [templates, setTemplates] = useState<Record<NotificationStage, TemplateData>>({
    '30gg': { email_subject: '', email_body: '', whatsapp_body: '' },
    '15gg': { email_subject: '', email_body: '', whatsapp_body: '' },
    '7gg': { email_subject: '', email_body: '', whatsapp_body: '' },
    'scaduta': { email_subject: '', email_body: '', whatsapp_body: '' },
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const dbTemplates = await getNotificationTemplates()

      // Inizializza con i default, poi sovrascrivi con quelli salvati
      const merged: Record<NotificationStage, TemplateData> = {} as any
      for (const stage of NOTIFICATION_STAGES) {
        merged[stage] = {
          email_subject: DEFAULT_EMAIL_TEMPLATES[stage].subject,
          email_body: DEFAULT_EMAIL_TEMPLATES[stage].body,
          whatsapp_body: DEFAULT_WHATSAPP_TEMPLATES[stage],
        }
      }

      for (const t of dbTemplates) {
        const stage = t.stage as NotificationStage
        if (!merged[stage]) continue
        if (t.channel === 'email') {
          merged[stage].email_subject = t.subject ?? merged[stage].email_subject
          merged[stage].email_body = t.body
        } else if (t.channel === 'whatsapp') {
          merged[stage].whatsapp_body = t.body
        }
      }

      setTemplates(merged)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const profile = await getProfile()
      if (!profile?.tenant_id) throw new Error('Tenant non trovato')

      const t = templates[activeStage]

      await Promise.all([
        upsertNotificationTemplate({
          tenant_id: profile.tenant_id,
          stage: activeStage,
          channel: 'email',
          subject: t.email_subject,
          body: t.email_body,
        }),
        upsertNotificationTemplate({
          tenant_id: profile.tenant_id,
          stage: activeStage,
          channel: 'whatsapp',
          subject: null,
          body: t.whatsapp_body,
        }),
      ])
      setMsg('Template salvato con successo')
    } catch (err: any) {
      setMsg(`Errore: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = (field: 'email_subject' | 'email_body' | 'whatsapp_body') => {
    setTemplates(prev => ({
      ...prev,
      [activeStage]: {
        ...prev[activeStage],
        ...(field === 'email_subject' ? { email_subject: DEFAULT_EMAIL_TEMPLATES[activeStage].subject } : {}),
        ...(field === 'email_body' ? { email_body: DEFAULT_EMAIL_TEMPLATES[activeStage].body } : {}),
        ...(field === 'whatsapp_body' ? { whatsapp_body: DEFAULT_WHATSAPP_TEMPLATES[activeStage] } : {}),
      },
    }))
  }

  const updateField = (field: keyof TemplateData, value: string) => {
    setTemplates(prev => ({
      ...prev,
      [activeStage]: { ...prev[activeStage], [field]: value },
    }))
    setMsg('')
  }

  if (loading) return <div className="text-gray-400 p-8">Caricamento...</div>

  const stageColors: Record<NotificationStage, string> = {
    '30gg': 'bg-blue-500',
    '15gg': 'bg-yellow-500',
    '7gg': 'bg-orange-500',
    'scaduta': 'bg-red-500',
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Template di Invio</h2>
        <p className="text-sm text-gray-500 mt-1">
          Personalizza i messaggi email e WhatsApp per ogni fase di scadenza polizza.
        </p>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2">
        {NOTIFICATION_STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => { setActiveStage(stage); setMsg('') }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              activeStage === stage
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${stageColors[stage]}`} />
            {STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      {/* Placeholders info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Variabili disponibili</h4>
        <div className="flex flex-wrap gap-3">
          {TEMPLATE_PLACEHOLDERS.map((p) => (
            <span key={p.key} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-mono">
              {p.key} <span className="text-blue-500 font-sans">= {p.desc}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Email template */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Template Email</h3>
          <button
            onClick={() => { handleReset('email_subject'); handleReset('email_body') }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Ripristina default
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Oggetto</label>
          <input
            type="text"
            value={templates[activeStage].email_subject}
            onChange={(e) => updateField('email_subject', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Corpo del messaggio</label>
          <textarea
            value={templates[activeStage].email_body}
            onChange={(e) => updateField('email_body', e.target.value)}
            rows={8}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">Il testo viene inserito automaticamente nel template HTML con header e firma dell&apos;agenzia.</p>
        </div>
      </div>

      {/* WhatsApp template */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Template WhatsApp</h3>
          <button
            onClick={() => handleReset('whatsapp_body')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Ripristina default
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Messaggio</label>
          <textarea
            value={templates[activeStage].whatsapp_body}
            onChange={(e) => updateField('whatsapp_body', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-y font-mono"
          />
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
        >
          {saving ? 'Salvataggio...' : `Salva Template "${STAGE_LABELS[activeStage]}"`}
        </button>
        {msg && (
          <span className={`text-sm ${msg.startsWith('Errore') ? 'text-red-500' : 'text-green-600'}`}>
            {msg}
          </span>
        )}
      </div>
    </div>
  )
}
