FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# 接受构建参数并设置为环境变量
# 默认为空，让前端使用相对路径（通过 Nginx 反向代理）
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

EXPOSE 3000
CMD ["npm", "start"] 