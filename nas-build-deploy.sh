#!/bin/bash

echo "=========================================="
echo "在 NAS 上构建并部署 Admin Platform"
echo "=========================================="

cd /volume1/docker/admin-platform

# 1. 创建目录
echo ""
echo "步骤 1/6: 创建目录结构..."
mkdir -p mongodb storage
echo "✓ 目录创建成功"

# 2. 构建 server 镜像
echo ""
echo "步骤 2/6: 构建 server 镜像（这可能需要10-15分钟）..."
cd server
docker build -t admin-platform-server:latest .
if [ $? -ne 0 ]; then
    echo "✗ Server 镜像构建失败"
    exit 1
fi
echo "✓ Server 镜像构建成功"

# 3. 构建 web 镜像
echo ""
echo "步骤 3/6: 构建 web 镜像（这可能需要15-20分钟）..."
cd ../web
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://192.168.0.239:4000 \
  -t admin-platform-web:latest .
if [ $? -ne 0 ]; then
    echo "✗ Web 镜像构建失败"
    exit 1
fi
echo "✓ Web 镜像构建成功"

# 4. 创建 docker-compose.yml
echo ""
echo "步骤 4/6: 创建 docker-compose.yml..."
cd /volume1/docker/admin-platform
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  mongo:
    image: mongo:6.0
    container_name: admin-platform-mongo
    restart: unless-stopped
    platform: linux/arm64
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=AdminPlatform2024
    volumes:
      - ./mongodb:/data/db
    networks:
      - admin-platform-network

  server:
    image: admin-platform-server:latest
    container_name: admin-platform-server
    restart: unless-stopped
    depends_on:
      - mongo
    environment:
      - NODE_ENV=production
      - PORT=4000
      - MONGODB_URI=mongodb://admin:AdminPlatform2024@mongo:27017/admin-platform?authSource=admin
      - JWT_SECRET=Kj8mP2nQ9vL5xR7wT3AdminPlatform2024Secret
      - STORAGE_ROOT=/storage
      - DEEPSEEK_API_KEY=sk-a5cc44206c5d411cbb633cd73a6c8bd0
      - METASO_API_KEY=mk-53C55DF41C6C448FD0BA54190CDA2A2F
      - MINIMAX_API_KEY=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiLllJDkuIfnvr0iLCJVc2VyTmFtZSI6IuWUkOS4h-e-vSIsIkFjY291bnQiOiIiLCJTdWJqZWN0SUQiOiIxOTY2NzY5NjU4MjcwODUxMTQ3IiwiUGhvbmUiOiIxMzU2NDcxOTc1NSIsIkdyb3VwSUQiOiIxOTY2NzY5NjU4MjYyNDYyNTM5IiwiUGFnZU5hbWUiOiIiLCJNYWlsIjoiIiwiQ3JlYXRlVGltZSI6IjIwMjUtMDktMTMgMjE6NDc6NTYiLCJUb2tlblR5cGUiOjEsImlzcyI6Im1pbmltYXgifQ.IKh6IYYwV3gMaNsSu-kqt6yPOewN8ZdNTqGKUhI7033Rd85_mt6U2VbahTfAG5f4pNrm-ygO7OfagsQN45PLXl5SxPwuRwOqYq7BuUDWDe-2LtvLlkxcX7yUjV5N3xXGHX-MC2Q2Wrz0-P1yl3pfEiSsKOc7QwAukzGnrL6IIBdufAkAZ-0Qs0Zw5R9aZd3S8wNp9z8E8hfea17RXPcJ--hql-jSa4wpOGgWrh-OS-Mwl8gFZEK-VknTb_T70XQ4ADRsUkAtoo6ijrRzE9J1EJRs9ej3Yt612dGt_bRAQ7z8ZfzVgyySt6zsjHaOWFX_qWpBclSei4lvYh_Ut_XoA
      - MINIMAX_BASE_URL=https://api.minimaxi.com
      - AZURE_SPEECH_KEY=7d4ffd0999c5467aa2dc8c1b4467ace6
      - AZURE_SPEECH_REGION=eastasia
      - FRONTEND_PORT=3001
    volumes:
      - ./storage:/storage
    ports:
      - "4000:4000"
    networks:
      - admin-platform-network

  web:
    image: admin-platform-web:latest
    container_name: admin-platform-web
    restart: unless-stopped
    depends_on:
      - server
    environment:
      - NEXT_PUBLIC_API_URL=http://192.168.0.239:4000
    ports:
      - "3001:3000"
    networks:
      - admin-platform-network

networks:
  admin-platform-network:
    driver: bridge
EOF

echo "✓ docker-compose.yml 创建成功"

# 5. 拉取 MongoDB 镜像并启动所有服务
echo ""
echo "步骤 5/6: 拉取 MongoDB 镜像..."
docker compose pull mongo
echo "✓ MongoDB 镜像拉取成功"

echo ""
echo "步骤 6/6: 启动所有服务..."
docker compose up -d

if [ $? -eq 0 ]; then
    echo "✓ 服务启动成功"
else
    echo "✗ 服务启动失败"
    exit 1
fi

# 6. 查看状态
echo ""
echo "等待服务启动..."
sleep 10
docker compose ps

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://192.168.0.239:3001"
echo "默认账号: admin / admin123"
echo ""
echo "查看日志:"
echo "  docker compose logs -f"
echo "  docker compose logs -f server"
echo "  docker compose logs -f web"
echo ""


