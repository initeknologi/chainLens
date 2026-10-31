import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  distDir: '.next-web3',
  transpilePackages: ['@chainlens/shared-types', '@chainlens/ui'],
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
