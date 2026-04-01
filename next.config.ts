/** @type {import('next').NextConfig} */
const nextConfig = {
  // Esto ignora los errores de TypeScript al compilar
  typescript: {
    ignoreBuildErrors: true,
  },
  // Esto ignora las advertencias de código al compilar
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
