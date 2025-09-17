const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // 临时绕过 ModuleConcatenationPlugin 报错
    if (config.optimization) {
      config.optimization.concatenateModules = false;
    }
    return config;
  },
  // API 代理配置 - 将 /api 请求转发到后端服务
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};
export default nextConfig;
