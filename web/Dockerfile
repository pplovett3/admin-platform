FROM node:20-alpine
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
# 先安装所有依赖（包括 devDependencies，构建时需要 TypeScript）
# 注意：此时不设置 NODE_ENV=production，确保 devDependencies 被安装
RUN npm ci --legacy-peer-deps

# 验证 TypeScript 已安装
RUN ls -la node_modules/typescript 2>/dev/null && echo "✓ TypeScript installed" || (echo "✗ TypeScript NOT installed, installing..." && npm install --legacy-peer-deps --save-dev typescript@^5 @types/react@^18 @types/node@^20 @types/react-dom@^18 @types/three@^0.179.0)

# 🔥 强制破坏缓存：传入构建时间戳，确保每次都重新复制代码
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"

COPY . .

# 现在设置生产环境变量
ENV NODE_ENV=production

# 验证关键文件是否存在（调试用）
RUN echo "=== 检查文件结构 ===" && \
    ls -la app/ | head -20 && \
    echo "=== 检查 _utils 目录 ===" && \
    ls -la app/_utils/ && \
    echo "=== 检查 _lib 目录 ===" && \
    ls -la app/_lib/ && \
    echo "=== 检查 tsconfig.json ===" && \
    cat tsconfig.json

# 接受构建参数并设置为环境变量
# 默认为空，让前端使用相对路径（通过 Nginx 反向代理）
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# 确保 node_modules/.bin 有执行权限（防止从 Windows 上传导致的权限问题）
RUN chmod -R +x node_modules/.bin 2>/dev/null || true

# 确保 app 目录下的文件有正确的权限
RUN chmod -R 644 app/**/*.ts app/**/*.tsx 2>/dev/null || true

# 清理可能存在的旧构建缓存，确保使用最新代码
RUN rm -rf .next 2>/dev/null || true

# 运行构建
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"] 