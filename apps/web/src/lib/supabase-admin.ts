import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side client with service role key (bypasses RLS, cross-tenant)
// ONLY import this in server-side code (API routes, server components)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
