/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production build için static export
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  
  // Development için rewrites (CORS problemini çözer)
  async rewrites() {
    // Sadece development ortamında rewrites kullan
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/btrapor/:path*',
          destination: 'https://btrapor.boluteknoloji.tr/:path*',
        }
      ];
    }
    return [];
  }
}

module.exports = nextConfig 