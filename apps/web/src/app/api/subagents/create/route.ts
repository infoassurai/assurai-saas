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

    // 2. Crea il profilo subagente
    const { error: profileError } = await admin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        tenant_id: adminProfile.tenant_id,
        full_name,
        role: 'subagent',
        phone: phone || null,
        parent_agent_id: adminProfile.id,
        is_active: true,
      })

    if (profileError) {
      // Rollback: elimina l'utente auth
      await admin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { error: `Errore creazione profilo: ${profileError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: newUser.user.id,
        email,
        full_name,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Errore interno' },
      { status: 500 }
    )
  }
}
