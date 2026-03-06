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

  // Tipo cliente: persona fisica o azienda
  clientType?: 'persona' | 'azienda'
  clientCompanyName?: string  // ragione sociale (azienda)
  clientVatNumber?: string    // P.IVA (azienda)

  // Dati polizza
  companyName?: string
  policyNumber?: string
  policyType?: 'auto' | 'home' | 'life' | 'health' | 'other'
  productName?: string
  plate?: string              // targa veicolo (auto)
  effectiveDate?: string
  expiryDate?: string
  premiumAmount?: number

  // Testo raw per debug
  rawText?: string
}

// ==================== TEXT EXTRACTION ====================

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

// ==================== CLIENT TYPE DETECTION ====================

function detectClientType(data: Partial<ParsedPolicyData>): 'persona' | 'azienda' {
  // Regola: P.IVA compilata → azienda, solo CF → persona, entrambi → azienda
  if (data.clientVatNumber) return 'azienda'
  if (data.clientFiscalCode && /^\d{11}$/.test(data.clientFiscalCode)) return 'azienda'
  if (data.clientCompanyName) return 'azienda'
  const name = data.clientName ?? ''
  if (/\b(?:S\.?R\.?L\.?S?|S\.?P\.?A\.?|S\.?A\.?S\.?|S\.?N\.?C\.?|SOCIETA|DITTA|COOPERATIVA)\b/i.test(name)) return 'azienda'
  return 'persona'
}

// ==================== FORMAT DETECTION ====================

function isGeneraliFormat(text: string): boolean {
  return /Generali\s*Italia/i.test(text) || /Copyright.*Generali/i.test(text)
}

function isAllianzFormat(text: string): boolean {
  return /Allianz/i.test(text) && /Riepilogo\s+situazione\s+cliente/i.test(text)
}

function isAssimediciFormat(text: string): boolean {
  return /Assimedici/i.test(text) && /Dettaglio\s*Anagrafica/i.test(text)
}

// ==================== GENERALI PARSER ====================

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

  // Codice Fiscale (persona: 16 alfanumerico)
  const cfMatch = text.match(/Codice\s*Fiscale\s*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])/i)
  if (cfMatch) data.clientFiscalCode = cfMatch[1].toUpperCase()

  // CF azienda (11 cifre)
  if (!data.clientFiscalCode) {
    const cfAzMatch = text.match(/Codice\s*Fiscale\s*(\d{11})/i)
    if (cfAzMatch) data.clientFiscalCode = cfAzMatch[1]
  }

  // Partita IVA
  const pivaMatch = text.match(/Partita\s*Iva\s*(\d{11})/i)
  if (pivaMatch) data.clientVatNumber = pivaMatch[1]

  // Tipologia Soggetto (usata come fallback, P.IVA ha priorità)
  const tipoMatch = text.match(/Tipologia\s*Soggetto\s*(FISICA|GIURIDICA)/i)
  if (tipoMatch) {
    data.clientType = tipoMatch[1].toUpperCase() === 'FISICA' ? 'persona' : 'azienda'
  }

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

  // Regola uniforme: P.IVA compilata → azienda (override Tipologia Soggetto)
  // Solo CF → persona, entrambi → azienda
  if (data.clientVatNumber) {
    data.clientType = 'azienda'
    if (!data.clientCompanyName && data.clientName) {
      data.clientCompanyName = data.clientName
    }
  } else if (!data.clientType) {
    data.clientType = detectClientType(data)
  }

  return data
}

function parseGeneraliPolicies(text: string): Array<Partial<ParsedPolicyData>> {
  const policies: Array<Partial<ParsedPolicyData>> = []
  const foundContracts = new Set<string>()

  // Pattern 1: Polizze strutturate con label
  const structuredRe = /Prodotto\s+(.+?)\s+Num\.\s*Contratto\s+(\d+)\s+Decorrenza\s+(\d{2}\/\d{2}\/\d{4})\s+Scadenza\s+(\d{2}\/\d{2}\/\d{4}).+?PA\/PU\s+([\d.,]+)\s*€/g
  let m
  while ((m = structuredRe.exec(text))) {
    foundContracts.add(m[2])
    const { plate, cleanName } = extractPlateFromProduct(m[1].trim())
    policies.push({
      productName: cleanName,
      plate,
      policyNumber: m[2],
      effectiveDate: convertDateSlashToISO(m[3]),
      expiryDate: convertDateSlashToISO(m[4]),
      premiumAmount: parseItalianNumber(m[5]),
      policyType: inferGeneraliPolicyType(m[1].trim(), text, m[2]),
    })
  }

  // Pattern 2: Polizze inline (3+ spazi come separatore)
  const inlineRe = /(?<=\s)(\d{1,2})\s{3,}(.{3,80}?)\s{3,}(\d{6,})\s{3,}(\d{2}\/\d{2}\/\d{4})\s{3,}(\d{2}\/\d{2}\/\d{4})\s{3,}\d{2}\/\d{2}\/\d{4}\s{3,}[A-Z]\s{3,}([\d.,]+)\s*€/g
  while ((m = inlineRe.exec(text))) {
    if (foundContracts.has(m[3])) continue
    foundContracts.add(m[3])
    const { plate, cleanName } = extractPlateFromProduct(m[2].trim())
    policies.push({
      productName: cleanName,
      plate,
      policyNumber: m[3],
      effectiveDate: convertDateSlashToISO(m[4]),
      expiryDate: convertDateSlashToISO(m[5]),
      premiumAmount: parseItalianNumber(m[6]),
      policyType: inferGeneraliPolicyType(m[2].trim(), text, m[3]),
    })
  }

  return policies
}

// Estrae targa dal nome prodotto Generali (es. "EJ624BJ - Immagina Strade Nuove" → targa "EJ624BJ")
function extractPlateFromProduct(productName: string): { plate?: string; cleanName: string } {
  // Formato targa italiana: 2 lettere + 3-5 cifre + 0-2 lettere (es. EJ624BJ, HB649BC, DJ05863)
  const plateMatch = productName.match(/^([A-Z]{2}\d{3,5}[A-Z]{0,2})\s*-\s*(.+)$/)
  if (plateMatch) {
    return { plate: plateMatch[1], cleanName: plateMatch[2].trim() }
  }
  return { cleanName: productName }
}

function inferGeneraliPolicyType(productName: string, fullText: string, contractNumber: string): 'auto' | 'home' | 'life' | 'health' | 'other' {
  const prod = productName.toUpperCase()

  if (/(?:AUTO|STRADE|GENMAR|RC\s*AUTO|VEICOL|KASKO)/i.test(prod)) return 'auto'
  if (/(?:CASA|ABITAZ|IMMOBIL|CONDOMI)/i.test(prod)) return 'home'
  if (/(?:VITA|LUNGAVITA|FUTURO|PENSION|PREVIDENZ)/i.test(prod)) return 'life'
  if (/(?:SALUT|SANITAR|DENTAL|MEDIC)/i.test(prod)) return 'health'

  // Fallback: contesto sezione
  const contractPos = fullText.indexOf(contractNumber)
  if (contractPos >= 0) {
    const before = fullText.substring(Math.max(0, contractPos - 500), contractPos)
    const positions = [
      { type: 'auto' as const, pos: Math.max(before.lastIndexOf('Situazione contrattuale  Auto'), before.lastIndexOf('Auto  Oggetto')) },
      { type: 'home' as const, pos: Math.max(before.lastIndexOf('DNA  Oggetto'), before.lastIndexOf('Danni No Auto')) },
      { type: 'life' as const, pos: Math.max(before.lastIndexOf('VITA INDIVIDUALI'), before.lastIndexOf('Vita  Oggetto')) },
    ].filter(p => p.pos >= 0).sort((a, b) => b.pos - a.pos)

    if (positions.length > 0) return positions[0].type
  }

  return 'other'
}

// ==================== ALLIANZ PARSER ====================

function parseAllianzClient(text: string): Partial<ParsedPolicyData> {
  const data: Partial<ParsedPolicyData> = {
    companyName: 'Allianz',
  }

  // Nome cliente / Ragione sociale: tra "Resoconto...cliente" e "Agenzia"
  const nameMatch = text.match(/Resoconto\s+assicurativo\s+del\s+cliente\s+(.+?)\s+Agenzia/i)
  if (nameMatch) {
    const name = normalizeSpaces(nameMatch[1])
    if (/\b(?:S\.?R\.?L\.?S?|S\.?P\.?A\.?|S\.?A\.?S\.?|S\.?N\.?C\.?|SOCIETA|DITTA|COOPERATIVA)\b/i.test(name)) {
      data.clientCompanyName = name
      data.clientType = 'azienda'
    } else {
      data.clientName = name
    }
  }

  // P.IVA + Codice Fiscale (spesso coincidono per aziende)
  const pivaCfMatch = text.match(/P\.?\s*Iva\s*[-–]\s*Cod\.?\s*Fisc[.:]?\s*(\d{11})/i)
  if (pivaCfMatch) {
    data.clientVatNumber = pivaCfMatch[1]
    data.clientFiscalCode = pivaCfMatch[1]
    data.clientType = 'azienda'
  }

  // CF persona (16 caratteri alfanumerici) — fallback se non trovato prima
  if (!data.clientFiscalCode) {
    const cfMatch = text.match(/Cod\.?\s*Fisc[.:]?\s*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])/i)
    if (cfMatch) {
      data.clientFiscalCode = cfMatch[1].toUpperCase()
      if (!data.clientType) data.clientType = 'persona'
    }
  }

  // Email
  const emailMatch = text.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
  if (emailMatch) data.clientEmail = emailMatch[1].toLowerCase()

  // Indirizzo (formato con CAP e provincia)
  const addrMatch = text.match(/((?:VIA|VIALE|PIAZZA|CORSO|LARGO|STRADA)\s+.+?\d+[^,]*,\s*\d{5}\s+[A-ZÀ-Ú\s]+\([A-Z]{2}\))/i)
  if (addrMatch) data.clientAddress = normalizeSpaces(addrMatch[1])

  // Telefono
  const phoneMatch = text.match(/(?:Mobile|Cellulare|Telefono)[:\s]+(?:\+?39\s*)?(\d[\d\s]{8,})/i)
  if (phoneMatch) data.clientPhone = phoneMatch[1].replace(/\s/g, '')

  // Regola uniforme: P.IVA compilata → azienda (override)
  // Solo CF → persona, entrambi → azienda
  if (data.clientVatNumber) {
    data.clientType = 'azienda'
    if (!data.clientCompanyName && data.clientName) {
      data.clientCompanyName = data.clientName
    }
  } else if (!data.clientType) {
    data.clientType = detectClientType(data)
  }

  return data
}

function parseAllianzPolicies(text: string): Array<Partial<ParsedPolicyData>> {
  const policies: Array<Partial<ParsedPolicyData>> = []
  const foundContracts = new Set<string>()

  // Polizze attive: NUM   CONTRATTO   PTF   RAMO   -   PRODOTTO   PREMIO   €   SCADENZA   FRAZ   FONTE   [TARGA]   SDD
  // Il premio ha formato AMOUNT   € (€ DOPO il numero) mentre i Preventivi hanno €   AMOUNT (€ PRIMA)
  const policyRe = /\d+\s{3,}(\d{6,})\s{3,}[A-Z]\s{3,}(\d{3})\s{3,}-\s{3,}(.*?)\s{3,}([\d.,]+)\s{3,}€\s{3,}(\d{2}-\d{2}-\d{4})\s{3,}[A-Z]\s{3,}\d+(?:\s{3,}([A-Z][A-Z0-9]{4,7}))?\s{3,}(?:NO|SI)/g
  let m
  while ((m = policyRe.exec(text))) {
    if (foundContracts.has(m[1])) continue
    foundContracts.add(m[1])
    const productName = normalizeSpaces(m[3])
    policies.push({
      policyNumber: m[1],
      productName,
      plate: m[6] || undefined,
      premiumAmount: parseItalianNumber(m[4]),
      expiryDate: convertDateDashToISO(m[5]),
      policyType: inferAllianzPolicyType(m[2], productName),
    })
  }

  return policies
}

function inferAllianzPolicyType(ramo: string, productName: string): 'auto' | 'home' | 'life' | 'health' | 'other' {
  const prod = productName.toUpperCase()

  // Ramo codes Allianz
  if (ramo === '031' || /\b(?:AUTO|LITHIUM|VEICOL|KASKO|RC\b)/i.test(prod)) return 'auto'
  if (ramo === '042' || /\b(?:SALUT|ULTRA\s*SALUT|SANITARI)/i.test(prod)) return 'health'
  if (/\b(?:CASA|ABITAZ|CONDOMI)/i.test(prod)) return 'home'
  if (/\b(?:VITA|PENSION|RISPARMIO|INVESTIMENT)/i.test(prod)) return 'life'

  return 'other'
}

// ==================== ASSIMEDICI PARSER ====================

function parseAssimediciClient(text: string): Partial<ParsedPolicyData> {
  const data: Partial<ParsedPolicyData> = {
    companyName: 'Assimedici',
  }

  // Codice cliente (es. A202510290036)
  const codeMatch = text.match(/\b(A\d{12,})\b/)
  if (codeMatch) data.clientCode = codeMatch[1]

  // Nome cliente: COGNOME NOME dopo il codice anagrafica (spazi multipli possibili)
  // Testo reale: "A202510290036     MAZZEO GIROLAMO  Indirizzo:"
  const nameMatch = text.match(/A\d{12,}\s+([A-ZÀ-Úa-zà-ú]{2,}(?:\s+[A-ZÀ-Úa-zà-ú]{2,})+?)(?=\s{2,}Indirizzo:|\s{2,}Telefono:|\s{2,}Codice)/i)
  if (nameMatch) data.clientName = titleCase(normalizeSpaces(nameMatch[1]))

  // Indirizzo: prendi solo il primo (quello del cliente, non della sezione Azienda)
  // Testo: "Indirizzo: PALLAVICINO VIA VIVAIO 14  Città: CANTALUPO LIGURE..."
  const addrMatch = text.match(/Indirizzo:\s*([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.,/]+?)(?=\s{2,}Citt[àa]:|Telefono:|$)/i)
  if (addrMatch) {
    const addr = normalizeSpaces(addrMatch[1])
    if (addr && addr.length > 3) data.clientAddress = addr
  }

  // Città con CAP e provincia (primo match = cliente)
  const cityMatch = text.match(/Citt[àa]:\s*([A-ZÀ-Ú\s]+?)\s*-\s*(\d{5})\s*-\s*([A-Z]{2})/i)
  if (cityMatch) {
    const existingAddr = data.clientAddress || ''
    data.clientAddress = existingAddr
      ? `${existingAddr}, ${normalizeSpaces(cityMatch[1])} ${cityMatch[2]} (${cityMatch[3]})`
      : `${normalizeSpaces(cityMatch[1])} ${cityMatch[2]} (${cityMatch[3]})`
  }

  // Cellulare (priorità) o Telefono
  const cellMatch = text.match(/Cellulare:\s*(\d{8,})/i)
  if (cellMatch) {
    data.clientPhone = cellMatch[1]
  } else {
    const telMatch = text.match(/Telefono:\s*(\d{8,})/i)
    if (telMatch) data.clientPhone = telMatch[1]
  }

  // Email: può avere spazi/newline tra "Email:" e l'indirizzo
  // Testo: "Email:  GIROLAMO.MAZZEO@YAHOO.IT"
  const emailMatch = text.match(/Email:\s+([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i)
  if (emailMatch) data.clientEmail = emailMatch[1].toLowerCase()

  // Data di nascita
  const birthMatch = text.match(/Data\s+di\s+nascita:\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (birthMatch) data.clientBirthDate = birthMatch[1]

  // Codice Fiscale (16 caratteri alfanumerici persona)
  const cfMatch = text.match(/Codice\s+Fiscale:\s*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])/i)
  if (cfMatch) data.clientFiscalCode = cfMatch[1].toUpperCase()

  // Partita Iva
  const pivaMatch = text.match(/Partita\s+Iva:\s*(\d{11})/i)
  if (pivaMatch) data.clientVatNumber = pivaMatch[1]

  // Attività / Professione
  const attMatch = text.match(/Attivit[àa]:\s*(.+?)(?=\s{2,}Libero\s+Professionista|\s{2,}Azienda:)/i)
  if (attMatch) {
    const att = normalizeSpaces(attMatch[1])
    if (att) data.clientProfession = att
  }

  // Regola tipo cliente:
  // P.IVA compilata → azienda
  // Solo CF compilato → persona
  // Entrambi compilati → azienda
  if (data.clientVatNumber) {
    data.clientType = 'azienda'
    if (!data.clientCompanyName && data.clientName) {
      data.clientCompanyName = data.clientName
    }
  } else if (data.clientFiscalCode) {
    data.clientType = 'persona'
  } else {
    data.clientType = 'persona'
  }

  return data
}

function parseAssimediciPolicies(text: string): Array<Partial<ParsedPolicyData>> {
  const policies: Array<Partial<ParsedPolicyData>> = []
  const foundContracts = new Set<string>()

  // Pattern dal testo reale:
  // "P202510290048   RC_MED_ABIL_NON_SPEC   30/09/2025   € 894,00"
  // Separatori: spazi multipli (2+)
  const policyRe = /(P\d{12,})\s{2,}(\S+(?:\s\S+)*?)\s{2,}(\d{2}\/\d{2}\/\d{4})\s{2,}€\s*([\d.,]+)/g
  let m
  while ((m = policyRe.exec(text))) {
    if (foundContracts.has(m[1])) continue
    foundContracts.add(m[1])
    const productName = normalizeSpaces(m[2])
    policies.push({
      policyNumber: m[1],
      productName,
      effectiveDate: convertDateSlashToISO(m[3]),
      premiumAmount: parseItalianNumber(m[4]),
      policyType: inferAssimediciPolicyType(productName),
    })
  }

  return policies
}

function inferAssimediciPolicyType(productName: string): 'auto' | 'home' | 'life' | 'health' | 'other' {
  const prod = productName.toUpperCase()

  if (/(?:RC_MED|MEDIC|SANITARI|SALUT|ABIL)/i.test(prod)) return 'health'
  if (/(?:AUTO|VEICOL|KASKO)/i.test(prod)) return 'auto'
  if (/(?:CASA|ABITAZ)/i.test(prod)) return 'home'
  if (/(?:VITA|PENSION)/i.test(prod)) return 'life'

  return 'other'
}

// ==================== GENERIC PARSER ====================

function parseGeneric(text: string): Partial<ParsedPolicyData>[] {
  const data: Partial<ParsedPolicyData> = {}

  const nameMatch = text.match(/(?:Nome|Contraente|Intestatario|Cliente)\s*[:\-]?\s*([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)+)/i)
  if (nameMatch) data.clientName = nameMatch[1].trim()

  const cfMatch = text.match(/(?:C\.?F\.?|Codice\s*Fiscale)\s*[:\-]?\s*([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])/i)
  if (cfMatch) data.clientFiscalCode = cfMatch[1].toUpperCase()

  const pivaMatch = text.match(/(?:P\.?\s*IVA|Partita\s*IVA)\s*[:\-]?\s*(\d{11})/i)
  if (pivaMatch) data.clientVatNumber = pivaMatch[1]

  const emailMatch = text.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i)
  if (emailMatch) data.clientEmail = emailMatch[1].toLowerCase()

  const phoneMatch = text.match(/(?:Tel|Cell|Telefono|Cellulare)\s*[:\-]?\s*(?:\+?39\s*)?(\d[\d\s]{8,})/i)
  if (phoneMatch) data.clientPhone = phoneMatch[1].replace(/\s/g, '')

  const polMatch = text.match(/(?:Polizza|Contratto|N°?\s*Polizza)\s*[:\-]?\s*([A-Z0-9\-\/]{5,})/i)
  if (polMatch) data.policyNumber = polMatch[1]

  const dates = text.match(/(\d{2}\/\d{2}\/\d{4})/g) ?? []
  if (dates.length >= 2) {
    data.effectiveDate = convertDateSlashToISO(dates[0]!)
    data.expiryDate = convertDateSlashToISO(dates[1]!)
  }

  const amountMatch = text.match(/([\d.,]+)\s*€/i)
  if (amountMatch) data.premiumAmount = parseItalianNumber(amountMatch[1])

  // Regola uniforme: P.IVA compilata → azienda, solo CF → persona, entrambi → azienda
  if (data.clientVatNumber) {
    data.clientType = 'azienda'
    if (!data.clientCompanyName && data.clientName) {
      data.clientCompanyName = data.clientName
    }
  } else {
    data.clientType = detectClientType(data)
  }

  return [data]
}

// ==================== ENTRY POINT ====================

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
  }

  if (isAllianzFormat(rawText)) {
    const client = parseAllianzClient(rawText)
    const policies = parseAllianzPolicies(rawText)

    if (policies.length === 0) {
      return [{ ...client, rawText } as ParsedPolicyData]
    }

    return policies.map(pol => ({
      ...client,
      ...pol,
      rawText,
    } as ParsedPolicyData))
  }

  if (isAssimediciFormat(rawText)) {
    const client = parseAssimediciClient(rawText)
    const policies = parseAssimediciPolicies(rawText)

    if (policies.length === 0) {
      return [{ ...client, rawText } as ParsedPolicyData]
    }

    return policies.map(pol => ({
      ...client,
      ...pol,
      rawText,
    } as ParsedPolicyData))
  }

  // Fallback generico
  const results = parseGeneric(rawText)
  return results.map(r => ({ ...r, rawText } as ParsedPolicyData))
}

// ==================== UTILITIES ====================

function titleCase(str: string): string {
  return str.toLowerCase().split(' ').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s{2,}/g, ' ').trim()
}

function convertDateSlashToISO(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/')
  return `${yyyy}-${mm}-${dd}`
}

function convertDateDashToISO(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('-')
  return `${yyyy}-${mm}-${dd}`
}

function parseItalianNumber(str: string): number {
  return parseFloat(str.replace(/\./g, '').replace(',', '.'))
}
