import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Strip X-Powered-By header (minor security + latency)
  poweredByHeader: false,

  // Compress responses with gzip (already on in Vercel, but explicit)
  compress: true,

  // Dedupe requests across concurrent renders
  experimental: {
    // Dedupes identical fetch() calls within the same render pass
    staleTimes: {
      dynamic: 30,   // cache dynamic routes in client router for 30s
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
