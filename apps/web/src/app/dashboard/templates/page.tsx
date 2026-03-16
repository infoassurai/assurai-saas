'use client'

import { useEffect, useState } from 'react'
import { getProfile, getNotificationTemplates, upsertNotificationTemplate, uploadTemplateAttachment, deleteTemplateAttachment } from '@/lib/database'
import {
  NOTIFICATION_STAGES,
  STAGE_LABELS,
  TEMPLATE_PLACEHOLDERS,
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_WHATSAPP_TEMPLATES,
  type NotificationStage,
} from '@/lib/notification-defaults'

type Attachment = { file_name: string; file_path: string }

type TemplateData = {
  email_subject: string
  email_body: string
  whatsapp_body: string
  attachments: Attachment[]
}

export default function TemplatesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [activeStage, setActiveStage] = useState<NotificationStage>('30gg')
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)

  const [templates, setTemplates] = useState<Record<NotificationStage, TemplateData>>({
    '30gg':   { email_subject: '', email_body: '', whatsapp_body: '', attachments: [] },
    '15gg':   { email_subject: '', email_body: '', whatsapp_body: '', attachments: [] },
    '7gg':    { email_subject: '', email_body: '', whatsapp_body: '', attachments: [] },
    'scaduta':{ email_subject: '', email_body: '', whatsapp_body: '', attachments: [] },
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const profile = await getProfile()
      if (profile?.tenant_id) setTenantId(profile.tenant_id)

      const dbTemplates = await getNotificationTemplates()

      const merged: Record<NotificationStage, TemplateData> = {} as any
      for (const stage of NOTIFICATION_STAGES) {
        merged[stage] = {
          email_subject: DEFAULT_EMAIL_TEMPLATES[stage].subject,
          email_body: DEFAULT_EMAIL_TEMPLATES[stage].body,
          whatsapp_body: DEFAULT_WHATSAPP_TEMPLATES[stage],
          attachments: [],
        }
      }

      for (const t of dbTemplates) {
        const stage = t.stage as NotificationStage
        if (!merged[stage]) continue
        if (t.channel === 'email') {
          merged[stage].email_subject = t.subject ?? merged[stage].email_subject
          merged[stage].email_body = t.body
          merged[stage].attachments = (t as any).attachments ?? []
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
          attachments: t.attachments,
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

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tenantId) return
    setUploadingAttachment(true)
    setMsg('')
    try {
      const att = await uploadTemplateAttachment(file, tenantId, activeStage)
      setTemplates(prev => ({
        ...prev,
        [activeStage]: {
          ...prev[activeStage],
          attachments: [...prev[activeStage].attachments, att],
        },
      }))
      // Salva subito il template con il nuovo allegato
      const t = { ...templates[activeStage], attachments: [...templates[activeStage].attachments, att] }
      const profile = await getProfile()
      if (profile?.tenant_id) {
        await upsertNotificationTemplate({
          tenant_id: profile.tenant_id,
          stage: activeStage,
          channel: 'email',
          subject: t.email_subject,
          body: t.email_body,
          attachments: t.attachments,
        })
      }
      setMsg('Allegato caricato')
    } catch (err: any) {
      setMsg(`Errore upload: ${err.message}`)
    } finally {
      setUploadingAttachment(false)
      e.target.value = ''
    }
  }

  const handleDeleteAttachment = async (filePath: string) => {
    if (!confirm('Rimuovere questo allegato?')) return
    try {
      await deleteTemplateAttachment(filePath)
      const newAttachments = templates[activeStage].attachments.filter(a => a.file_path !== filePath)
      setTemplates(prev => ({
        ...prev,
        [activeStage]: { ...prev[activeStage], attachments: newAttachments },
      }))
      // Aggiorna template sul DB
      const profile = await getProfile()
      if (profile?.tenant_id) {
        const t = templates[activeStage]
        await upsertNotificationTemplate({
          tenant_id: profile.tenant_id,
          stage: activeStage,
          channel: 'email',
          subject: t.email_subject,
          body: t.email_body,
          attachments: newAttachments,
        })
      }
      setMsg('Allegato rimosso')
    } catch (err: any) {
      setMsg(`Errore: ${err.message}`)
    }
  }

  if (loading) return <div className="text-gray-400 p-8">Caricamento...</div>

  const stageColors: Record<NotificationStage, string> = {
    '30gg': 'bg-blue-500',
    '15gg': 'bg-yellow-500',
    '7gg': 'bg-orange-500',
    'scaduta': 'bg-red-500',
  }

  const currentAttachments = templates[activeStage].attachments ?? []

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

        {/* Allegati */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-medium text-gray-700">Allegati email</h4>
              <p className="text-xs text-gray-400 mt-0.5">I file allegati verranno inviati insieme ad ogni email di questo stage.</p>
            </div>
            <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
              uploadingAttachment
                ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400'
                : 'border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100'
            }`}>
              {uploadingAttachment ? 'Caricamento...' : '+ Aggiungi allegato'}
              <input
                type="file"
                className="hidden"
                disabled={uploadingAttachment}
                onChange={handleAttachmentUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
            </label>
          </div>

          {currentAttachments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">
              Nessun allegato. I file PDF, immagini e documenti Word sono supportati.
            </div>
          ) : (
            <div className="space-y-2">
              {currentAttachments.map((att) => (
                <div key={att.file_path} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{att.file_name}</p>
                    <p className="text-xs text-gray-400 truncate">{att.file_path}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteAttachment(att.file_path)}
                    className="text-xs text-red-500 hover:text-red-700 shrink-0 font-medium"
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          )}
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
