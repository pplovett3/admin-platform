#!/bin/bash

echo "=========================================="
echo "开始部署 Admin Platform 到 NAS"
echo "=========================================="

# 1. 创建目录结构
echo "步骤 1/7: 创建目录结构..."
mkdir -p /volume1/docker/admin-platform/mongodb
mkdir -p /volume1/docker/admin-platform/storage
cd /volume1/docker/admin-platform
echo "✓ 目录创建成功"

# 2. 创建 docker-compose.yml
echo ""
echo "步骤 2/7: 创建 docker-compose.yml 配置文件..."
cat > docker-compose.yml << 'EOFCOMPOSE'
version: '3.8'

services:
  mongo:
    image: mongo:7.0
    container_name: admin-platform-mongo
    restart: unless-stopped
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=AdminPlatform2024
    volumes:
      - /volume1/docker/admin-platform/mongodb:/data/db
    networks:
      - admin-platform-network

  server:
    image: crpi-uiz8h842zcgpj6r1.cn-shanghai.personal.cr.aliyuncs.com/admin-platform/admin-platform-server:v1.0.0
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
      - /volume1/docker/admin-platform/storage:/storage
    ports:
      - "4000:4000"
    networks:
      - admin-platform-network

  web:
    image: crpi-uiz8h842zcgpj6r1.cn-shanghai.personal.cr.aliyuncs.com/admin-platform/admin-platform-web:v1.0.0
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
EOFCOMPOSE

echo "✓ docker-compose.yml 创建成功"

# 3. 显示配置文件
echo ""
echo "步骤 3/7: 验证配置文件..."
ls -lh docker-compose.yml
echo "✓ 配置文件已创建"

# 4. 停止并删除旧容器（如果存在）
echo ""
echo "步骤 4/7: 清理旧容器..."
docker-compose down 2>/dev/null || echo "没有旧容器需要清理"

# 5. 拉取镜像（需要先登录）
echo ""
echo "步骤 5/7: 拉取镜像..."
echo "注意：需要先手动登录阿里云镜像仓库"
echo "执行: docker login --username=唐万羽 crpi-uiz8h842zcgpj6r1.cn-shanghai.personal.cr.aliyuncs.com"
echo "密码: Tt19910805"
echo ""
read -p "已登录成功？按回车继续..."

docker-compose pull
if [ $? -eq 0 ]; then
    echo "✓ 镜像拉取成功"
else
    echo "✗ 镜像拉取失败，请检查登录状态"
    exit 1
fi

# 6. 启动服务
echo ""
echo "步骤 6/7: 启动服务..."
docker-compose up -d

if [ $? -eq 0 ]; then
    echo "✓ 服务启动成功"
else
    echo "✗ 服务启动失败"
    exit 1
fi

# 7. 查看状态
echo ""
echo "步骤 7/7: 查看服务状态..."
sleep 5
docker-compose ps

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "访问地址: http://192.168.0.239:3001"
echo "默认账号: admin / admin123"
echo ""
echo "查看日志: docker-compose logs -f"
echo "重启服务: docker-compose restart"
echo "停止服务: docker-compose down"
echo ""

