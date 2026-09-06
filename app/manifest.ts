import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TripMate',
    short_name: 'TripMate',
    description: 'Planificá viajes, itinerarios, gastos y reservas con tu gente.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f7f8fb',
    theme_color: '#5b4cf0',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
