export const NOTIFICATION_STAGES = ['30gg', '15gg', '7gg', 'scaduta'] as const
export type NotificationStage = typeof NOTIFICATION_STAGES[number]

export const STAGE_LABELS: Record<NotificationStage, string> = {
  '30gg': '30 giorni',
  '15gg': '15 giorni',
  '7gg': '7 giorni',
  'scaduta': 'Scaduta',
}

export type NotificationPrefs = Record<NotificationStage, { email: boolean; whatsapp: boolean }>

export const DEFAULT_PREFS: NotificationPrefs = {
  '30gg': { email: true, whatsapp: false },
  '15gg': { email: true, whatsapp: false },
  '7gg': { email: true, whatsapp: false },
  'scaduta': { email: true, whatsapp: false },
}

export const TEMPLATE_PLACEHOLDERS = [
  { key: '{nome_cliente}', desc: 'Nome del cliente' },
  { key: '{numero_polizza}', desc: 'Numero polizza' },
  { key: '{tipo_polizza}', desc: 'Tipo polizza (Auto, Casa, ecc.)' },
  { key: '{data_scadenza}', desc: 'Data di scadenza' },
  { key: '{nome_agente}', desc: 'Nome dell\'agente' },
  { key: '{nome_agenzia}', desc: 'Nome dell\'agenzia' },
]

export const DEFAULT_EMAIL_TEMPLATES: Record<NotificationStage, { subject: string; body: string }> = {
  '30gg': {
    subject: 'Promemoria: La tua polizza {numero_polizza} scade tra 30 giorni',
    body: 'Gentile {nome_cliente},\n\nLe ricordiamo che la Sua polizza {tipo_polizza} n. {numero_polizza} scadrà il {data_scadenza}.\n\nLa invitiamo a contattarci per procedere con il rinnovo e garantire la continuità della Sua copertura assicurativa.\n\nCordiali saluti,\n{nome_agente}\n{nome_agenzia}',
  },
  '15gg': {
    subject: 'Attenzione: La tua polizza {numero_polizza} scade tra 15 giorni',
    body: 'Gentile {nome_cliente},\n\nLa Sua polizza {tipo_polizza} n. {numero_polizza} scadrà tra 15 giorni, il {data_scadenza}.\n\nLa preghiamo di contattarci al più presto per procedere con il rinnovo ed evitare interruzioni nella copertura.\n\nCordiali saluti,\n{nome_agente}\n{nome_agenzia}',
  },
  '7gg': {
    subject: 'Urgente: La tua polizza {numero_polizza} scade tra 7 giorni',
    body: 'Gentile {nome_cliente},\n\nURGENTE: La Sua polizza {tipo_polizza} n. {numero_polizza} scadrà tra soli 7 giorni, il {data_scadenza}.\n\nLa contatti immediatamente per evitare interruzioni nella Sua copertura assicurativa.\n\nCordiali saluti,\n{nome_agente}\n{nome_agenzia}',
  },
  'scaduta': {
    subject: 'La tua polizza {numero_polizza} è scaduta',
    body: 'Gentile {nome_cliente},\n\nLa informiamo che la Sua polizza {tipo_polizza} n. {numero_polizza} è scaduta il {data_scadenza}.\n\nLa preghiamo di contattarci urgentemente per procedere con il rinnovo e ripristinare la Sua copertura assicurativa.\n\nCordiali saluti,\n{nome_agente}\n{nome_agenzia}',
  },
}

export const DEFAULT_WHATSAPP_TEMPLATES: Record<NotificationStage, string> = {
  '30gg': 'Gentile {nome_cliente}, le ricordiamo che la polizza {tipo_polizza} n. {numero_polizza} scadrà il {data_scadenza}. Ci contatti per il rinnovo. - {nome_agente}, {nome_agenzia}',
  '15gg': 'Gentile {nome_cliente}, la polizza {tipo_polizza} n. {numero_polizza} scade tra 15 giorni ({data_scadenza}). La preghiamo di contattarci al più presto. - {nome_agente}, {nome_agenzia}',
  '7gg': 'URGENTE - Gentile {nome_cliente}, la polizza {tipo_polizza} n. {numero_polizza} scade tra 7 giorni ({data_scadenza}). Ci contatti subito per il rinnovo. - {nome_agente}, {nome_agenzia}',
  'scaduta': 'Gentile {nome_cliente}, la polizza {tipo_polizza} n. {numero_polizza} è scaduta il {data_scadenza}. La preghiamo di contattarci urgentemente. - {nome_agente}, {nome_agenzia}',
}

const policyTypeLabels: Record<string, string> = {
  auto: 'Auto/Moto', home: 'Casa', life: 'Vita', health: 'Salute', other: 'Altro',
}

export function replacePlaceholders(template: string, vars: {
  clientName: string
  policyNumber: string
  policyType: string
  expiryDate: string
  agentName: string
  agencyName: string
}): string {
  const typeName = policyTypeLabels[vars.policyType] ?? vars.policyType
  return template
    .replace(/\{nome_cliente\}/g, vars.clientName)
    .replace(/\{numero_polizza\}/g, vars.policyNumber)
    .replace(/\{tipo_polizza\}/g, typeName)
    .replace(/\{data_scadenza\}/g, vars.expiryDate)
    .replace(/\{nome_agente\}/g, vars.agentName)
    .replace(/\{nome_agenzia\}/g, vars.agencyName)
}

// ============================================
// CAMPAIGN PLACEHOLDERS
// ============================================
export const CAMPAIGN_PLACEHOLDERS = [
  { key: '{nome_cliente}', desc: 'Nome del cliente' },
  { key: '{email_cliente}', desc: 'Email del cliente' },
  { key: '{citta}', desc: 'Citta del cliente' },
  { key: '{nome_agente}', desc: "Nome dell'agente" },
  { key: '{nome_agenzia}', desc: "Nome dell'agenzia" },
]

export function replaceCampaignPlaceholders(template: string, vars: {
  clientName: string
  clientEmail?: string
  citta?: string
  agentName: string
  agencyName: string
}): string {
  return template
    .replace(/\{nome_cliente\}/g, vars.clientName)
    .replace(/\{email_cliente\}/g, vars.clientEmail ?? '')
    .replace(/\{citta\}/g, vars.citta ?? '')
    .replace(/\{nome_agente\}/g, vars.agentName)
    .replace(/\{nome_agenzia\}/g, vars.agencyName)
}

// Determina lo stage in base ai giorni rimanenti
export function getStageForDays(daysLeft: number): NotificationStage | null {
  if (daysLeft >= 29 && daysLeft <= 31) return '30gg'
  if (daysLeft >= 14 && daysLeft <= 16) return '15gg'
  if (daysLeft >= 6 && daysLeft <= 8) return '7gg'
  if (daysLeft >= -2 && daysLeft <= 1) return 'scaduta'
  return null
}
