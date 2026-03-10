import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { expiryNotificationEmail } from '@/lib/email-templates/expiry-notification'
import { sendWhatsappMessage, isWhatsappConfigured } from '@/lib/whatsapp'
import {
  DEFAULT_EMAIL_TEMPLATES,
  DEFAULT_PREFS,
  getStageForDays,
  replacePlaceholders,
} from '@/lib/notification-defaults'
import { executeCampaignSend } from '@/lib/campaign-sender'
import { calculateNextPaymentDate, type PaymentFrequency } from '@/lib/paymentUtils'

const MAX_EMAILS_PER_RUN = 95

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const defaultFromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendKey || !defaultFromEmail) {
    return NextResponse.json({ error: 'Configurazione email mancante (RESEND_API_KEY o RESEND_FROM_EMAIL)' }, { status: 500 })
  }

  const resend = new Resend(resendKey)
  const db = getSupabaseAdmin()

  const today = new Date()

  // Query polizze: scadenza entro 31 giorni o scadute da max 2 giorni
  const from = new Date(today)
  from.setDate(today.getDate() - 2)
  const to = new Date(today)
  to.setDate(today.getDate() + 31)

  // Query polizze con scadenza polizza O scadenza rata nel range
  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]
  const { data: policies, error: policiesError } = await db
    .from('policies')
    .select('id, policy_number, policy_type, client_name, client_email, client_phone, effective_date, expiry_date, tenant_id, agent_id, payment_frequency, payment_expiry_date')
    .eq('status', 'active')
    .or(`and(expiry_date.gte.${fromStr},expiry_date.lte.${toStr}),and(payment_expiry_date.gte.${fromStr},payment_expiry_date.lte.${toStr})`)

  if (policiesError) {
    return NextResponse.json({ error: 'Errore query polizze', details: policiesError.message }, { status: 500 })
  }

  // Filtra: serve almeno email o telefono
  const contactablePolicies = (policies ?? []).filter(p => p.client_email || p.client_phone)

  if (contactablePolicies.length === 0) {
    return NextResponse.json({ success: true, email: { sent: 0, skipped: 0 }, whatsapp: { sent: 0, skipped: 0 }, errors: [] })
  }

  // Deduplicazione: cerca alert email/whatsapp esistenti per queste polizze
  const policyIds = contactablePolicies.map(p => p.id)
  const { data: existingAlerts } = await db
    .from('alerts')
    .select('policy_id, channel, title, type')
    .in('type', ['expiry', 'payment'])
    .in('channel', ['email', 'whatsapp'])
    .in('policy_id', policyIds)

  // Set di chiavi "policyId_stage_channel_type" per deduplicazione
  const sentKeys = new Set(
    (existingAlerts ?? []).map(a => {
      const match = a.title?.match(/^\[(\w+)\]/)
      const stage = match ? match[1] : ''
      return `${a.policy_id}_${stage}_${a.channel}_${a.type}`
    })
  )

  // Fetch tenant, agent, e template info
  const tenantIds = [...new Set(contactablePolicies.map(p => p.tenant_id))]
  const agentIds = [...new Set(contactablePolicies.map(p => p.agent_id).filter(Boolean))]

  const [tenantsRes, agentsRes, templatesRes] = await Promise.all([
    tenantIds.length > 0
      ? db.from('tenants').select('id, name, notification_email, notification_whatsapp, notification_cron_hour, notification_prefs').in('id', tenantIds)
      : Promise.resolve({ data: [] }),
    agentIds.length > 0
      ? db.from('profiles').select('id, full_name').in('id', agentIds)
      : Promise.resolve({ data: [] }),
    tenantIds.length > 0
      ? db.from('notification_templates').select('tenant_id, stage, channel, subject, body').in('tenant_id', tenantIds)
      : Promise.resolve({ data: [] }),
  ])

  const tenantMap = new Map((tenantsRes.data ?? []).map(t => [t.id, t]))
  const agentMap = new Map((agentsRes.data ?? []).map(a => [a.id, a.full_name ?? 'Il tuo agente']))

  // Organizza template per tenant_id -> stage -> channel
  const templateMap = new Map<string, Map<string, Map<string, { subject?: string; body: string }>>>()
  for (const t of templatesRes.data ?? []) {
    if (!templateMap.has(t.tenant_id)) templateMap.set(t.tenant_id, new Map())
    const tenantTemplates = templateMap.get(t.tenant_id)!
    if (!tenantTemplates.has(t.stage)) tenantTemplates.set(t.stage, new Map())
    tenantTemplates.get(t.stage)!.set(t.channel, { subject: t.subject, body: t.body })
  }

  const results = {
    email: { sent: 0, skipped: 0 },
    whatsapp: { sent: 0, skipped: 0 },
    errors: [] as string[],
  }

  // Filtra per orario cron del tenant (ora corrente CET)
  const currentHourCET = new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome', hour: 'numeric', hour12: false })
  const currentHour = parseInt(currentHourCET, 10)

  const whatsappEnabled = isWhatsappConfigured()

  for (const policy of contactablePolicies) {
    const tenant = tenantMap.get(policy.tenant_id)
    const tenantCronHour = tenant?.notification_cron_hour ?? 8
    if (currentHour !== tenantCronHour) continue

    // Calcola giorni alla scadenza e determina lo stage
    const daysLeft = Math.ceil(
      (new Date(policy.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )
    const stage = getStageForDays(daysLeft)

    // Controlla anche se c'è una rata in scadenza
    const paymentDate = policy.payment_expiry_date
    const paymentDaysForCheck = paymentDate
      ? Math.ceil((new Date(paymentDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : 999
    const paymentStageForCheck = getStageForDays(paymentDaysForCheck)

    if (!stage && !paymentStageForCheck) continue // Nessuna notifica da inviare

    // Controlla preferenze del tenant per lo stage più urgente
    const activeStage = stage || paymentStageForCheck!
    const prefs = tenant?.notification_prefs ?? DEFAULT_PREFS
    const stagePrefs = prefs[activeStage] ?? { email: true, whatsapp: false }

    const expiryFormatted = new Date(policy.expiry_date).toLocaleDateString('it-IT')
    const agencyName = tenant?.name ?? 'Agenzia'
    const agentName = policy.agent_id ? (agentMap.get(policy.agent_id) ?? 'Il tuo agente') : 'Il tuo agente'

    // Variabili per i template
    const templateVars = {
      clientName: policy.client_name,
      policyNumber: policy.policy_number,
      policyType: policy.policy_type,
      expiryDate: expiryFormatted,
      agentName,
      agencyName,
    }

    // Recupera template personalizzati (se esistono)
    const tenantTemplates = templateMap.get(policy.tenant_id)
    const emailTemplate = tenantTemplates?.get(activeStage)?.get('email')
    const whatsappTemplate = tenantTemplates?.get(activeStage)?.get('whatsapp')

    // --- Determina le notifiche da inviare ---
    // Notifica scadenza polizza (expiry_date)
    // Notifica scadenza rata (payment_expiry_date) - solo se diversa da expiry_date
    const notifications: { type: 'expiry' | 'payment'; dueDate: string; daysLeft: number; stage: string; label: string }[] = []

    if (stage) {
      notifications.push({
        type: 'expiry',
        dueDate: policy.expiry_date,
        daysLeft,
        stage,
        label: `Polizza ${policy.policy_number} ${stage === 'scaduta' ? 'scaduta' : 'in scadenza'}`,
      })
    }

    // Scadenza rata: solo se payment_expiry_date è diversa da expiry_date
    if (paymentDate && paymentDate !== policy.expiry_date) {
      const paymentDaysLeft = Math.ceil(
        (new Date(paymentDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      const paymentStage = getStageForDays(paymentDaysLeft)
      if (paymentStage) {
        notifications.push({
          type: 'payment',
          dueDate: paymentDate,
          daysLeft: paymentDaysLeft,
          stage: paymentStage,
          label: `Rata polizza ${policy.policy_number} ${paymentStage === 'scaduta' ? 'scaduta' : 'in scadenza'}`,
        })
      }
    }

    for (const notif of notifications) {
      const notifTitle = `[${notif.stage}] ${notif.label}`
      const notifDateFormatted = new Date(notif.dueDate).toLocaleDateString('it-IT')
      const notifMessage = notif.type === 'payment'
        ? `La rata della polizza di ${policy.client_name} scade il ${notifDateFormatted}`
        : (notif.daysLeft <= 0
          ? `La polizza di ${policy.client_name} è scaduta il ${notifDateFormatted}`
          : `La polizza di ${policy.client_name} scade tra ${notif.daysLeft} giorni (${notifDateFormatted})`)

      // --- EMAIL ---
      if (stagePrefs.email && policy.client_email && results.email.sent < MAX_EMAILS_PER_RUN) {
        const dedupKey = `${policy.id}_${notif.stage}_email_${notif.type}`
        if (sentKeys.has(dedupKey)) {
          results.email.skipped++
        } else {
          const fromEmail = tenant?.notification_email
            ? `${agencyName} <${tenant.notification_email}>`
            : defaultFromEmail

          const subject = emailTemplate?.subject
            ? replacePlaceholders(emailTemplate.subject, templateVars)
            : replacePlaceholders((DEFAULT_EMAIL_TEMPLATES as any)[notif.stage]?.subject ?? DEFAULT_EMAIL_TEMPLATES['30gg'].subject, templateVars)

          const customBody = emailTemplate?.body
            ? replacePlaceholders(emailTemplate.body, templateVars)
            : undefined

          const html = expiryNotificationEmail({
            ...templateVars,
            customBody,
          })

          try {
            const { error: sendError } = await resend.emails.send({
              from: fromEmail,
              to: policy.client_email,
              subject: notif.type === 'payment' ? `Scadenza rata - ${policy.policy_number}` : subject,
              html,
            })

            if (sendError) {
              results.errors.push(`Email ${policy.client_email} [${notif.stage}/${notif.type}]: ${sendError.message}`)
            } else {
              await db.from('alerts').insert({
                tenant_id: policy.tenant_id,
                policy_id: policy.id,
                type: notif.type,
                title: notifTitle,
                message: `Email inviata a ${policy.client_email} - ${notifMessage}`,
                due_date: notif.dueDate,
                channel: 'email',
                sent_at: new Date().toISOString(),
              })
              results.email.sent++
              sentKeys.add(dedupKey)
            }
          } catch (err: any) {
            results.errors.push(`Email ${policy.client_email} [${notif.stage}/${notif.type}]: ${err.message ?? 'Errore'}`)
          }
        }
      }

      // --- WHATSAPP ---
      if (stagePrefs.whatsapp && whatsappEnabled && policy.client_phone) {
        const dedupKey = `${policy.id}_${notif.stage}_whatsapp_${notif.type}`
        if (sentKeys.has(dedupKey)) {
          results.whatsapp.skipped++
        } else {
          const customBody = whatsappTemplate?.body
            ? replacePlaceholders(whatsappTemplate.body, templateVars)
            : undefined

          try {
            const waResult = await sendWhatsappMessage({
              ...templateVars,
              to: policy.client_phone,
              fromNumber: tenant?.notification_whatsapp,
              customBody,
            })

            if (!waResult.success) {
              results.errors.push(`WhatsApp ${policy.client_phone} [${notif.stage}/${notif.type}]: ${waResult.error}`)
            } else {
              await db.from('alerts').insert({
                tenant_id: policy.tenant_id,
                policy_id: policy.id,
                type: notif.type,
                title: notifTitle,
                message: `WhatsApp inviato a ${policy.client_phone} - ${notifMessage}`,
                due_date: notif.dueDate,
                channel: 'whatsapp',
                sent_at: new Date().toISOString(),
              })
              results.whatsapp.sent++
              sentKeys.add(dedupKey)
            }
          } catch (err: any) {
            results.errors.push(`WhatsApp ${policy.client_phone} [${notif.stage}/${notif.type}]: ${err.message ?? 'Errore'}`)
          }
        }
      }
    }

    // Dopo notifica rata, ricalcola payment_expiry_date alla prossima data futura
    if (policy.payment_expiry_date && policy.payment_frequency && policy.payment_frequency !== 'annuale') {
      const paymentDaysLeft = Math.ceil(
        (new Date(policy.payment_expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )
      if (paymentDaysLeft <= 0) {
        // La rata è scaduta, ricalcola alla prossima
        const nextPayment = calculateNextPaymentDate(
          policy.effective_date ?? policy.expiry_date,
          policy.expiry_date,
          policy.payment_frequency as PaymentFrequency
        )
        if (nextPayment !== policy.payment_expiry_date) {
          await db.from('policies').update({ payment_expiry_date: nextPayment }).eq('id', policy.id)
        }
      }
    }
  }

  // ============================================
  // CAMPAGNE PROGRAMMATE
  // ============================================
  const campaignResults: string[] = []
  try {
    const { data: scheduled } = await db
      .from('campaigns')
      .select('id')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())

    for (const c of scheduled ?? []) {
      try {
        await executeCampaignSend(c.id)
        campaignResults.push(`Campagna ${c.id}: inviata`)
      } catch (err: any) {
        campaignResults.push(`Campagna ${c.id}: errore - ${err.message}`)
      }
    }

    // Riprendi campagne in stato 'sending' (invio parziale precedente)
    const { data: sending } = await db
      .from('campaigns')
      .select('id')
      .eq('status', 'sending')

    for (const c of sending ?? []) {
      try {
        await executeCampaignSend(c.id)
        campaignResults.push(`Campagna ${c.id}: ripresa invio`)
      } catch (err: any) {
        campaignResults.push(`Campagna ${c.id}: errore ripresa - ${err.message}`)
      }
    }
  } catch { }

  return NextResponse.json({
    success: true,
    ...results,
    campaigns: campaignResults,
  })
}
