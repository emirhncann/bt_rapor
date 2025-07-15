/** @type {import('next').NextConfig} */
const nextConfig = {
  // API route'ları için static export'u kaldır
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  
  // API route'ları için rewrites
  async rewrites() {
    return [
      {
        source: '/api/btrapor/:path*',
        destination: 'https://btrapor.boluteknoloji.tr/:path*',
      }
    ];
  }
}

module.exports = nextConfig 