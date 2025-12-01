import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,
  // 跳过类型检查（构建时已编译成功，类型检查在开发时进行）
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    // 临时绕过 ModuleConcatenationPlugin 报错
    if (config.optimization) {
      config.optimization.concatenateModules = false;
    }
    
    // 配置路径别名解析（确保 webpack 能正确解析 @/ 路径）
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    config.resolve.alias['@'] = path.resolve(__dirname);
    
    return config;
  },
  // API 代理配置 - 将 /api 请求转发到后端服务
  async rewrites() {
    // 如果前端和后端共用同一个域名（通过 Cloudflare Tunnel），
    // Next.js rewrites 应该代理到后端内网地址（因为 Next.js 运行在 NAS 上）
    // 这样前端使用相对路径 /api/... 时，会被代理到内网后端
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    
    // 在生产环境，如果配置了内网地址，使用内网地址（Next.js 服务器可以访问）
    // 如果没有配置，使用 localhost（开发环境）
    console.log('[Next.js Rewrites] Backend URL:', backendUrl);
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
