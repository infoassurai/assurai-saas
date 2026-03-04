/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@assurai/types', '@assurai/constants'],
}

module.exports = nextConfig
