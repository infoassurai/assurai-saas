import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, full_name, phone, password } = body

    if (!email || !full_name || !password) {
      return NextResponse.json(
        { error: 'Email, nome completo e password sono obbligatori' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La password deve avere almeno 6 caratteri' },
        { status: 400 }
      )
    }

    // Recupera il profilo dell'admin/agente corrente tramite il cookie di sessione
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id, tenant_id, role')
      .eq('id', currentUser.id)
      .single()

    if (!adminProfile || !['admin', 'agent'].includes(adminProfile.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }

    // Usa admin client per creare l'utente
    const admin = getSupabaseAdmin()

    // 1. Crea l'utente auth
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      )
    }

    // 2. Aggiorna il profilo creato dal trigger (handle_new_user)
    //    Il trigger crea automaticamente tenant + profile con role='admin'
    //    Dobbiamo: aggiornare il profilo con i dati corretti e eliminare il tenant auto-creato

    // Recupera il tenant auto-creato dal trigger per eliminarlo dopo
    const { data: autoProfile } = await admin
      .from('profiles')
      .select('tenant_id')
      .eq('id', newUser.user.id)
      .single()
    const autoTenantId = autoProfile?.tenant_id

    // Aggiorna il profilo: assegna al tenant dell'agente principale
    const { data: updatedProfile, error: profileError } = await admin
      .from('profiles')
      .update({
        tenant_id: adminProfile.tenant_id,
        full_name,
        role: 'subagent',
        phone: phone || null,
        parent_agent_id: adminProfile.id,
        is_active: true,
      })
      .eq('id', newUser.user.id)
      .select()
      .single()

    if (profileError) {
      // Rollback: elimina l'utente auth
      await admin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { error: `Errore aggiornamento profilo: ${profileError.message}` },
        { status: 500 }
      )
    }

    // Verifica che l'update abbia funzionato
    if (!updatedProfile || updatedProfile.role !== 'subagent') {
      await admin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { error: `Profilo non aggiornato correttamente. Role: ${updatedProfile?.role}, Tenant: ${updatedProfile?.tenant_id}` },
        { status: 500 }
      )
    }

    // Elimina il tenant auto-creato dal trigger (il subagente usa quello dell'agente)
    if (autoTenantId && autoTenantId !== adminProfile.tenant_id) {
      await admin.from('tenants').delete().eq('id', autoTenantId)
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newUser.user.id,
        email,
        full_name,
        tenant_id: updatedProfile.tenant_id,
        role: updatedProfile.role,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Errore interno' },
      { status: 500 }
    )
  }
}
