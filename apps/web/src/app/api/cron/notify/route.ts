import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { expiryNotificationEmail } from '@/lib/email-templates/expiry-notification'

const MAX_EMAILS_PER_RUN = 95

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL
  if (!resendKey || !fromEmail) {
    return NextResponse.json({ error: 'Configurazione email mancante (RESEND_API_KEY o RESEND_FROM_EMAIL)' }, { status: 500 })
  }

  const resend = new Resend(resendKey)

  const today = new Date()
  const from29 = new Date(today)
  from29.setDate(today.getDate() + 29)
  const to31 = new Date(today)
  to31.setDate(today.getDate() + 31)

  // Query polizze attive in scadenza tra 29-31 giorni con email cliente
  const { data: policies, error: policiesError } = await getSupabaseAdmin()
    .from('policies')
    .select('id, policy_number, policy_type, client_name, client_email, expiry_date, tenant_id, agent_id')
    .eq('status', 'active')
    .gte('expiry_date', from29.toISOString().split('T')[0])
    .lte('expiry_date', to31.toISOString().split('T')[0])
    .not('client_email', 'is', null)
    .neq('client_email', '')

  if (policiesError) {
    return NextResponse.json({ error: 'Errore query polizze', details: policiesError.message }, { status: 500 })
  }

  if (!policies || policies.length === 0) {
    return NextResponse.json({ success: true, processed: 0, sent: 0, skipped: 0, errors: [] })
  }

  // Deduplicazione: cerca alert email già inviati per queste polizze
  const policyIds = policies.map(p => p.id)
  const { data: existingAlerts } = await getSupabaseAdmin()
    .from('alerts')
    .select('policy_id')
    .eq('type', 'expiry')
    .eq('channel', 'email')
    .in('policy_id', policyIds)
    .ilike('title', '[30gg]%')

  const alreadySent = new Set((existingAlerts ?? []).map(a => a.policy_id))
  const toNotify = policies.filter(p => !alreadySent.has(p.id))

  // Fetch tenant e agent info per le polizze da notificare
  const tenantIds = [...new Set(toNotify.map(p => p.tenant_id))]
  const agentIds = [...new Set(toNotify.map(p => p.agent_id).filter(Boolean))]

  const [tenantsRes, agentsRes] = await Promise.all([
    tenantIds.length > 0
      ? getSupabaseAdmin().from('tenants').select('id, name').in('id', tenantIds)
      : Promise.resolve({ data: [] }),
    agentIds.length > 0
      ? getSupabaseAdmin().from('profiles').select('id, full_name').in('id', agentIds)
      : Promise.resolve({ data: [] }),
  ])

  const tenantMap = new Map((tenantsRes.data ?? []).map(t => [t.id, t.name ?? 'Agenzia']))
  const agentMap = new Map((agentsRes.data ?? []).map(a => [a.id, a.full_name ?? 'Il tuo agente']))

  const results = { sent: 0, skipped: alreadySent.size, errors: [] as string[] }

  for (const policy of toNotify) {
    if (results.sent >= MAX_EMAILS_PER_RUN) {
      results.errors.push(`Limite giornaliero raggiunto (${MAX_EMAILS_PER_RUN}). Polizze rimanenti inviate domani.`)
      break
    }

    const expiryFormatted = new Date(policy.expiry_date).toLocaleDateString('it-IT')
    const agencyName = tenantMap.get(policy.tenant_id) ?? 'Agenzia'
    const agentName = policy.agent_id ? (agentMap.get(policy.agent_id) ?? 'Il tuo agente') : 'Il tuo agente'

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
        results.errors.push(`${policy.client_email}: ${sendError.message}`)
        continue
      }

      // Inserisci alert con channel email e sent_at
      await getSupabaseAdmin().from('alerts').insert({
        tenant_id: policy.tenant_id,
        policy_id: policy.id,
        type: 'expiry',
        title: `[30gg] Polizza ${policy.policy_number} in scadenza`,
        message: `Email inviata a ${policy.client_email} - La polizza di ${policy.client_name} scade il ${expiryFormatted}`,
        due_date: policy.expiry_date,
        channel: 'email',
        sent_at: new Date().toISOString(),
      })

      results.sent++
    } catch (err: any) {
      results.errors.push(`${policy.client_email}: ${err.message ?? 'Errore sconosciuto'}`)
    }
  }

  return NextResponse.json({
    success: true,
    processed: policies.length,
    sent: results.sent,
    skipped: results.skipped,
    errors: results.errors,
  })
}
