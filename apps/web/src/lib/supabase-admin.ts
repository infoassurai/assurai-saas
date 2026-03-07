import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

// Server-side client with service role key (bypasses RLS, cross-tenant)
// ONLY import this in server-side code (API routes, server components)
// Lazy initialization to avoid build-time errors when env vars are missing
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY non configurata')
    _client = createClient(url, key)
  }
  return _client
}
