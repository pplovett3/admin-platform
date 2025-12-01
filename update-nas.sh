#!/bin/bash
# ============================================
# NAS 更新脚本 - 在 NAS 上执行
# ============================================

echo "=========================================="
echo "更新 Admin Platform 部署"
echo "=========================================="

cd /volume1/docker/admin-platform

# 检查代码是否存在
if [ ! -d "server" ] || [ ! -d "web" ]; then
    echo "✗ 错误: server 或 web 目录不存在"
    echo "请先使用 upload-code-to-nas.ps1 上传代码"
    exit 1
fi

# 1. 停止旧容器
echo ""
echo "[1/5] 停止旧容器..."
docker compose down

if [ $? -ne 0 ]; then
    echo "⚠ 警告: 停止容器时出现问题，但继续执行..."
fi
echo "✓ 旧容器已停止"

# 2. 备份旧镜像（可选）
echo ""
echo "[2/5] 备份旧镜像标签..."
if docker images | grep -q "admin-platform-server:latest"; then
    docker tag admin-platform-server:latest admin-platform-server:backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null
    echo "✓ Server 镜像已备份"
fi
if docker images | grep -q "admin-platform-web:latest"; then
    docker tag admin-platform-web:latest admin-platform-web:backup-$(date +%Y%m%d-%H%M%S) 2>/dev/null
    echo "✓ Web 镜像已备份"
fi

# 3. 构建 server 镜像
echo ""
echo "[3/5] 构建 server 镜像（这可能需要 10-15 分钟）..."
cd server
docker build -t admin-platform-server:latest .

if [ $? -ne 0 ]; then
    echo "✗ Server 镜像构建失败"
    exit 1
fi
echo "✓ Server 镜像构建成功"

# 4. 构建 web 镜像
echo ""
echo "[4/5] 构建 web 镜像（这可能需要 15-20 分钟）..."
cd ../web
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://192.168.0.239:4000 \
  -t admin-platform-web:latest .

if [ $? -ne 0 ]; then
    echo "✗ Web 镜像构建失败"
    exit 1
fi
echo "✓ Web 镜像构建成功"

# 5. 启动新容器
echo ""
echo "[5/5] 启动新容器..."
cd /volume1/docker/admin-platform
docker compose up -d

if [ $? -ne 0 ]; then
    echo "✗ 容器启动失败"
    exit 1
fi
echo "✓ 容器启动成功"

# 6. 查看状态
echo ""
echo "等待服务启动..."
sleep 10
docker compose ps

echo ""
echo "=========================================="
echo "✅ 更新完成！"
echo "=========================================="
echo ""
echo "访问地址: http://192.168.0.239:3001"
echo ""
echo "查看日志:"
echo "  docker compose logs -f"
echo "  docker compose logs -f server"
echo "  docker compose logs -f web"
echo ""
echo "如果遇到问题，可以回滚到备份镜像："
echo "  docker tag admin-platform-server:backup-YYYYMMDD-HHMMSS admin-platform-server:latest"
echo "  docker tag admin-platform-web:backup-YYYYMMDD-HHMMSS admin-platform-web:latest"
echo "  docker compose up -d"
echo ""

