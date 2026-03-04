export const metadata = {
  title: 'ASSURAI - Insurance SaaS',
  description: 'AI-powered platform for insurance agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}
