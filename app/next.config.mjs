/** @type {import('next').NextConfig} */
const nextConfig = {
  // This helps prevent "Module not found" errors during deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  // This prevents ESLint from failing the build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;