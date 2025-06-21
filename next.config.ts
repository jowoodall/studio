
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  allowedDevOrigins: [
    'https://6000-firebase-studio-1749143369985.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev',
    'https://9000-firebase-studio-1749143369985.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev'
  ],
};

export default nextConfig;
