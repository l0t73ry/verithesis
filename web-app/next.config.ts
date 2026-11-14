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
  outputFileTracingIncludes: {
    '/api/thesis/capabilities': ['../enclave-worker/wasm/verithesis-wasi.wasm', './public/verithesis-wasi.wasm'],
    '/api/thesis/rerun': ['../enclave-worker/wasm/verithesis-wasi.wasm', './public/verithesis-wasi.wasm'],
    '/api/thesis/verify': ['../enclave-worker/wasm/verithesis-wasi.wasm', './public/verithesis-wasi.wasm'],
  },
};

export default nextConfig;
