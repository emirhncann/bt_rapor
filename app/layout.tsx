import './globals.css'
import Script from 'next/script'

export const metadata = {
  title: 'btRapor',
  description: 'Raporlamanın En Kolay Yolu',
  icons: {
    icon: '/img/favicon.png',
    shortcut: '/img/favicon.png',
    apple: '/img/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" type="image/png" href="/img/favicon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#991b1b" />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
