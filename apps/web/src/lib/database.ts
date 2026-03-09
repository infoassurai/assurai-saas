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
export async function updateTenant(tenantId: string, updates: { name?: string; notification_email?: string; notification_whatsapp?: string; notification_cron_hour?: number; notification_prefs?: Record<string, { email: boolean; whatsapp: boolean }> }) {
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
    .select('*, insurance_companies(name), documents(id, file_path, file_name), profiles:agent_id(full_name, role)')
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
  campaign_code?: string
}) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  let { data, error } = await supabase
    .from('policies')
    .insert({ ...policy, tenant_id: profile.tenant_id, agent_id: profile.id })
    .select()
    .single()

  // Fallback: se client_type o campaign_code non nella schema cache, riprova senza
  if (error && (error.message?.includes('client_type') || error.message?.includes('campaign_code'))) {
    const { client_type, campaign_code, ...policyClean } = policy
    const retry = await supabase
      .from('policies')
      .insert({ ...policyClean, tenant_id: profile.tenant_id, agent_id: profile.id })
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

  // Cerca piano provvigionale specifico per compagnia + tipo (piano agente principale)
  let mainRate = 10 // default fallback
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
      mainRate = Number(plan.percentage)
      planFound = true
    }
  }

  // Fallback: localStorage o default 10%
  if (!planFound) {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('assurai_commission_pct') : null
    if (stored) mainRate = parseFloat(stored)
  }

  // Controlla se il creatore è un subagente
  const { data: creatorProfile } = await supabase
    .from('profiles')
    .select('role, parent_agent_id')
    .eq('id', agentId)
    .single()

  if (creatorProfile?.role === 'subagent' && creatorProfile.parent_agent_id) {
    // --- SPLIT COMMISSIONE: subagente + override ---
    const subRate = await getSubAgentRate(supabase, tenantId, agentId, companyId, policyType, mainRate)

    const subAmount = (premiumAmount * subRate) / 100
    const overrideRate = mainRate - subRate
    const overrideAmount = (premiumAmount * overrideRate) / 100

    // Commissione subagente
    const { data: subComm } = await supabase.from('commissions').insert({
      tenant_id: tenantId,
      policy_id: policyId,
      agent_id: agentId,
      amount: subAmount,
      percentage: subRate,
      type: 'initial',
      status: 'pending',
      commission_role: 'subagent',
    }).select().single()

    // Commissione override per agente principale
    await supabase.from('commissions').insert({
      tenant_id: tenantId,
      policy_id: policyId,
      agent_id: creatorProfile.parent_agent_id,
      amount: overrideAmount,
      percentage: overrideRate,
      type: 'initial',
      status: 'pending',
      commission_role: 'override',
      parent_commission_id: subComm?.id ?? null,
    })
  } else {
    // --- COMMISSIONE STANDARD (agente normale) ---
    const amount = (premiumAmount * mainRate) / 100

    await supabase.from('commissions').insert({
      tenant_id: tenantId,
      policy_id: policyId,
      agent_id: agentId,
      amount,
      percentage: mainRate,
      type: 'initial',
      status: 'pending',
      commission_role: 'agent',
    })
  }

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
        message: `Non è stato definito un piano provvigionale per ${companyName} (${typeName}). È stata applicata la commissione default del ${mainRate}%.`,
        due_date: new Date().toISOString().split('T')[0],
        channel: 'in_app',
      })
    }
  }
}

// Helper: cerca la percentuale subagente con priorità specifico > compagnia > globale > fallback
async function getSubAgentRate(supabase: any, tenantId: string, subAgentId: string, companyId?: string, policyType?: string, mainRate = 10): Promise<number> {
  // 1. Specifico: (subagente, compagnia, tipo)
  if (companyId && policyType) {
    const { data } = await supabase
      .from('sub_agent_commission_plans')
      .select('percentage')
      .eq('tenant_id', tenantId)
      .eq('sub_agent_id', subAgentId)
      .eq('company_id', companyId)
      .eq('policy_type', policyType)
      .single()
    if (data) return Number(data.percentage)
  }

  // 2. Per compagnia: (subagente, compagnia, NULL)
  if (companyId) {
    const { data } = await supabase
      .from('sub_agent_commission_plans')
      .select('percentage')
      .eq('tenant_id', tenantId)
      .eq('sub_agent_id', subAgentId)
      .eq('company_id', companyId)
      .is('policy_type', null)
      .single()
    if (data) return Number(data.percentage)
  }

  // 3. Globale: (subagente, NULL, NULL)
  const { data } = await supabase
    .from('sub_agent_commission_plans')
    .select('percentage')
    .eq('tenant_id', tenantId)
    .eq('sub_agent_id', subAgentId)
    .is('company_id', null)
    .is('policy_type', null)
    .single()
  if (data) return Number(data.percentage)

  // 4. Fallback: 50% della rata dell'agente principale
  return mainRate * 0.5
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

const EXPIRY_STAGES = [
  { days: 30, label: '30gg' },
  { days: 15, label: '15gg' },
  { days: 7, label: '7gg' },
  { days: 1, label: '1gg' },
  { days: 0, label: 'scaduta' },
]

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

export async function getExpiryAlerts(showDismissed = false) {
  const supabase = createClient()
  let query = supabase
    .from('alerts')
    .select('*, policies(policy_number, client_name)')
    .eq('type', 'expiry')
    .order('due_date', { ascending: true })

  if (!showDismissed) query = query.eq('is_dismissed', false)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getOtherAlerts(showDismissed = false) {
  const supabase = createClient()
  let query = supabase
    .from('alerts')
    .select('*, policies(policy_number, client_name)')
    .neq('type', 'expiry')
    .order('due_date', { ascending: true })

  if (!showDismissed) query = query.eq('is_dismissed', false)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getNotificationStatus(policyIds: string[]) {
  if (policyIds.length === 0) return { email: new Set<string>(), whatsapp: new Set<string>() }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('alerts')
    .select('policy_id, channel')
    .eq('type', 'expiry')
    .in('channel', ['email', 'whatsapp'])
    .in('policy_id', policyIds)
    .not('sent_at', 'is', null)
  if (error) throw error
  const email = new Set<string>()
  const whatsapp = new Set<string>()
  for (const a of data ?? []) {
    if (a.channel === 'email') email.add(a.policy_id)
    if (a.channel === 'whatsapp') whatsapp.add(a.policy_id)
  }
  return { email, whatsapp }
}

export async function getUnreadExpiryCount() {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('type', 'expiry')
    .eq('is_read', false)
    .eq('is_dismissed', false)
  if (error) throw error
  return count ?? 0
}

export async function getUnreadOtherAlertCount() {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .neq('type', 'expiry')
    .eq('is_read', false)
    .eq('is_dismissed', false)
  if (error) throw error
  return count ?? 0
}

export async function markAllExpiryAlertsRead() {
  const supabase = createClient()
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('type', 'expiry')
    .eq('is_read', false)
    .eq('is_dismissed', false)
  if (error) throw error
}

export async function markAllOtherAlertsRead() {
  const supabase = createClient()
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .neq('type', 'expiry')
    .eq('is_read', false)
    .eq('is_dismissed', false)
  if (error) throw error
}

export async function generateExpiryAlerts() {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) return

  const today = new Date()

  // Scadenza entro 30gg oppure scadute da max 7gg
  const in30Days = new Date()
  in30Days.setDate(today.getDate() + 30)
  const expired7DaysAgo = new Date()
  expired7DaysAgo.setDate(today.getDate() - 7)

  const { data: policies } = await supabase
    .from('policies')
    .select('id, policy_number, client_name, expiry_date')
    .eq('status', 'active')
    .gte('expiry_date', expired7DaysAgo.toISOString().split('T')[0])
    .lte('expiry_date', in30Days.toISOString().split('T')[0])

  if (!policies || policies.length === 0) return 0

  // Alert esistenti per queste polizze (tipo expiry)
  const policyIds = policies.map(p => p.id)
  const { data: existingAlerts } = await supabase
    .from('alerts')
    .select('policy_id, title')
    .eq('type', 'expiry')
    .in('policy_id', policyIds)

  const existingKeys = new Set(
    (existingAlerts ?? []).map(a => `${a.policy_id}_${a.title}`)
  )

  const newAlerts: Array<{
    tenant_id: string
    policy_id: string
    type: string
    title: string
    message: string
    due_date: string
    channel: string
  }> = []

  for (const p of policies) {
    const daysLeft = Math.ceil(
      (new Date(p.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Determina lo stage corretto
    const stage = EXPIRY_STAGES.find(s => daysLeft <= s.days) ?? EXPIRY_STAGES[0]
    const title = `[${stage.label}] Polizza ${p.policy_number} ${stage.label === 'scaduta' ? 'scaduta' : 'in scadenza'}`
    const key = `${p.id}_${title}`

    if (existingKeys.has(key)) continue

    const message = daysLeft <= 0
      ? `La polizza di ${p.client_name} è scaduta il ${new Date(p.expiry_date).toLocaleDateString('it-IT')}`
      : `La polizza di ${p.client_name} scade tra ${daysLeft} giorni (${new Date(p.expiry_date).toLocaleDateString('it-IT')})`

    newAlerts.push({
      tenant_id: profile.tenant_id,
      policy_id: p.id,
      type: 'expiry',
      title,
      message,
      due_date: p.expiry_date,
      channel: 'in_app',
    })
  }

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
  if (daysLeft > 30 || daysLeft < -7) return // Entro 30gg o scadute da max 7gg

  const stage = EXPIRY_STAGES.find(s => daysLeft <= s.days) ?? EXPIRY_STAGES[0]
  const title = `[${stage.label}] Polizza ${policyNumber} ${stage.label === 'scaduta' ? 'scaduta' : 'in scadenza'}`

  const message = daysLeft <= 0
    ? `La polizza di ${clientName} è scaduta il ${new Date(expiryDate).toLocaleDateString('it-IT')}`
    : `La polizza di ${clientName} scade tra ${daysLeft} giorni (${new Date(expiryDate).toLocaleDateString('it-IT')})`

  await supabase.from('alerts').insert({
    tenant_id: profile.tenant_id,
    policy_id: policyId,
    type: 'expiry',
    title,
    message,
    due_date: expiryDate,
    channel: 'in_app',
  })
}

export async function getUnreadAlertCount() {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('alerts')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
    .eq('is_dismissed', false)
  if (error) throw error
  return count ?? 0
}

export async function markAllAlertsRead() {
  const supabase = createClient()
  const { error } = await supabase
    .from('alerts')
    .update({ is_read: true })
    .eq('is_read', false)
    .eq('is_dismissed', false)
  if (error) throw error
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
// NOTIFICATION TEMPLATES
// ============================================
export async function getNotificationTemplates() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notification_templates')
    .select('*')
    .order('stage')
  if (error) throw error
  return data ?? []
}

export async function upsertNotificationTemplate(template: {
  tenant_id: string
  stage: string
  channel: string
  subject: string | null
  body: string
}) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('notification_templates')
    .upsert(
      { ...template, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id,stage,channel' }
    )
    .select()
    .single()
  if (error) throw error
  return data
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

export async function cloneDocumentForPolicy(originalDocId: string, policyId: string) {
  const supabase = createClient()
  const { data: original, error: fetchError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', originalDocId)
    .single()
  if (fetchError || !original) throw fetchError || new Error('Documento non trovato')

  const { data, error } = await supabase
    .from('documents')
    .insert({
      tenant_id: original.tenant_id,
      policy_id: policyId,
      file_name: original.file_name,
      file_path: original.file_path,
      file_size: original.file_size,
      mime_type: original.mime_type,
      uploaded_by: original.uploaded_by,
    })
    .select()
    .single()
  if (error) throw error
  return data
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

  const [activePolicies, expiringPolicies, monthCommissions, totalDocuments, allActivePolicies, newPoliciesMonth] = await Promise.all([
    supabase.from('policies').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('policies').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('expiry_date', today).lte('expiry_date', in30Days),
    supabase.from('commissions').select('amount').gte('created_at', monthStart),
    supabase.from('documents').select('id', { count: 'exact', head: true }),
    supabase.from('policies').select('premium_amount, client_type, client_fiscal_code').eq('status', 'active'),
    supabase.from('policies').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
  ])

  const commissionTotal = (monthCommissions.data ?? []).reduce((sum, c) => sum + Number(c.amount), 0)

  const activePoliciesData = allActivePolicies.data ?? []
  const totalPremium = activePoliciesData.reduce((sum, p) => sum + Number(p.premium_amount || 0), 0)
  const avgPremium = activePoliciesData.length > 0 ? totalPremium / activePoliciesData.length : 0

  let clientiPersona = 0
  let clientiAzienda = 0
  for (const p of activePoliciesData) {
    const ct = p.client_type || (p.client_fiscal_code && /^\d{11}$/.test(p.client_fiscal_code) ? 'azienda' : 'persona')
    if (ct === 'azienda') clientiAzienda++
    else clientiPersona++
  }

  return {
    activePolicies: activePolicies.count ?? 0,
    expiringPolicies: expiringPolicies.count ?? 0,
    monthCommissions: commissionTotal,
    totalDocuments: totalDocuments.count ?? 0,
    totalPremium,
    avgPremium,
    clientiPersona,
    clientiAzienda,
    newPoliciesMonth: newPoliciesMonth.count ?? 0,
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
  if (!query || query.length < 2) return { policies: [], commissions: [], clients: [], campaigns: [] }
  const supabase = createClient()

  const [policiesRes, commissionsRes, clientsRes, campaignsRes] = await Promise.all([
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
    supabase
      .from('clients')
      .select('id, name, email, fiscal_code, client_type')
      .or(`name.ilike.%${query}%,email.ilike.%${query}%,fiscal_code.ilike.%${query}%`)
      .limit(5),
    supabase
      .from('campaigns')
      .select('id, name, status')
      .ilike('name', `%${query}%`)
      .limit(5),
  ])

  return {
    policies: policiesRes.data ?? [],
    commissions: (commissionsRes.data ?? []).filter((c: any) => c.policies),
    clients: clientsRes.data ?? [],
    campaigns: campaignsRes.data ?? [],
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
// CLIENTS
// ============================================
export async function getClients(filters?: {
  search?: string
  citta?: string
  cap?: string
  client_type?: string
}) {
  const supabase = createClient()
  let query = supabase
    .from('clients')
    .select('*')
    .order('name')

  if (filters?.client_type) query = query.eq('client_type', filters.client_type)
  if (filters?.citta) query = query.ilike('citta', `%${filters.citta}%`)
  if (filters?.cap) query = query.eq('cap', filters.cap)
  if (filters?.search) query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,fiscal_code.ilike.%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function getClient(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*, policies(id, policy_number, policy_type, status, expiry_date, premium_amount)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createClientRecord(client: {
  name: string
  email?: string
  phone?: string
  fiscal_code?: string
  client_type?: string
  data_nascita?: string
  sesso?: string
  professione?: string
  citta?: string
  cap?: string
  indirizzo?: string
  provincia?: string
  notes?: string
}) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const { data, error } = await supabase
    .from('clients')
    .insert({ ...client, tenant_id: profile.tenant_id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateClient(id: string, updates: Record<string, unknown>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteClient(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function getPortfolioByCompany() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .select('company_id, premium_amount, insurance_companies(name)')
    .eq('status', 'active')
  if (error) throw error

  const map: Record<string, { company_name: string; company_id: string | null; count: number; totalPremium: number }> = {}
  for (const p of data ?? []) {
    const key = p.company_id || '__none__'
    const companyName = (p as any).insurance_companies?.name || 'Senza compagnia'
    if (!map[key]) map[key] = { company_name: companyName, company_id: p.company_id, count: 0, totalPremium: 0 }
    map[key].count++
    map[key].totalPremium += p.premium_amount || 0
  }
  return Object.values(map).sort((a, b) => b.totalPremium - a.totalPremium)
}

export async function getDistinctProfessioni() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('professione')
    .not('professione', 'is', null)
    .neq('professione', '')
  if (error) throw error
  const unique = [...new Set((data ?? []).map(c => c.professione).filter(Boolean))]
  unique.sort((a, b) => a!.localeCompare(b!))
  return unique as string[]
}

// ============================================
// CAMPAIGNS
// ============================================
export async function getCampaigns() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getCampaign(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

function generateCampaignCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `CAMP-${random}`
}

export async function createCampaign(campaign: {
  name: string
  channel: string
  subject?: string
  body: string
  filters?: Record<string, unknown>
  scheduled_at?: string
  status?: string
}) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const status = campaign.scheduled_at ? 'scheduled' : (campaign.status ?? 'draft')
  const code = generateCampaignCode()
  let { data, error } = await supabase
    .from('campaigns')
    .insert({
      ...campaign,
      code,
      status,
      tenant_id: profile.tenant_id,
      created_by: profile.id,
    })
    .select()
    .single()

  // Fallback: se colonna code non ancora nello schema cache, riprova senza
  if (error && error.message?.includes('code')) {
    const retry = await supabase
      .from('campaigns')
      .insert({
        ...campaign,
        status,
        tenant_id: profile.tenant_id,
        created_by: profile.id,
      })
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) throw error
  return data
}

export async function updateCampaign(id: string, updates: Record<string, unknown>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaigns')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCampaign(id: string) {
  const supabase = createClient()
  // Solo draft
  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('status', 'draft')
  if (error) throw error
}

export async function getCampaignSends(campaignId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('campaign_sends')
    .select('*, clients(name, email, phone)')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getCampaignPerformance(campaignCode: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .select('id, policy_number, client_name, policy_type, premium_amount, created_at')
    .eq('campaign_code', campaignCode)
    .order('created_at', { ascending: false })
  if (error) return { count: 0, totalPremium: 0, policies: [] }

  const policies = data ?? []
  const totalPremium = policies.reduce((sum, p) => sum + Number(p.premium_amount || 0), 0)

  return {
    count: policies.length,
    totalPremium,
    policies,
  }
}

export async function getCampaignsWithPerformance() {
  const supabase = createClient()
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error

  const codes = (campaigns ?? []).map((c: any) => c.code).filter(Boolean)
  if (codes.length === 0) return (campaigns ?? []).map(c => ({ ...c, policy_count: 0 }))

  let countMap: Record<string, number> = {}
  try {
    const { data: policyCounts } = await supabase
      .from('policies')
      .select('campaign_code')
      .in('campaign_code', codes)

    for (const p of policyCounts ?? []) {
      if (p.campaign_code) {
        countMap[p.campaign_code] = (countMap[p.campaign_code] || 0) + 1
      }
    }
  } catch {
    // campaign_code column may not exist yet
  }

  return (campaigns ?? []).map(c => ({
    ...c,
    policy_count: c.code ? (countMap[c.code] || 0) : 0,
  }))
}

export async function previewCampaignAudience(filters: Record<string, any>, channel: string) {
  const supabase = createClient()

  let query = supabase
    .from('clients')
    .select('id, name, email, phone, citta')

  if (filters.client_type) query = query.eq('client_type', filters.client_type)
  if (filters.citta) query = query.ilike('citta', `%${filters.citta}%`)
  if (filters.cap) query = query.eq('cap', filters.cap)
  if (filters.professione) {
    if (Array.isArray(filters.professione) && filters.professione.length > 0) {
      query = query.in('professione', filters.professione)
    } else if (typeof filters.professione === 'string') {
      query = query.ilike('professione', `%${filters.professione}%`)
    }
  }
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

  const { data: allClients, error } = await query
  if (error) throw error

  let clients = allClients ?? []

  // Policy-level filters
  const hasPolicyFilters = filters.policy_type || filters.company_id || filters.status ||
    filters.premio_min || filters.premio_max || filters.scadenza_entro_giorni

  if (hasPolicyFilters && clients.length > 0) {
    const clientIds = clients.map(c => c.id)
    let policyQuery = supabase
      .from('policies')
      .select('client_id')
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
    clients = clients.filter(c => policyClientIds.has(c.id))
  }

  // Filter by channel availability
  clients = clients.filter(c => {
    if (channel === 'email') return !!c.email
    if (channel === 'whatsapp') return !!c.phone
    return !!c.email || !!c.phone
  })

  return {
    count: clients.length,
    sample: clients.slice(0, 10),
  }
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

// ============================================
// SUB-AGENTS (Subagenti)
// ============================================

export async function getSubAgents() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'subagent')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSubAgentById(id: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('role', 'subagent')
    .single()
  if (error) throw error
  return data
}

export async function updateSubAgent(id: string, updates: { full_name?: string; phone?: string; is_active?: boolean }) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .eq('role', 'subagent')
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deactivateSubAgent(id: string) {
  return updateSubAgent(id, { is_active: false })
}

// ============================================
// SUB-AGENT COMMISSION PLANS
// ============================================

export async function getSubAgentCommissionPlans(subAgentId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sub_agent_commission_plans')
    .select('*, insurance_companies(name)')
    .eq('sub_agent_id', subAgentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function upsertSubAgentCommissionPlan(
  subAgentId: string,
  companyId: string | null,
  policyType: string | null,
  percentage: number
) {
  const supabase = createClient()
  const profile = await getProfile()
  if (!profile) throw new Error('Profilo non trovato')

  const { data, error } = await supabase
    .from('sub_agent_commission_plans')
    .upsert(
      {
        tenant_id: profile.tenant_id,
        sub_agent_id: subAgentId,
        company_id: companyId,
        policy_type: policyType,
        percentage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,sub_agent_id,company_id,policy_type' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSubAgentCommissionPlan(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('sub_agent_commission_plans').delete().eq('id', id)
  if (error) throw error
}

// ============================================
// DASHBOARD STATS - Sub-agents
// ============================================

export async function getSubAgentStats() {
  const supabase = createClient()

  // Subagenti attivi
  const { count: activeSubAgents } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'subagent')
    .eq('is_active', true)

  // Override del mese corrente
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: overrideData } = await supabase
    .from('commissions')
    .select('amount')
    .eq('commission_role', 'override')
    .gte('created_at', startOfMonth.toISOString())

  const overrideMonth = (overrideData ?? []).reduce((sum, c) => sum + Number(c.amount), 0)

  return {
    activeSubAgents: activeSubAgents ?? 0,
    overrideMonth,
  }
}

export async function getSubAgentPerformance() {
  const supabase = createClient()

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Subagenti attivi
  const { data: subAgents } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'subagent')
    .eq('is_active', true)

  if (!subAgents || subAgents.length === 0) return []

  const result = []
  for (const sa of subAgents) {
    // Polizze del mese
    const { data: policies } = await supabase
      .from('policies')
      .select('id, premium_amount')
      .eq('agent_id', sa.id)
      .gte('created_at', startOfMonth.toISOString())

    const policiesCount = policies?.length ?? 0
    const premiumTotal = (policies ?? []).reduce((sum, p) => sum + Number(p.premium_amount), 0)

    // Commissioni del mese (solo subagent role)
    const { data: comms } = await supabase
      .from('commissions')
      .select('amount')
      .eq('agent_id', sa.id)
      .eq('commission_role', 'subagent')
      .gte('created_at', startOfMonth.toISOString())

    const commissionsTotal = (comms ?? []).reduce((sum, c) => sum + Number(c.amount), 0)

    result.push({
      id: sa.id,
      name: sa.full_name,
      policiesMonth: policiesCount,
      premiumMonth: premiumTotal,
      commissionsMonth: commissionsTotal,
    })
  }

  return result
}

export async function getSubAgentPolicies(subAgentId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('policies')
    .select('*, insurance_companies(name)')
    .eq('agent_id', subAgentId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getSubAgentCommissions(subAgentId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('commissions')
    .select('*, policies(policy_number, client_name)')
    .eq('agent_id', subAgentId)
    .eq('commission_role', 'subagent')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPolicyCommissionBreakdown(policyId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('commissions')
    .select('*, profiles:agent_id(full_name, role)')
    .eq('policy_id', policyId)
    .order('commission_role')
  if (error) throw error
  return data ?? []
}
