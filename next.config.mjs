/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["mongoose", "pdf-parse"],
  },
  eslint: {
    // ESLint v10 + eslint-config-next v16 is incompatible with Next.js 14
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
