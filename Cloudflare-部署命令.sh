#!/bin/bash

# ============================================
# Cloudflare Tunnel 公网部署脚本
# ============================================
# 使用说明：
# 1. 先在 Cloudflare 控制台配置好两个域名路由
# 2. 将此脚本上传到 NAS
# 3. 执行：bash Cloudflare-部署命令.sh
# ============================================

set -e  # 遇到错误立即退出

echo "=========================================="
echo "  开始部署 Cloudflare Tunnel 公网访问"
echo "=========================================="
echo ""

# 1. 检查当前目录
echo "1. 检查当前目录..."
if [ ! -f "docker-compose.yml" ]; then
    echo "错误: 未找到 docker-compose.yml 文件"
    echo "请确保在 /volume1/docker/admin-platform 目录下执行此脚本"
    exit 1
fi
echo "✅ 目录检查通过"
echo ""

# 2. 停止当前服务
echo "2. 停止当前服务..."
docker compose down
echo "✅ 服务已停止"
echo ""

# 3. 构建并启动服务（docker-compose 会自动构建镜像）
echo "3. 构建并启动服务..."
docker compose up -d --build
if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    exit 1
fi
echo "✅ 服务启动成功"
echo ""

# 7. 等待服务启动
echo "6. 等待服务启动（10秒）..."
sleep 10
echo ""

# 8. 检查服务状态
echo "7. 检查服务状态..."
docker compose ps
echo ""

# 9. 显示最近的日志
echo "8. 显示最近的日志..."
docker compose logs --tail=50
echo ""

echo "=========================================="
echo "  ✅ 部署完成！"
echo "=========================================="
echo ""
echo "公网访问地址："
echo "  前端: https://platform.yf-xr.com"
echo "  后端: https://api.platform.yf-xr.com"
echo ""
echo "内网访问地址（测试用）："
echo "  前端: http://192.168.0.239:3001"
echo "  后端: http://192.168.0.239:4000"
echo ""
echo "默认账号："
echo "  手机号: 13800000000"
echo "  密码:   admin123"
echo ""
echo "查看实时日志："
echo "  docker compose logs -f"
echo ""
echo "=========================================="

