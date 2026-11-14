import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@verithesis/enclave-worker',
    'antd',
    '@ant-design/icons',
    '@ant-design/nextjs-registry',
  ],
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },
};

export default nextConfig;
