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

// Parser per formato Generali Italia
function parseGenerali(text: string): Partial<ParsedPolicyData> {
  const data: Partial<ParsedPolicyData> = {
    companyName: 'Generali Italia',
  }

  // Nome cliente - "NOME COGNOME (DD/MM/YYYY)" nel titolo
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
  const profMatch = text.match(/Professione\s*([A-ZÀ-Ú\s]+?)(?=Stato civile|Nazione|$)/i)
  if (profMatch) data.clientProfession = profMatch[1].trim()

  // Email - prende la prima email trovata
  const emailMatch = text.match(/E-MAIL\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  if (emailMatch) data.clientEmail = emailMatch[1].toLowerCase()

  // Telefono / Cellulare
  const phoneMatch = text.match(/CELLULARE\s+(?:0039\s*)?(\d[\d\s]{8,})/i)
  if (phoneMatch) data.clientPhone = phoneMatch[1].replace(/\s/g, '')

  // Indirizzo - RESIDENZA/DOMICILIO
  const addrMatch = text.match(/(?:RESIDENZA|DOMICILIO)\s+((?:VIA|VIALE|PIAZZA|CORSO|LARGO|STRADA|VICOLO|CONTRADA)[^,]+,\s*\d+[^,]*,\s*[A-ZÀ-Ú\s]+\([A-Z]{2}\)\s*\d{5})/i)
  if (addrMatch) data.clientAddress = titleCase(addrMatch[1])

  // Numero Contratto (polizza)
  const contractMatch = text.match(/Num\.?\s*Contratto\s*(\d+)/i)
  if (contractMatch) data.policyNumber = contractMatch[1]

  // Prodotto
  const productMatch = text.match(/Prodotto\s*([A-Z0-9]+\s*-\s*[^\n]+?)(?=Num|$)/i)
  if (productMatch) data.productName = productMatch[1].trim()

  // Tipo polizza - dalla sezione "Situazione contrattuale"
  const tipoMatch = text.match(/Situazione contrattuale\s+(Auto|Vita|Danni|Salute|Casa)/i)
  if (tipoMatch) {
    const tipo = tipoMatch[1].toLowerCase()
    if (tipo === 'auto') data.policyType = 'auto'
    else if (tipo === 'vita') data.policyType = 'life'
    else if (tipo === 'casa') data.policyType = 'home'
    else if (tipo === 'salute') data.policyType = 'health'
    else data.policyType = 'other'
  }

  // Decorrenza
  const decMatch = text.match(/Decorrenza\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (decMatch) data.effectiveDate = convertDateToISO(decMatch[1])

  // Scadenza
  const scadMatch = text.match(/Scadenza\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (scadMatch) data.expiryDate = convertDateToISO(scadMatch[1])

  // Premio - PA/PU o "Premi" con valore €
  const premioMatch = text.match(/(?:PA\/PU|Premi)\s*([\d.,]+)\s*€/i)
  if (premioMatch) {
    data.premiumAmount = parseItalianNumber(premioMatch[1])
  }

  return data
}

// Parser generico per PDF non-Generali
function parseGeneric(text: string): Partial<ParsedPolicyData> {
  const data: Partial<ParsedPolicyData> = {}

  // Nome - cerca pattern "Nome: XXX" o "Contraente: XXX"
  const nameMatch = text.match(/(?:Nome|Contraente|Intestatario|Cliente)\s*[:\-]?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/i)
  if (nameMatch) data.clientName = nameMatch[1].trim()

  // Codice Fiscale
  const cfMatch = text.match(/(?:C\.?F\.?|Codice\s*Fiscale)\s*[:\-]?\s*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])/i)
  if (cfMatch) data.clientFiscalCode = cfMatch[1].toUpperCase()

  // Email
  const emailMatch = text.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
  if (emailMatch) data.clientEmail = emailMatch[1].toLowerCase()

  // Telefono
  const phoneMatch = text.match(/(?:Tel|Cell|Telefono|Cellulare)\s*[:\-]?\s*(?:\+?39\s*)?(\d[\d\s]{8,})/i)
  if (phoneMatch) data.clientPhone = phoneMatch[1].replace(/\s/g, '')

  // Numero polizza
  const polMatch = text.match(/(?:Polizza|Contratto|N°?\s*Polizza)\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i)
  if (polMatch) data.policyNumber = polMatch[1]

  // Date DD/MM/YYYY
  const dates = text.match(/(\d{2}\/\d{2}\/\d{4})/g) ?? []
  if (dates.length >= 2) {
    // Assume prima data = decorrenza, seconda = scadenza
    data.effectiveDate = convertDateToISO(dates[0]!)
    data.expiryDate = convertDateToISO(dates[1]!)
  }

  // Importo con €
  const amountMatch = text.match(/([\d.,]+)\s*€/i)
  if (amountMatch) data.premiumAmount = parseItalianNumber(amountMatch[1])

  return data
}

// Rileva se è un PDF Generali
function isGeneraliFormat(text: string): boolean {
  return /Generali\s*Italia/i.test(text) || /Copyright.*Generali/i.test(text)
}

// Entry point principale
export async function parsePolicyPDF(file: File): Promise<ParsedPolicyData> {
  const rawText = await extractText(file)

  let parsed: Partial<ParsedPolicyData>
  if (isGeneraliFormat(rawText)) {
    parsed = parseGenerali(rawText)
  } else {
    parsed = parseGeneric(rawText)
  }

  return {
    ...parsed,
    rawText,
  } as ParsedPolicyData
}

// Utility
function titleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

function convertDateToISO(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/')
  return `${yyyy}-${mm}-${dd}`
}

function parseItalianNumber(str: string): number {
  // "1.390,50" → 1390.50
  return parseFloat(str.replace(/\./g, '').replace(',', '.'))
}
