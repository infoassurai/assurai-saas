const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886' // Twilio sandbox default

export function isWhatsappConfigured(): boolean {
  return !!(TWILIO_SID && TWILIO_TOKEN)
}

export async function sendWhatsappMessage(params: {
  to: string
  clientName: string
  policyNumber: string
  policyType: string
  expiryDate: string
  agentName: string
  agencyName: string
  fromNumber?: string
  customBody?: string
}): Promise<{ success: boolean; error?: string }> {
  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return { success: false, error: 'Twilio non configurato' }
  }

  const { to, clientName, policyNumber, policyType, expiryDate, agentName, agencyName, fromNumber, customBody } = params

  const policyTypeLabels: Record<string, string> = {
    auto: 'Auto/Moto', home: 'Casa', life: 'Vita', health: 'Salute', other: 'Altro',
  }
  const typeName = policyTypeLabels[policyType] ?? policyType

  const body = customBody ?? [
    `Gentile ${clientName},`,
    '',
    `Le ricordiamo che la Sua polizza ${typeName} n. ${policyNumber} scade il ${expiryDate}.`,
    '',
    `La invitiamo a contattarci per procedere con il rinnovo.`,
    '',
    `Cordiali saluti,`,
    `${agentName} - ${agencyName}`,
  ].join('\n')

  // Normalizza numero: rimuovi spazi, aggiungi + se mancante
  const cleanTo = to.replace(/\s/g, '').replace(/^(?!\+)/, '+')
  const from = fromNumber
    ? `whatsapp:${fromNumber.replace(/\s/g, '').replace(/^(?!\+)/, '+')}`
    : TWILIO_WHATSAPP_FROM

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
  const authHeader = 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: from,
        To: `whatsapp:${cleanTo}`,
        Body: body,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      return { success: false, error: err.message ?? `HTTP ${res.status}` }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Errore sconosciuto' }
  }
}
