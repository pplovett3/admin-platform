#!/bin/bash
# NAS 部署脚本
# 在 NAS 上运行此脚本进行快速部署

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Admin Platform NAS 部署脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 配置（请修改为你的实际配置）
REGISTRY="registry.cn-hangzhou.aliyuncs.com"
NAMESPACE="mycompany"
DEPLOY_DIR="/volume1/docker/admin-platform"

# 检查是否在部署目录
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}错误：未找到 docker-compose.prod.yml 文件${NC}"
    echo -e "${YELLOW}请确保在正确的目录运行此脚本${NC}"
    exit 1
fi

# 检查环境变量文件
if [ ! -f ".env.prod" ]; then
    echo -e "${YELLOW}警告：未找到 .env.prod 文件${NC}"
    read -p "是否从模板创建？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "env.template" ]; then
            cp env.template .env.prod
            echo -e "${GREEN}已创建 .env.prod，请编辑此文件配置环境变量${NC}"
            exit 0
        else
            echo -e "${RED}错误：未找到 env.template 文件${NC}"
            exit 1
        fi
    fi
fi

# 显示配置
echo -e "${BLUE}当前配置：${NC}"
echo -e "  镜像仓库：$REGISTRY"
echo -e "  命名空间：$NAMESPACE"
echo -e "  部署目录：$DEPLOY_DIR"
echo ""

# 检查 Docker
echo -e "${BLUE}[1/6] 检查 Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误：Docker 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker 已安装${NC}"

# 登录阿里云镜像仓库
echo ""
echo -e "${BLUE}[2/6] 登录阿里云镜像仓库...${NC}"
read -p "是否需要登录？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker login $REGISTRY
fi

# 拉取镜像
echo ""
echo -e "${BLUE}[3/6] 拉取最新镜像...${NC}"
docker pull $REGISTRY/$NAMESPACE/admin-platform-server:latest
docker pull $REGISTRY/$NAMESPACE/admin-platform-web:latest
docker pull mongo:6
echo -e "${GREEN}✓ 镜像拉取完成${NC}"

# 停止旧容器
echo ""
echo -e "${BLUE}[4/6] 停止旧容器...${NC}"
if docker compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    docker compose -f docker-compose.prod.yml down
    echo -e "${GREEN}✓ 旧容器已停止${NC}"
else
    echo -e "${YELLOW}没有运行中的容器${NC}"
fi

# 启动新容器
echo ""
echo -e "${BLUE}[5/6] 启动新容器...${NC}"
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
echo -e "${GREEN}✓ 容器启动完成${NC}"

# 等待服务就绪
echo ""
echo -e "${BLUE}[6/6] 等待服务就绪...${NC}"
sleep 5

# 检查服务状态
echo ""
echo -e "${BLUE}服务状态：${NC}"
docker compose -f docker-compose.prod.yml ps

# 健康检查
echo ""
echo -e "${BLUE}健康检查：${NC}"
if curl -f http://localhost:4000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 后端服务正常${NC}"
else
    echo -e "${RED}✗ 后端服务异常${NC}"
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 前端服务正常${NC}"
else
    echo -e "${RED}✗ 前端服务异常${NC}"
fi

# 完成
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}访问地址：${NC}"
echo -e "  前端：http://$(hostname -I | awk '{print $1}'):3000"
echo -e "  后端：http://$(hostname -I | awk '{print $1}'):4000"
echo ""
echo -e "${BLUE}查看日志：${NC}"
echo -e "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo -e "${BLUE}管理命令：${NC}"
echo -e "  重启：docker compose -f docker-compose.prod.yml restart"
echo -e "  停止：docker compose -f docker-compose.prod.yml down"
echo -e "  状态：docker compose -f docker-compose.prod.yml ps"
echo ""

