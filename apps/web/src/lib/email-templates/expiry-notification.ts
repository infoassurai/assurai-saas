const policyTypeLabels: Record<string, string> = {
  auto: 'Auto/Moto',
  home: 'Casa',
  life: 'Vita',
  health: 'Salute',
  other: 'Altro',
}

export function expiryNotificationEmail(params: {
  clientName: string
  policyNumber: string
  policyType: string
  expiryDate: string
  agentName: string
  agencyName: string
  customBody?: string
  customSubject?: string
}): string {
  const { clientName, policyNumber, policyType, expiryDate, agentName, agencyName, customBody } = params
  const typeName = policyTypeLabels[policyType] ?? policyType

  // Se c'è un corpo personalizzato, usalo. Altrimenti usa il default.
  const bodyHtml = customBody
    ? customBody.split('\n').map(line => `<p style="margin:0 0 8px;color:#374151;font-size:16px;line-height:1.6;">${line || '&nbsp;'}</p>`).join('\n            ')
    : `<p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
              Gentile <strong>${clientName}</strong>,
            </p>
            <p style="margin:0 0 16px;color:#374151;font-size:16px;line-height:1.6;">
              Le ricordiamo che la Sua polizza <strong>${typeName}</strong> n. <strong>${policyNumber}</strong>
              scadr&agrave; il <strong>${expiryDate}</strong>.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:16px;line-height:1.6;">
              La invitiamo a contattarci per procedere con il rinnovo e garantire la continuit&agrave;
              della Sua copertura assicurativa.
            </p>`

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background-color:#1e3a5f;padding:24px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${agencyName}</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${bodyHtml}
            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
              <tr>
                <td style="background-color:#1e3a5f;border-radius:8px;padding:12px 28px;">
                  <a href="mailto:" style="color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">
                    Contattaci per il rinnovo
                  </a>
                </td>
              </tr>
            </table>
            <!-- Separator -->
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
            <p style="margin:0;color:#6b7280;font-size:14px;line-height:1.5;">
              Cordiali saluti,<br/>
              <strong>${agentName}</strong><br/>
              ${agencyName}
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;text-align:center;">
              Questa email &egrave; stata inviata automaticamente dal sistema di gestione polizze.
              Se ritiene di aver ricevuto questa email per errore, la preghiamo di contattare il Suo agente.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
