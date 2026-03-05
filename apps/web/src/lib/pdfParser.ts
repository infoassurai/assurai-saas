import * as pdfjsLib from 'pdfjs-dist'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
}

export interface ParsedPolicyData {
  // Dati cliente
  clientName?: string
  clientBirthDate?: string
  clientFiscalCode?: string
  clientEmail?: string
  clientPhone?: string
  clientAddress?: string
  clientProfession?: string
  clientGender?: string
  clientCode?: string

  // Dati polizza
  companyName?: string
  policyNumber?: string
  policyType?: 'auto' | 'home' | 'life' | 'health' | 'other'
  productName?: string
  effectiveDate?: string
  expiryDate?: string
  premiumAmount?: number

  // Testo raw per debug
  rawText?: string
}

// Estrae testo da tutte le pagine del PDF
async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item: any) => item.str)
      .join(' ')
    pages.push(text)
  }

  return pages.join('\n\n')
}

// Estrae dati cliente dal formato Generali (condivisi tra tutte le polizze)
function parseGeneraliClient(text: string): Partial<ParsedPolicyData> {
  const data: Partial<ParsedPolicyData> = {
    companyName: 'Generali Italia',
  }

  // Nome cliente - "NOME COGNOME (DD/MM/YYYY)"
  const nameMatch = text.match(/([A-Z]{2,}(?:\s+[A-Z]{2,})+)\s*\((\d{2}\/\d{2}\/\d{4})\)/)
  if (nameMatch) {
    data.clientName = titleCase(nameMatch[1])
    data.clientBirthDate = nameMatch[2]
  }

  // Codice Fiscale
  const cfMatch = text.match(/Codice\s*Fiscale\s*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])/i)
  if (cfMatch) data.clientFiscalCode = cfMatch[1].toUpperCase()

  // Codice Cliente
  const codClienteMatch = text.match(/Codice\s*Cliente\s*(\d+)/i)
  if (codClienteMatch) data.clientCode = codClienteMatch[1]

  // Sesso
  const sessoMatch = text.match(/Sesso\s*([MF])\b/i)
  if (sessoMatch) data.clientGender = sessoMatch[1].toUpperCase()

  // Professione
  const profMatch = text.match(/Professione\s*([A-ZÀ-Ú\s.]+?)(?=Stato civile|Nazione|$)/i)
  if (profMatch) data.clientProfession = profMatch[1].trim()

  // Email
  const emailMatch = text.match(/E-MAIL\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  if (emailMatch) data.clientEmail = emailMatch[1].toLowerCase()

  // Telefono
  const phoneMatch = text.match(/CELLULARE\s+(?:0039\s*)?(\d[\d\s]{8,})/i)
  if (phoneMatch) data.clientPhone = phoneMatch[1].replace(/\s/g, '')

  // Indirizzo
  const addrMatch = text.match(/(?:RESIDENZA|DOMICILIO)\s+((?:VIA|VIALE|PIAZZA|CORSO|LARGO|STRADA|VICOLO|CONTRADA)[^,]+,\s*\d+[^,]*,\s*[A-ZÀ-Ú\s]+\([A-Z]{2}\)\s*\d{5})/i)
  if (addrMatch) data.clientAddress = titleCase(addrMatch[1])

  return data
}

// Estrae TUTTE le polizze dal formato Generali (strutturate + inline)
function parseGeneraliPolicies(text: string): Array<Partial<ParsedPolicyData>> {
  const policies: Array<Partial<ParsedPolicyData>> = []
  const foundContracts = new Set<string>()

  // Pattern 1: Polizze strutturate con label Prodotto/Num. Contratto/Decorrenza/Scadenza/PA/PU
  const structuredRe = /Prodotto\s+(.+?)\s+Num\.\s*Contratto\s+(\d+)\s+Decorrenza\s+(\d{2}\/\d{2}\/\d{4})\s+Scadenza\s+(\d{2}\/\d{2}\/\d{4}).+?PA\/PU\s+([\d.,]+)\s*€/g
  let m
  while ((m = structuredRe.exec(text))) {
    foundContracts.add(m[2])
    policies.push({
      productName: m[1].trim(),
      policyNumber: m[2],
      effectiveDate: convertDateToISO(m[3]),
      expiryDate: convertDateToISO(m[4]),
      premiumAmount: parseItalianNumber(m[5]),
      policyType: inferPolicyType(m[1].trim(), text, m[2]),
    })
  }

  // Pattern 2: Polizze inline (righe senza label, campi separati da 3+ spazi)
  // Formato: RAMO   PRODOTTO   N_CONTRATTO   DECORRENZA   SCADENZA   DATA_SC   STATO   PREMIO €
  // (?<=\s) evita match falsi su numeri in timestamps (es. 09:56)
  const inlineRe = /(?<=\s)(\d{1,2})\s{3,}(.{3,80}?)\s{3,}(\d{6,})\s{3,}(\d{2}\/\d{2}\/\d{4})\s{3,}(\d{2}\/\d{2}\/\d{4})\s{3,}\d{2}\/\d{2}\/\d{4}\s{3,}[A-Z]\s{3,}([\d.,]+)\s*€/g
  while ((m = inlineRe.exec(text))) {
    if (foundContracts.has(m[3])) continue
    foundContracts.add(m[3])
    policies.push({
      productName: m[2].trim(),
      policyNumber: m[3],
      effectiveDate: convertDateToISO(m[4]),
      expiryDate: convertDateToISO(m[5]),
      premiumAmount: parseItalianNumber(m[6]),
      policyType: inferPolicyType(m[2].trim(), text, m[3]),
    })
  }

  return policies
}

// Determina il tipo polizza dal nome prodotto e dal contesto sezione
function inferPolicyType(productName: string, fullText: string, contractNumber: string): 'auto' | 'home' | 'life' | 'health' | 'other' {
  const prod = productName.toUpperCase()

  // Hints dal nome prodotto
  if (/(?:AUTO|STRADE|GENMAR|RC\s*AUTO|VEICOL|KASKO)/i.test(prod)) return 'auto'
  if (/(?:CASA|ABITAZ|IMMOBIL|CONDOMI)/i.test(prod)) return 'home'
  if (/(?:VITA|LUNGAVITA|FUTURO|PENSION|PREVIDENZ)/i.test(prod)) return 'life'
  if (/(?:SALUT|SANITAR|DENTAL|MEDIC)/i.test(prod)) return 'health'

  // Fallback: contesto sezione nel testo
  const contractPos = fullText.indexOf(contractNumber)
  if (contractPos >= 0) {
    const before = fullText.substring(Math.max(0, contractPos - 500), contractPos)
    const autoIdx = Math.max(
      before.lastIndexOf('Situazione contrattuale  Auto'),
      before.lastIndexOf('Auto  Oggetto')
    )
    const dnaIdx = Math.max(
      before.lastIndexOf('DNA  Oggetto'),
      before.lastIndexOf('Danni No Auto')
    )
    const vitaIdx = Math.max(
      before.lastIndexOf('VITA INDIVIDUALI'),
      before.lastIndexOf('Vita  Oggetto')
    )

    const closest = [
      { type: 'auto' as const, pos: autoIdx },
      { type: 'home' as const, pos: dnaIdx },
      { type: 'life' as const, pos: vitaIdx },
    ].filter(p => p.pos >= 0).sort((a, b) => b.pos - a.pos)

    if (closest.length > 0) return closest[0].type
  }

  return 'other'
}

// Parser generico per PDF non-Generali
function parseGeneric(text: string): Partial<ParsedPolicyData>[] {
  const data: Partial<ParsedPolicyData> = {}

  const nameMatch = text.match(/(?:Nome|Contraente|Intestatario|Cliente)\s*[:\-]?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/i)
  if (nameMatch) data.clientName = nameMatch[1].trim()

  const cfMatch = text.match(/(?:C\.?F\.?|Codice\s*Fiscale)\s*[:\-]?\s*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])/i)
  if (cfMatch) data.clientFiscalCode = cfMatch[1].toUpperCase()

  const emailMatch = text.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
  if (emailMatch) data.clientEmail = emailMatch[1].toLowerCase()

  const phoneMatch = text.match(/(?:Tel|Cell|Telefono|Cellulare)\s*[:\-]?\s*(?:\+?39\s*)?(\d[\d\s]{8,})/i)
  if (phoneMatch) data.clientPhone = phoneMatch[1].replace(/\s/g, '')

  const polMatch = text.match(/(?:Polizza|Contratto|N°?\s*Polizza)\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i)
  if (polMatch) data.policyNumber = polMatch[1]

  const dates = text.match(/(\d{2}\/\d{2}\/\d{4})/g) ?? []
  if (dates.length >= 2) {
    data.effectiveDate = convertDateToISO(dates[0]!)
    data.expiryDate = convertDateToISO(dates[1]!)
  }

  const amountMatch = text.match(/([\d.,]+)\s*€/i)
  if (amountMatch) data.premiumAmount = parseItalianNumber(amountMatch[1])

  return [data]
}

// Rileva se è un PDF Generali
function isGeneraliFormat(text: string): boolean {
  return /Generali\s*Italia/i.test(text) || /Copyright.*Generali/i.test(text)
}

// Entry point principale — ritorna array di polizze (1 per singolo, N per multiplo)
export async function parsePolicyPDF(file: File): Promise<ParsedPolicyData[]> {
  const rawText = await extractText(file)

  if (isGeneraliFormat(rawText)) {
    const client = parseGeneraliClient(rawText)
    const policies = parseGeneraliPolicies(rawText)

    if (policies.length === 0) {
      return [{ ...client, rawText } as ParsedPolicyData]
    }

    return policies.map(pol => ({
      ...client,
      ...pol,
      rawText,
    } as ParsedPolicyData))
  } else {
    const results = parseGeneric(rawText)
    return results.map(r => ({ ...r, rawText } as ParsedPolicyData))
  }
}

// Utility
function titleCase(str: string): string {
  return str.toLowerCase().split(' ').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function convertDateToISO(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/')
  return `${yyyy}-${mm}-${dd}`
}

function parseItalianNumber(str: string): number {
  return parseFloat(str.replace(/\./g, '').replace(',', '.'))
}
