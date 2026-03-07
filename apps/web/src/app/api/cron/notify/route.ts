import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { expiryNotificationEmail } from '@/lib/email-templates/expiry-notification'
import { sendWhatsappMessage, isWhatsappConfigured } from '@/lib/whatsapp'

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
  const from29 = new Date(today)
  from29.setDate(today.getDate() + 29)
  const to31 = new Date(today)
  to31.setDate(today.getDate() + 31)

  // Query polizze attive in scadenza tra 29-31 giorni con email o telefono cliente
  const { data: policies, error: policiesError } = await db
    .from('policies')
    .select('id, policy_number, policy_type, client_name, client_email, client_phone, expiry_date, tenant_id, agent_id')
    .eq('status', 'active')
    .gte('expiry_date', from29.toISOString().split('T')[0])
    .lte('expiry_date', to31.toISOString().split('T')[0])

  if (policiesError) {
    return NextResponse.json({ error: 'Errore query polizze', details: policiesError.message }, { status: 500 })
  }

  // Filtra: serve almeno email o telefono
  const contactablePolicies = (policies ?? []).filter(p => p.client_email || p.client_phone)

  if (contactablePolicies.length === 0) {
    return NextResponse.json({ success: true, email: { sent: 0, skipped: 0 }, whatsapp: { sent: 0, skipped: 0 }, errors: [] })
  }

  // Deduplicazione email e whatsapp
  const policyIds = contactablePolicies.map(p => p.id)
  const { data: existingAlerts } = await db
    .from('alerts')
    .select('policy_id, channel')
    .eq('type', 'expiry')
    .in('channel', ['email', 'whatsapp'])
    .in('policy_id', policyIds)
    .ilike('title', '[30gg]%')

  const sentEmails = new Set((existingAlerts ?? []).filter(a => a.channel === 'email').map(a => a.policy_id))
  const sentWhatsapp = new Set((existingAlerts ?? []).filter(a => a.channel === 'whatsapp').map(a => a.policy_id))

  // Fetch tenant e agent info
  const tenantIds = [...new Set(contactablePolicies.map(p => p.tenant_id))]
  const agentIds = [...new Set(contactablePolicies.map(p => p.agent_id).filter(Boolean))]

  const [tenantsRes, agentsRes] = await Promise.all([
    tenantIds.length > 0
      ? db.from('tenants').select('id, name, notification_email, notification_whatsapp').in('id', tenantIds)
      : Promise.resolve({ data: [] }),
    agentIds.length > 0
      ? db.from('profiles').select('id, full_name').in('id', agentIds)
      : Promise.resolve({ data: [] }),
  ])

  const tenantMap = new Map((tenantsRes.data ?? []).map(t => [t.id, t]))
  const agentMap = new Map((agentsRes.data ?? []).map(a => [a.id, a.full_name ?? 'Il tuo agente']))

  const results = {
    email: { sent: 0, skipped: sentEmails.size },
    whatsapp: { sent: 0, skipped: sentWhatsapp.size },
    errors: [] as string[],
  }

  const whatsappEnabled = isWhatsappConfigured()

  for (const policy of contactablePolicies) {
    const expiryFormatted = new Date(policy.expiry_date).toLocaleDateString('it-IT')
    const tenant = tenantMap.get(policy.tenant_id)
    const agencyName = tenant?.name ?? 'Agenzia'
    const agentName = policy.agent_id ? (agentMap.get(policy.agent_id) ?? 'Il tuo agente') : 'Il tuo agente'

    // --- EMAIL ---
    if (policy.client_email && !sentEmails.has(policy.id) && results.email.sent < MAX_EMAILS_PER_RUN) {
      const fromEmail = tenant?.notification_email
        ? `${agencyName} <${tenant.notification_email}>`
        : defaultFromEmail

      const html = expiryNotificationEmail({
        clientName: policy.client_name,
        policyNumber: policy.policy_number,
        policyType: policy.policy_type,
        expiryDate: expiryFormatted,
        agentName,
        agencyName,
      })

      try {
        const { error: sendError } = await resend.emails.send({
          from: fromEmail,
          to: policy.client_email,
          subject: `Promemoria: La tua polizza ${policy.policy_number} scade tra 30 giorni`,
          html,
        })

        if (sendError) {
          results.errors.push(`Email ${policy.client_email}: ${sendError.message}`)
        } else {
          await db.from('alerts').insert({
            tenant_id: policy.tenant_id,
            policy_id: policy.id,
            type: 'expiry',
            title: `[30gg] Polizza ${policy.policy_number} in scadenza`,
            message: `Email inviata a ${policy.client_email} - La polizza di ${policy.client_name} scade il ${expiryFormatted}`,
            due_date: policy.expiry_date,
            channel: 'email',
            sent_at: new Date().toISOString(),
          })
          results.email.sent++
        }
      } catch (err: any) {
        results.errors.push(`Email ${policy.client_email}: ${err.message ?? 'Errore'}`)
      }
    }

    // --- WHATSAPP ---
    if (whatsappEnabled && policy.client_phone && !sentWhatsapp.has(policy.id)) {
      try {
        const waResult = await sendWhatsappMessage({
          to: policy.client_phone,
          clientName: policy.client_name,
          policyNumber: policy.policy_number,
          policyType: policy.policy_type,
          expiryDate: expiryFormatted,
          agentName,
          agencyName,
          fromNumber: tenant?.notification_whatsapp,
        })

        if (!waResult.success) {
          results.errors.push(`WhatsApp ${policy.client_phone}: ${waResult.error}`)
        } else {
          await db.from('alerts').insert({
            tenant_id: policy.tenant_id,
            policy_id: policy.id,
            type: 'expiry',
            title: `[30gg] Polizza ${policy.policy_number} in scadenza`,
            message: `WhatsApp inviato a ${policy.client_phone} - La polizza di ${policy.client_name} scade il ${expiryFormatted}`,
            due_date: policy.expiry_date,
            channel: 'whatsapp',
            sent_at: new Date().toISOString(),
          })
          results.whatsapp.sent++
        }
      } catch (err: any) {
        results.errors.push(`WhatsApp ${policy.client_phone}: ${err.message ?? 'Errore'}`)
      }
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
  })
}
