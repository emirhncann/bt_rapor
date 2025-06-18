/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/sql',
        destination: 'http://localhost:45678/sql',
      },
    ]
  },
}

module.exports = nextConfig 