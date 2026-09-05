import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TripMate · Viajes compartidos',
  description: 'Planificá viajes, itinerarios, gastos y reservas con tu gente.'
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
