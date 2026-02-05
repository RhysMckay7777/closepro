import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude browser-only APIs from server bundles
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      };
      
      // Provide empty polyfills for browser APIs that might be imported
      config.resolve.alias = {
        ...config.resolve.alias,
      };
    }
    
    // Ignore browser-specific modules in server builds
    config.externals = config.externals || [];
    if (isServer) {
      config.externals.push({
        'canvas': 'commonjs canvas',
      });
    }
    
    return config;
  },
};

export default nextConfig;
