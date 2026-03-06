import { createClient } from './supabase'

// ============================================
// PROFILE
// ============================================
export async function getProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*, tenants(*)')
    .eq('id', user.id)
    .single()
  return data
}

export async function updateProfile(updates: { full_name?: string; phone?: string }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// TENANT
// ============================================
export async function updateTenant(tenantId: string, updates: { name?: string }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', tenantId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// POLICIES
// ============================================
export async function getPolicies(filters?: {
  status?: string
  policyType?: string
  clientType?: string
  search?: string
}) {
  const supabase = createClient()
  let query = supabase
    .from('policies')
    .select('*, insurance_companies(name), documents(id, file_path, file_name)')
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.policyType) query = query.eq('policy_type', filters.policyType)
  if (filters?.clientType) query = query.eq('client_type', filters.clientType)
  if (filters?.search) query = query.or(`client_name.ilike.%${filters.search}%,policy_number.ilike.%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getPolicy(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .select('*, insurance_companies(name)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function checkDuplicatePolicy(policyNumber: string, companyId?: string) {
  const supabase = createClient()
  let query = supabase
    .from('policies')
    .select('id, policy_number, client_name, status, insurance_companies(name)')
    .eq('policy_number', policyNumber)

  if (companyId) query = query.eq('company_id', companyId)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createPolicy(policy: {
  policy_number: string
  policy_type: string
  client_name: string
  client_email?: string
  client_phone?: string
  client_fiscal_code?: string
  client_type?: 'persona' | 'azienda'
  premium_amount: number
  effective_date: string
  expiry_date: string
  company_id?: string
  status?: string
  notes?: string
}) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  let { data, error } = await supabase
    .from('policies')
    .insert({ ...policy, tenant_id: profile.tenant_id, agent_id: profile.id })
    .select()
    .single()

  // Fallback: se client_type non è nella schema cache, riprova senza
  if (error && error.message?.includes('client_type')) {
    const { client_type, ...policyWithoutClientType } = policy
    const retry = await supabase
      .from('policies')
      .insert({ ...policyWithoutClientType, tenant_id: profile.tenant_id, agent_id: profile.id })
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) throw error

  if (data) {
    // Genera alert scadenza se entro 30gg
    createAlertForPolicy(data.id, data.policy_number, data.client_name, data.expiry_date).catch(() => {})
    // Genera commissione automatica (usa piano provvigionale se disponibile)
    autoCreateCommission(data.id, data.premium_amount, profile.tenant_id, profile.id, data.company_id, data.policy_type).catch(() => {})
  }

  return data
}

async function autoCreateCommission(policyId: string, premiumAmount: number, tenantId: string, agentId: string, companyId?: string, policyType?: string) {
  const supabase = createClient()

  // Cerca piano provvigionale specifico per compagnia + tipo
  let percentage = 10 // default fallback
  let planFound = false

  if (companyId && policyType) {
    const { data: plan } = await supabase
      .from('commission_plans')
      .select('percentage')
      .eq('tenant_id', tenantId)
      .eq('company_id', companyId)
      .eq('policy_type', policyType)
      .single()

    if (plan) {
      percentage = Number(plan.percentage)
      planFound = true
    }
  }

  // Fallback: localStorage o default 10%
  if (!planFound) {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('assurai_commission_pct') : null
    if (stored) percentage = parseFloat(stored)
  }

  const amount = (premiumAmount * percentage) / 100

  await supabase.from('commissions').insert({
    tenant_id: tenantId,
    policy_id: policyId,
    agent_id: agentId,
    amount,
    percentage,
    type: 'initial',
    status: 'pending',
  })

  // Se nessun piano trovato, genera alert
  if (!planFound && companyId) {
    const { data: company } = await supabase
      .from('insurance_companies')
      .select('name')
      .eq('id', companyId)
      .single()

    const typeLabels: Record<string, string> = { auto: 'Auto', home: 'Casa', life: 'Vita', health: 'Salute', other: 'Altro' }
    const typeName = typeLabels[policyType ?? ''] ?? policyType
    const companyName = company?.name ?? 'Sconosciuta'

    // Controlla se alert già esiste per questa combinazione
    const { data: existing } = await supabase
      .from('alerts')
      .select('id')
      .eq('type', 'missing_plan')
      .eq('is_dismissed', false)
      .ilike('title', `%${companyName}%${typeName}%`)
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('alerts').insert({
        tenant_id: tenantId,
        type: 'missing_plan',
        title: `Piano provvigionale mancante: ${companyName} - ${typeName}`,
        message: `Non è stato definito un piano provvigionale per ${companyName} (${typeName}). È stata applicata la commissione default del ${percentage}%.`,
        due_date: new Date().toISOString().split('T')[0],
        channel: 'in_app',
      })
    }
  }
}

export async function updatePolicy(id: string, updates: Record<string, unknown>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePolicy(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('policies').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// INSURANCE COMPANIES
// ============================================
export async function getInsuranceCompanies() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('insurance_companies')
    .select('*')
    .eq('is_active', true)
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function createInsuranceCompany(company: { name: string; code?: string; contact_email?: string; contact_phone?: string }) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const { data, error } = await supabase
    .from('insurance_companies')
    .insert({ ...company, tenant_id: profile.tenant_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteInsuranceCompany(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('insurance_companies').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// COMMISSION PLANS (Piani Provvigionali)
// ============================================
export async function getCommissionPlans() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('commission_plans')
    .select('*, insurance_companies(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertCommissionPlan(companyId: string, policyType: string, percentage: number) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const { data, error } = await supabase
    .from('commission_plans')
    .upsert(
      {
        tenant_id: profile.tenant_id,
        company_id: companyId,
        policy_type: policyType,
        percentage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,company_id,policy_type' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCommissionPlan(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('commission_plans').delete().eq('id', id)
  if (error) throw error
}

export async function applyRetroactiveCommissions(companyId: string, policyType: string, newPercentage: number) {
  const supabase = createClient()

  // Trova tutte le polizze con questa combinazione
  const { data: policies } = await supabase
    .from('policies')
    .select('id, premium_amount')
    .eq('company_id', companyId)
    .eq('policy_type', policyType)

  if (!policies || policies.length === 0) return 0

  const policyIds = policies.map(p => p.id)

  // Trova commissioni pending per queste polizze
  const { data: pendingCommissions } = await supabase
    .from('commissions')
    .select('id, policy_id')
    .eq('status', 'pending')
    .in('policy_id', policyIds)

  if (!pendingCommissions || pendingCommissions.length === 0) return 0

  // Aggiorna ogni commissione con la nuova %
  let updated = 0
  for (const comm of pendingCommissions) {
    const policy = policies.find(p => p.id === comm.policy_id)
    if (!policy) continue
    const newAmount = (Number(policy.premium_amount) * newPercentage) / 100
    const { error } = await supabase
      .from('commissions')
      .update({ amount: newAmount, percentage: newPercentage, updated_at: new Date().toISOString() })
      .eq('id', comm.id)
    if (!error) updated++
  }

  return updated
}

export async function getMissingCommissionPlans() {
  const supabase = createClient()

  // Combinazioni attive dalle polizze (con compagnia)
  const { data: activeCombinations } = await supabase
    .from('policies')
    .select('company_id, policy_type, insurance_companies(name)')
    .not('company_id', 'is', null)
    .eq('status', 'active')

  if (!activeCombinations || activeCombinations.length === 0) return []

  // Deduplica combinazioni
  const seen = new Set<string>()
  const unique = activeCombinations.filter(p => {
    const key = `${p.company_id}_${p.policy_type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Piani esistenti
  const { data: plans } = await supabase
    .from('commission_plans')
    .select('company_id, policy_type')

  const planKeys = new Set((plans ?? []).map(p => `${p.company_id}_${p.policy_type}`))

  // Combinazioni mancanti
  return unique
    .filter(p => !planKeys.has(`${p.company_id}_${p.policy_type}`))
    .map(p => ({
      company_id: p.company_id,
      policy_type: p.policy_type,
      company_name: (p.insurance_companies as any)?.name ?? 'Sconosciuta',
    }))
}

// ============================================
// COMMISSIONS
// ============================================
export async function getCommissions(filters?: { status?: string }) {
  const supabase = createClient()
  let query = supabase
    .from('commissions')
    .select('*, policies(policy_number, client_name)')
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createCommission(commission: {
  policy_id: string
  amount: number
  percentage?: number
  type?: string
}) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const { data, error } = await supabase
    .from('commissions')
    .insert({ ...commission, tenant_id: profile.tenant_id, agent_id: profile.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCommission(id: string, updates: Record<string, unknown>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('commissions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// ALERTS
// ============================================
export async function getAlerts(showDismissed = false) {
  const supabase = createClient()
  let query = supabase
    .from('alerts')
    .select('*, policies(policy_number, client_name)')
    .order('due_date', { ascending: true })

  if (!showDismissed) query = query.eq('is_dismissed', false)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function generateExpiryAlerts() {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) return

  const today = new Date()
  const in30Days = new Date()
  in30Days.setDate(today.getDate() + 30)

  // Polizze in scadenza entro 30gg
  const { data: expiringPolicies } = await supabase
    .from('policies')
    .select('id, policy_number, client_name, expiry_date')
    .eq('status', 'active')
    .gte('expiry_date', today.toISOString().split('T')[0])
    .lte('expiry_date', in30Days.toISOString().split('T')[0])

  if (!expiringPolicies || expiringPolicies.length === 0) return

  // Alert già esistenti per queste polizze
  const policyIds = expiringPolicies.map(p => p.id)
  const { data: existingAlerts } = await supabase
    .from('alerts')
    .select('policy_id')
    .eq('type', 'expiry')
    .in('policy_id', policyIds)

  const existingPolicyIds = new Set((existingAlerts ?? []).map(a => a.policy_id))

  // Crea alert solo per polizze che non hanno già un alert scadenza
  const newAlerts = expiringPolicies
    .filter(p => !existingPolicyIds.has(p.id))
    .map(p => {
      const daysLeft = Math.ceil((new Date(p.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return {
        tenant_id: profile.tenant_id,
        policy_id: p.id,
        type: 'expiry' as const,
        title: `Polizza ${p.policy_number} in scadenza`,
        message: `La polizza di ${p.client_name} scade tra ${daysLeft} giorni (${new Date(p.expiry_date).toLocaleDateString('it-IT')})`,
        due_date: p.expiry_date,
        channel: 'in_app' as const,
      }
    })

  if (newAlerts.length > 0) {
    await supabase.from('alerts').insert(newAlerts)
  }

  return newAlerts.length
}

export async function createAlertForPolicy(policyId: string, policyNumber: string, clientName: string, expiryDate: string) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) return

  const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (daysLeft > 30 || daysLeft < 0) return // Solo se scade entro 30gg

  await supabase.from('alerts').insert({
    tenant_id: profile.tenant_id,
    policy_id: policyId,
    type: 'expiry',
    title: `Polizza ${policyNumber} in scadenza`,
    message: `La polizza di ${clientName} scade tra ${daysLeft} giorni (${new Date(expiryDate).toLocaleDateString('it-IT')})`,
    due_date: expiryDate,
    channel: 'in_app',
  })
}

export async function markAlertRead(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('alerts').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

export async function dismissAlert(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('alerts').update({ is_dismissed: true }).eq('id', id)
  if (error) throw error
}

// ============================================
// DOCUMENTS
// ============================================
export async function getDocuments() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*, policies(policy_number, client_name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export function getDocumentUrl(filePath: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from('documents').getPublicUrl(filePath)
  return data.publicUrl
}

export async function getDocumentSignedUrl(filePath: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600) // 1 ora
  if (error) throw error
  return data.signedUrl
}

export async function linkDocumentToPolicy(documentId: string, policyId: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('documents')
    .update({ policy_id: policyId })
    .eq('id', documentId)
  if (error) throw error
}

export async function uploadDocument(file: File, policyId?: string) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const filePath = `${profile.tenant_id}/${Date.now()}_${file.name}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file)
  if (uploadError) throw uploadError

  const { data, error } = await supabase
    .from('documents')
    .insert({
      tenant_id: profile.tenant_id,
      policy_id: policyId || null,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: profile.id,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================
// DASHBOARD STATS
// ============================================
export async function getDashboardStats() {
  const supabase = createClient()

  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
  const today = new Date().toISOString().split('T')[0]
  const in30Days = thirtyDaysFromNow.toISOString().split('T')[0]
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [activePolicies, expiringPolicies, monthCommissions, totalDocuments] = await Promise.all([
    supabase.from('policies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('policies').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('expiry_date', today).lte('expiry_date', in30Days),
    supabase.from('commissions').select('amount').gte('created_at', monthStart),
    supabase.from('documents').select('id', { count: 'exact', head: true }),
  ])

  const commissionTotal = (monthCommissions.data ?? []).reduce((sum, c) => sum + Number(c.amount), 0)

  return {
    activePolicies: activePolicies.count ?? 0,
    expiringPolicies: expiringPolicies.count ?? 0,
    monthCommissions: commissionTotal,
    totalDocuments: totalDocuments.count ?? 0,
  }
}

export async function getRecentPolicies() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .select('id, policy_number, client_name, policy_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)
  if (error) throw error
  return data ?? []
}

export async function getPolicyTypeDistribution() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .select('policy_type')
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const p of data ?? []) {
    counts[p.policy_type] = (counts[p.policy_type] || 0) + 1
  }
  return Object.entries(counts).map(([type, count]) => ({ type, count }))
}

export async function getMonthlyCommissions() {
  const supabase = createClient()
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)

  const { data, error } = await supabase
    .from('commissions')
    .select('amount, created_at')
    .gte('created_at', sixMonthsAgo.toISOString())
  if (error) throw error

  const months: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months[key] = 0
  }

  for (const c of data ?? []) {
    const d = new Date(c.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (key in months) months[key] += Number(c.amount)
  }

  return Object.entries(months).map(([month, total]) => ({ month, total }))
}

export async function globalSearch(query: string) {
  if (!query || query.length < 2) return { policies: [], commissions: [] }
  const supabase = createClient()

  const [policiesRes, commissionsRes] = await Promise.all([
    supabase
      .from('policies')
      .select('id, policy_number, client_name, status, policy_type')
      .or(`client_name.ilike.%${query}%,policy_number.ilike.%${query}%`)
      .limit(5),
    supabase
      .from('commissions')
      .select('id, amount, status, policies(policy_number, client_name)')
      .or(`policies.client_name.ilike.%${query}%,policies.policy_number.ilike.%${query}%`)
      .limit(5),
  ])

  return {
    policies: policiesRes.data ?? [],
    commissions: (commissionsRes.data ?? []).filter((c: any) => c.policies),
  }
}

export async function getPolicyStatusDistribution() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .select('status')
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const p of data ?? []) {
    counts[p.status] = (counts[p.status] || 0) + 1
  }
  return Object.entries(counts).map(([status, count]) => ({ status, count }))
}

// ============================================
// TODOS
// ============================================
export async function getTodos() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createTodo(text: string) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const { data, error } = await supabase
    .from('todos')
    .insert({ tenant_id: profile.tenant_id, text })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTodo(id: string, updates: { text?: string; is_done?: boolean }) {
  const supabase = createClient()
  const { error } = await supabase.from('todos').update(updates).eq('id', id)
  if (error) throw error
}

export async function deleteTodo(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('todos').delete().eq('id', id)
  if (error) throw error
}
