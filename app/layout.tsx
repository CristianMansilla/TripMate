import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TripMate · Viajes compartidos',
  description: 'Planificá viajes, itinerarios, gastos y reservas con tu gente.',
  applicationName: 'TripMate',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'TripMate',
    statusBarStyle: 'default',
  },
  icons: {
    icon: '/icon.svg',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#5b4cf0',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
