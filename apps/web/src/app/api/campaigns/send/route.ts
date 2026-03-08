import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { executeCampaignSend } from '@/lib/campaign-sender'

export async function POST(request: NextRequest) {
  // Auth: session cookie (manuale) oppure Bearer CRON_SECRET (programmato)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader === `Bearer ${cronSecret}` && cronSecret) {
    // Auth via cron secret - OK
  } else {
    // Check session
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }
  }

  let body: { campaign_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (!body.campaign_id) {
    return NextResponse.json({ error: 'campaign_id richiesto' }, { status: 400 })
  }

  try {
    const result = await executeCampaignSend(body.campaign_id)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Errore invio campagna', details: err.message },
      { status: 500 }
    )
  }
}
