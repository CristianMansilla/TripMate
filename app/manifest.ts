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
        src: '/icons/tripmate-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/tripmate-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/tripmate-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
