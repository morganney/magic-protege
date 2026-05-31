import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  webpack: config => {
    config.resolve ??= {}
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
    }

    config.output ??= {}
    config.output.environment = {
      ...(config.output.environment ?? {}),
      asyncFunction: true,
    }

    return config
  },
}

export default nextConfig
