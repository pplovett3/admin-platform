#!/bin/bash
# 构建并推送 Docker 镜像到阿里云容器镜像服务
# 使用方法：./build-and-push.sh

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Admin Platform Docker 镜像构建工具  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 配置区域（请根据实际情况修改）
REGISTRY="registry.cn-hangzhou.aliyuncs.com"
NAMESPACE="mycompany"
VERSION="latest"

# 从命令行参数读取版本号（可选）
if [ ! -z "$1" ]; then
    VERSION="$1"
    echo -e "${GREEN}使用自定义版本号: $VERSION${NC}"
fi

# 完整镜像地址
SERVER_IMAGE="$REGISTRY/$NAMESPACE/admin-platform-server"
WEB_IMAGE="$REGISTRY/$NAMESPACE/admin-platform-web"

echo -e "${BLUE}镜像仓库：${NC}$REGISTRY"
echo -e "${BLUE}命名空间：${NC}$NAMESPACE"
echo -e "${BLUE}版本标签：${NC}$VERSION"
echo ""

# 询问是否继续
read -p "是否继续构建和推送？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}已取消${NC}"
    exit 1
fi

# 检查是否已登录
echo -e "${BLUE}[1/5] 检查 Docker 登录状态...${NC}"
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}错误：Docker 未运行，请先启动 Docker${NC}"
    exit 1
fi

# 询问是否需要登录
read -p "是否需要登录阿里云镜像仓库？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "正在登录 $REGISTRY ..."
    docker login $REGISTRY
fi

# 构建 Server 镜像
echo ""
echo -e "${BLUE}[2/5] 构建 Server 镜像...${NC}"
cd server
docker build -t admin-platform-server:$VERSION .
docker tag admin-platform-server:$VERSION $SERVER_IMAGE:$VERSION
docker tag admin-platform-server:$VERSION $SERVER_IMAGE:latest
cd ..
echo -e "${GREEN}✓ Server 镜像构建完成${NC}"

# 构建 Web 镜像
echo ""
echo -e "${BLUE}[3/5] 构建 Web 镜像...${NC}"
cd web
docker build -t admin-platform-web:$VERSION .
docker tag admin-platform-web:$VERSION $WEB_IMAGE:$VERSION
docker tag admin-platform-web:$VERSION $WEB_IMAGE:latest
cd ..
echo -e "${GREEN}✓ Web 镜像构建完成${NC}"

# 推送 Server 镜像
echo ""
echo -e "${BLUE}[4/5] 推送 Server 镜像...${NC}"
docker push $SERVER_IMAGE:$VERSION
docker push $SERVER_IMAGE:latest
echo -e "${GREEN}✓ Server 镜像推送完成${NC}"

# 推送 Web 镜像
echo ""
echo -e "${BLUE}[5/5] 推送 Web 镜像...${NC}"
docker push $WEB_IMAGE:$VERSION
docker push $WEB_IMAGE:latest
echo -e "${GREEN}✓ Web 镜像推送完成${NC}"

# 完成
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✓ 所有镜像构建和推送完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Server 镜像："
echo -e "  - $SERVER_IMAGE:$VERSION"
echo -e "  - $SERVER_IMAGE:latest"
echo ""
echo -e "Web 镜像："
echo -e "  - $WEB_IMAGE:$VERSION"
echo -e "  - $WEB_IMAGE:latest"
echo ""
echo -e "${BLUE}下一步：在 NAS 上拉取并运行这些镜像${NC}"
echo -e "  docker pull $SERVER_IMAGE:latest"
echo -e "  docker pull $WEB_IMAGE:latest"
echo -e "  docker compose -f docker-compose.prod.yml up -d"
echo ""

