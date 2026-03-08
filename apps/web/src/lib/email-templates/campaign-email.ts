export function campaignEmail(params: {
  body: string
  agentName: string
  agencyName: string
}): string {
  const { body, agentName, agencyName } = params

  const bodyHtml = body
    .split('\n')
    .map(line => `<p style="margin:0 0 8px;color:#374151;font-size:16px;line-height:1.6;">${line || '&nbsp;'}</p>`)
    .join('\n            ')

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
              Questa email &egrave; stata inviata da ${agencyName}.
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
