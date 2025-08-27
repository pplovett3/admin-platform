const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // 临时绕过 ModuleConcatenationPlugin 报错
    if (config.optimization) {
      config.optimization.concatenateModules = false;
    }
    return config;
  }
};
export default nextConfig;
