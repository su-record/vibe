/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: false,
  generateEtags: false,
  poweredByHeader: false,
  experimental: {
    appDir: true
  }
}

module.exports = nextConfig