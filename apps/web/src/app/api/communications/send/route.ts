import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { campaignEmail } from '@/lib/email-templates/campaign-email'
import { sendWhatsappMessage, isWhatsappConfigured } from '@/lib/whatsapp'

export async function POST(request: NextRequest) {
  // Auth via session cookie
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  let body: { clientId: string; channel: 'email' | 'whatsapp' | 'both'; subject?: string; body: string; attachments?: { file_name: string; file_path: string }[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  const { clientId, channel, subject, body: messageBody, attachments = [] } = body
  if (!clientId || !channel || !messageBody) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // Fetch client + tenant
  const { data: client } = await db
    .from('clients')
    .select('id, name, email, phone, tenant_id, do_not_contact')
    .eq('id', clientId)
    .single()

  if (!client) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 })
  if (client.do_not_contact) return NextResponse.json({ error: 'Cliente non contattabile' }, { status: 422 })

  const { data: tenant } = await db
    .from('tenants')
    .select('name, notification_email')
    .eq('id', client.tenant_id)
    .single()

  const { data: profile } = await db
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const agencyName = tenant?.name ?? 'Agenzia'
  const agentName = profile?.full_name ?? 'Il tuo agente'

  // Download attachments (email only)
  const emailAttachments: { filename: string; content: Buffer }[] = []
  if ((channel === 'email' || channel === 'both') && attachments.length > 0) {
    for (const att of attachments) {
      const { data: attData } = await db.storage.from('documents').download(att.file_path)
      if (attData) emailAttachments.push({ filename: att.file_name, content: Buffer.from(await attData.arrayBuffer()) })
    }
  }

  let emailSuccess = false
  let waSuccess = false
  let emailError: string | undefined
  let waError: string | undefined

  // Send email
  if ((channel === 'email' || channel === 'both') && client.email) {
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
    const defaultFrom = process.env.RESEND_FROM_EMAIL
    if (resend && defaultFrom) {
      const fromEmail = tenant?.notification_email
        ? `${agencyName} <${tenant.notification_email}>`
        : defaultFrom
      const html = campaignEmail({ body: messageBody, agentName, agencyName })
      try {
        const { error: sendError } = await resend.emails.send({
          from: fromEmail,
          to: client.email,
          subject: subject || `Comunicazione da ${agencyName}`,
          html,
          ...(emailAttachments.length > 0 ? { attachments: emailAttachments } : {}),
        } as any)
        if (sendError) emailError = sendError.message
        else emailSuccess = true
      } catch (err: any) {
        emailError = err.message
      }
    } else {
      emailError = 'Resend non configurato'
    }
  } else if (channel === 'email' || channel === 'both') {
    emailError = 'Nessuna email per questo cliente'
  }

  // Send WhatsApp
  if ((channel === 'whatsapp' || channel === 'both') && client.phone) {
    if (isWhatsappConfigured()) {
      const waResult = await sendWhatsappMessage({
        to: client.phone,
        clientName: client.name,
        policyNumber: '',
        policyType: '',
        expiryDate: '',
        agentName,
        agencyName,
        customBody: messageBody,
      })
      if (waResult.success) waSuccess = true
      else waError = waResult.error
    } else {
      waError = 'WhatsApp non configurato'
    }
  } else if (channel === 'whatsapp' || channel === 'both') {
    waError = 'Nessun telefono per questo cliente'
  }

  // Determine status
  let status: 'sent' | 'failed' | 'partial' = 'sent'
  if (channel === 'email' && !emailSuccess) status = 'failed'
  else if (channel === 'whatsapp' && !waSuccess) status = 'failed'
  else if (channel === 'both' && !emailSuccess && !waSuccess) status = 'failed'
  else if (channel === 'both' && (!emailSuccess || !waSuccess)) status = 'partial'

  const errorMessage = [emailError, waError].filter(Boolean).join('; ') || null

  // Save record
  await db.from('client_communications').insert({
    tenant_id: client.tenant_id,
    client_id: clientId,
    channel,
    subject: subject || null,
    body: messageBody,
    sent_by: user.id,
    status,
    attachments,
    error_message: errorMessage,
  })

  return NextResponse.json({ success: status !== 'failed', status, error: errorMessage })
}
