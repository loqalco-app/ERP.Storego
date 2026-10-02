import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Strip X-Powered-By header (minor security + latency)
  poweredByHeader: false,

  // Compress responses with gzip (already on in Vercel, but explicit)
  compress: true,

  // Dedupe requests across concurrent renders
  experimental: {
    // dynamic: 0 — nunca reusar datos viejos del router al navegar entre
    // rutas dinámicas (ej. cambiar de periodo en Finanzas); un panel de
    // administración interno necesita datos frescos más que este ahorro.
    staleTimes: {
      dynamic: 0,
      static: 180,   // cache static routes for 3 min
    },
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },
}

export default nextConfig
