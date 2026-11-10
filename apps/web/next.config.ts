import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@finsig/ui'],
  async redirects() {
    return [{ source: '/demo/studio', destination: '/app/studio', permanent: false }];
  },
};

export default nextConfig;
