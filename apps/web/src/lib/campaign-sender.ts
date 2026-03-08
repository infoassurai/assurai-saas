import { Resend } from 'resend'
import { getSupabaseAdmin } from './supabase-admin'
import { campaignEmail } from './email-templates/campaign-email'
import { replaceCampaignPlaceholders } from './notification-defaults'
import { sendWhatsappMessage, isWhatsappConfigured } from './whatsapp'

const MAX_SENDS_PER_RUN = 95

interface CampaignResult {
  success: boolean
  sent: number
  failed: number
  errors: string[]
}

export async function executeCampaignSend(campaignId: string): Promise<CampaignResult> {
  const db = getSupabaseAdmin()

  // 1. Fetch campagna
  const { data: campaign, error: campError } = await db
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campError || !campaign) {
    return { success: false, sent: 0, failed: 0, errors: ['Campagna non trovata'] }
  }

  if (campaign.status === 'sent') {
    return { success: false, sent: 0, failed: 0, errors: ['Campagna gia inviata'] }
  }

  // 2. Fetch tenant + agent info
  const { data: tenant } = await db
    .from('tenants')
    .select('id, name, notification_email')
    .eq('id', campaign.tenant_id)
    .single()

  let agentName = 'Il tuo agente'
  if (campaign.created_by) {
    const { data: agent } = await db
      .from('profiles')
      .select('full_name')
      .eq('id', campaign.created_by)
      .single()
    if (agent?.full_name) agentName = agent.full_name
  }

  const agencyName = tenant?.name ?? 'Agenzia'

  // 3. Build audience query
  const filters = campaign.filters ?? {}
  let query = db
    .from('clients')
    .select('id, name, email, phone, citta')
    .eq('tenant_id', campaign.tenant_id)

  if (filters.client_type) query = query.eq('client_type', filters.client_type)
  if (filters.citta) query = query.ilike('citta', `%${filters.citta}%`)
  if (filters.cap) query = query.eq('cap', filters.cap)
  if (filters.professione) query = query.ilike('professione', `%${filters.professione}%`)
  if (filters.sesso) query = query.eq('sesso', filters.sesso)

  if (filters.eta_min || filters.eta_max) {
    const today = new Date()
    if (filters.eta_max) {
      const minBirth = new Date(today.getFullYear() - filters.eta_max - 1, today.getMonth(), today.getDate())
      query = query.gte('data_nascita', minBirth.toISOString().split('T')[0])
    }
    if (filters.eta_min) {
      const maxBirth = new Date(today.getFullYear() - filters.eta_min, today.getMonth(), today.getDate())
      query = query.lte('data_nascita', maxBirth.toISOString().split('T')[0])
    }
  }

  const { data: allClients } = await query

  if (!allClients || allClients.length === 0) {
    await db.from('campaigns').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      stats: { sent: 0, failed: 0, total: 0 },
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId)
    return { success: true, sent: 0, failed: 0, errors: [] }
  }

  // Apply policy-level filters if any
  let clientIds = allClients.map(c => c.id)

  const hasPolicyFilters = filters.policy_type || filters.company_id || filters.status ||
    filters.premio_min || filters.premio_max || filters.scadenza_entro_giorni

  if (hasPolicyFilters) {
    let policyQuery = db
      .from('policies')
      .select('client_id')
      .eq('tenant_id', campaign.tenant_id)
      .not('client_id', 'is', null)
      .in('client_id', clientIds)

    if (filters.policy_type && Array.isArray(filters.policy_type) && filters.policy_type.length > 0) {
      policyQuery = policyQuery.in('policy_type', filters.policy_type)
    }
    if (filters.company_id) policyQuery = policyQuery.eq('company_id', filters.company_id)
    if (filters.status) policyQuery = policyQuery.eq('status', filters.status)
    if (filters.premio_min) policyQuery = policyQuery.gte('premium_amount', filters.premio_min)
    if (filters.premio_max) policyQuery = policyQuery.lte('premium_amount', filters.premio_max)

    if (filters.scadenza_entro_giorni) {
      const future = new Date()
      future.setDate(future.getDate() + filters.scadenza_entro_giorni)
      policyQuery = policyQuery
        .gte('expiry_date', new Date().toISOString().split('T')[0])
        .lte('expiry_date', future.toISOString().split('T')[0])
    }

    const { data: matchingPolicies } = await policyQuery
    const policyClientIds = new Set((matchingPolicies ?? []).map((p: any) => p.client_id))
    clientIds = clientIds.filter(id => policyClientIds.has(id))
  }

  // Filter by channel availability
  const clients = allClients.filter(c => {
    if (!clientIds.includes(c.id)) return false
    if (campaign.channel === 'email') return !!c.email
    if (campaign.channel === 'whatsapp') return !!c.phone
    return !!c.email || !!c.phone // 'both'
  })

  if (clients.length === 0) {
    await db.from('campaigns').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      stats: { sent: 0, failed: 0, total: 0 },
      updated_at: new Date().toISOString(),
    }).eq('id', campaignId)
    return { success: true, sent: 0, failed: 0, errors: [] }
  }

  // 4. Mark campaign as sending
  await db.from('campaigns').update({
    status: 'sending',
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId)

  // 5. Check already-sent sends for this campaign (for resume)
  const { data: existingSends } = await db
    .from('campaign_sends')
    .select('client_id, channel')
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'pending'])

  const sentSet = new Set(
    (existingSends ?? []).map(s => `${s.client_id}_${s.channel}`)
  )

  // 6. Setup providers
  const resendKey = process.env.RESEND_API_KEY
  const defaultFromEmail = process.env.RESEND_FROM_EMAIL
  const resend = resendKey ? new Resend(resendKey) : null
  const whatsappEnabled = isWhatsappConfigured()

  const result: CampaignResult = { success: true, sent: 0, failed: 0, errors: [] }
  let totalSendsThisRun = 0

  for (const client of clients) {
    if (totalSendsThisRun >= MAX_SENDS_PER_RUN) break

    const templateVars = {
      clientName: client.name,
      clientEmail: client.email ?? '',
      citta: client.citta ?? '',
      agentName,
      agencyName,
    }

    const channels: ('email' | 'whatsapp')[] = []
    if ((campaign.channel === 'email' || campaign.channel === 'both') && client.email) channels.push('email')
    if ((campaign.channel === 'whatsapp' || campaign.channel === 'both') && client.phone) channels.push('whatsapp')

    for (const ch of channels) {
      if (totalSendsThisRun >= MAX_SENDS_PER_RUN) break
      if (sentSet.has(`${client.id}_${ch}`)) continue

      const bodyText = replaceCampaignPlaceholders(campaign.body, templateVars)

      if (ch === 'email' && resend && defaultFromEmail) {
        const fromEmail = tenant?.notification_email
          ? `${agencyName} <${tenant.notification_email}>`
          : defaultFromEmail

        const subject = campaign.subject
          ? replaceCampaignPlaceholders(campaign.subject, templateVars)
          : campaign.name

        const html = campaignEmail({ body: bodyText, agentName, agencyName })

        try {
          const { error: sendError } = await resend.emails.send({
            from: fromEmail,
            to: client.email!,
            subject,
            html,
          })

          if (sendError) {
            await db.from('campaign_sends').insert({
              campaign_id: campaignId,
              client_id: client.id,
              tenant_id: campaign.tenant_id,
              channel: 'email',
              status: 'failed',
              error_message: sendError.message,
            })
            result.failed++
            result.errors.push(`Email ${client.email}: ${sendError.message}`)
          } else {
            await db.from('campaign_sends').insert({
              campaign_id: campaignId,
              client_id: client.id,
              tenant_id: campaign.tenant_id,
              channel: 'email',
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            result.sent++
          }
        } catch (err: any) {
          await db.from('campaign_sends').insert({
            campaign_id: campaignId,
            client_id: client.id,
            tenant_id: campaign.tenant_id,
            channel: 'email',
            status: 'failed',
            error_message: err.message ?? 'Errore',
          })
          result.failed++
          result.errors.push(`Email ${client.email}: ${err.message ?? 'Errore'}`)
        }
        totalSendsThisRun++
      }

      if (ch === 'whatsapp' && whatsappEnabled) {
        try {
          const waResult = await sendWhatsappMessage({
            to: client.phone!,
            clientName: client.name,
            policyNumber: '',
            policyType: '',
            expiryDate: '',
            agentName,
            agencyName,
            fromNumber: tenant?.notification_email,
            customBody: bodyText,
          })

          if (!waResult.success) {
            await db.from('campaign_sends').insert({
              campaign_id: campaignId,
              client_id: client.id,
              tenant_id: campaign.tenant_id,
              channel: 'whatsapp',
              status: 'failed',
              error_message: waResult.error,
            })
            result.failed++
            result.errors.push(`WhatsApp ${client.phone}: ${waResult.error}`)
          } else {
            await db.from('campaign_sends').insert({
              campaign_id: campaignId,
              client_id: client.id,
              tenant_id: campaign.tenant_id,
              channel: 'whatsapp',
              status: 'sent',
              sent_at: new Date().toISOString(),
            })
            result.sent++
          }
        } catch (err: any) {
          await db.from('campaign_sends').insert({
            campaign_id: campaignId,
            client_id: client.id,
            tenant_id: campaign.tenant_id,
            channel: 'whatsapp',
            status: 'failed',
            error_message: err.message ?? 'Errore',
          })
          result.failed++
          result.errors.push(`WhatsApp ${client.phone}: ${err.message ?? 'Errore'}`)
        }
        totalSendsThisRun++
      }
    }
  }

  // 7. Update campaign stats
  // Get total counts from campaign_sends
  const { data: sendCounts } = await db
    .from('campaign_sends')
    .select('status')
    .eq('campaign_id', campaignId)

  const totalSent = (sendCounts ?? []).filter(s => s.status === 'sent').length
  const totalFailed = (sendCounts ?? []).filter(s => s.status === 'failed').length
  const totalAll = (sendCounts ?? []).length

  // If we hit the limit and there are more clients, keep status as 'sending'
  const allDone = totalSendsThisRun < MAX_SENDS_PER_RUN
  await db.from('campaigns').update({
    status: allDone ? 'sent' : 'sending',
    sent_at: allDone ? new Date().toISOString() : null,
    stats: { sent: totalSent, failed: totalFailed, total: totalAll },
    updated_at: new Date().toISOString(),
  }).eq('id', campaignId)

  return result
}
