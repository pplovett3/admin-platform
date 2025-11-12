#!/bin/bash
# ============================================
# NAS 部署脚本
# ============================================

echo "=========================================="
echo "开始部署 Admin Platform 到 NAS"
echo "=========================================="

# 1. 创建目录结构
echo ""
echo "[1/6] 创建目录结构..."
mkdir -p /volume1/docker/admin-platform/mongodb
mkdir -p /volume1/docker/admin-platform/storage
cd /volume1/docker/admin-platform

if [ $? -eq 0 ]; then
    echo "✓ 目录创建成功"
else
    echo "✗ 目录创建失败"
    exit 1
fi

# 2. 检查配置文件
echo ""
echo "[2/6] 检查配置文件..."
if [ ! -f "docker-compose.yml" ]; then
    echo "✗ 配置文件不存在，请先上传 docker-compose.yml"
    echo "提示：使用 scp 命令上传："
    echo "  scp docker-compose.nas.yml Tyrael@192.168.0.239:/volume1/docker/admin-platform/docker-compose.yml"
    exit 1
else
    echo "✓ 配置文件存在"
fi

# 3. 登录阿里云镜像仓库
echo ""
echo "[3/6] 登录阿里云镜像仓库..."
echo "请输入阿里云密码（Tt19910805）："
docker login --username=唐万羽 crpi-uiz8h842zcgpj6r1.cn-shanghai.personal.cr.aliyuncs.com

if [ $? -ne 0 ]; then
    echo "✗ 登录失败"
    exit 1
fi
echo "✓ 登录成功"

# 4. 拉取镜像
echo ""
echo "[4/6] 拉取镜像..."
docker-compose pull

if [ $? -ne 0 ]; then
    echo "✗ 镜像拉取失败"
    exit 1
fi
echo "✓ 镜像拉取成功"

# 5. 启动服务
echo ""
echo "[5/6] 启动服务..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "✗ 服务启动失败"
    exit 1
fi
echo "✓ 服务启动成功"

# 6. 查看状态
echo ""
echo "[6/6] 查看服务状态..."
sleep 3
docker-compose ps

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "访问地址：http://192.168.0.239:3001"
echo "默认账号：admin / admin123"
echo ""
echo "查看日志："
echo "  docker-compose logs -f"
echo ""
echo "常用命令："
echo "  docker-compose ps          # 查看状态"
echo "  docker-compose logs -f     # 查看日志"
echo "  docker-compose restart     # 重启服务"
echo "  docker-compose down        # 停止服务"
echo ""


