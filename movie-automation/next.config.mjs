/** @type {import('next').NextConfig} */
const nextConfig = {
  // Увеличиваем лимит размера тела для стриминга видео
  experimental: {
    serverComponentsExternalPackages: ['fs', 'path'],
    outputFileTracingIncludes: {
      '/**': ['shared-data/**/*'],
    },
  },
};

export default nextConfig; 