# ============================================
# 推送Docker镜像到阿里云容器镜像服务
# ============================================

# 配置信息（请根据实际情况修改）
$ALIYUN_REGION = "cn-hangzhou"  # 阿里云区域：cn-hangzhou, cn-shanghai, cn-beijing 等
$ALIYUN_NAMESPACE = "admin-platform"  # 你的命名空间
$ALIYUN_REGISTRY = "registry.$ALIYUN_REGION.aliyuncs.com"

# 镜像版本号
$VERSION = "v1.0.0"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "推送镜像到阿里云容器镜像服务" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# 1. 登录阿里云容器镜像服务
Write-Host "[1/4] 登录阿里云容器镜像服务..." -ForegroundColor Yellow
Write-Host "请输入你的阿里云账号（邮箱或手机号）：" -ForegroundColor Green
$ALIYUN_USERNAME = Read-Host
Write-Host "请输入容器镜像服务密码（在阿里云控制台设置的固定密码）：" -ForegroundColor Green
$ALIYUN_PASSWORD = Read-Host -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ALIYUN_PASSWORD)
$PlainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

docker login --username=$ALIYUN_USERNAME --password=$PlainPassword $ALIYUN_REGISTRY

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 登录失败，请检查账号密码" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 登录成功`n" -ForegroundColor Green

# 2. 标记镜像
Write-Host "[2/4] 标记镜像..." -ForegroundColor Yellow

# 标记 server 镜像
$SERVER_LOCAL = "admin-platform-server:latest"
$SERVER_REMOTE = "$ALIYUN_REGISTRY/${ALIYUN_NAMESPACE}/admin-platform-server:$VERSION"
$SERVER_LATEST = "$ALIYUN_REGISTRY/${ALIYUN_NAMESPACE}/admin-platform-server:latest"

docker tag $SERVER_LOCAL $SERVER_REMOTE
docker tag $SERVER_LOCAL $SERVER_LATEST
Write-Host "  ✓ Server: $SERVER_REMOTE" -ForegroundColor Green

# 标记 web 镜像
$WEB_LOCAL = "admin-platform-web:latest"
$WEB_REMOTE = "$ALIYUN_REGISTRY/${ALIYUN_NAMESPACE}/admin-platform-web:$VERSION"
$WEB_LATEST = "$ALIYUN_REGISTRY/${ALIYUN_NAMESPACE}/admin-platform-web:latest"

docker tag $WEB_LOCAL $WEB_REMOTE
docker tag $WEB_LOCAL $WEB_LATEST
Write-Host "  ✓ Web: $WEB_REMOTE`n" -ForegroundColor Green

# 3. 推送镜像
Write-Host "[3/4] 推送镜像到阿里云..." -ForegroundColor Yellow

Write-Host "  推送 Server 镜像..." -ForegroundColor Cyan
docker push $SERVER_REMOTE
docker push $SERVER_LATEST

Write-Host "  推送 Web 镜像..." -ForegroundColor Cyan
docker push $WEB_REMOTE
docker push $WEB_LATEST

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 推送失败" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ 所有镜像推送成功！`n" -ForegroundColor Green

# 4. 显示部署信息
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "部署信息" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Server 镜像: $SERVER_REMOTE" -ForegroundColor White
Write-Host "Web 镜像:    $WEB_REMOTE" -ForegroundColor White
Write-Host "`n请将这些镜像地址用于NAS的docker-compose.yml配置`n" -ForegroundColor Yellow

# 5. 生成NAS部署配置
Write-Host "[4/4] 生成NAS部署配置文件..." -ForegroundColor Yellow

$nasConfig = @"
# ============================================
# NAS Docker Compose 配置
# ============================================
# 使用方法：
# 1. 将此文件保存为 docker-compose.yml
# 2. 修改卷挂载路径（根据你的NAS实际路径）
# 3. 执行: docker-compose up -d

version: '3.8'

services:
  mongo:
    image: mongo:7.0
    container_name: admin-platform-mongo
    restart: unless-stopped
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=your_mongo_password_here
    volumes:
      - /volume1/docker/admin-platform/mongodb:/data/db
    networks:
      - admin-platform-network

  server:
    image: $SERVER_REMOTE
    container_name: admin-platform-server
    restart: unless-stopped
    depends_on:
      - mongo
    environment:
      - NODE_ENV=production
      - PORT=4000
      - MONGODB_URI=mongodb://admin:your_mongo_password_here@mongo:27017/admin-platform?authSource=admin
      - JWT_SECRET=your_jwt_secret_here_change_this_in_production
      - STORAGE_ROOT=/storage
      - DEEPSEEK_API_KEY=sk-a5cc44206c5d411cbb633cd73a6c8bd0
      - METASO_API_KEY=mk-53C55DF41C6C448FD0BA54190CDA2A2F
      - MINIMAX_API_KEY=your_minimax_api_key
      - MINIMAX_BASE_URL=https://api.minimaxi.com
      - AZURE_SPEECH_KEY=7d4ffd0999c5467aa2dc8c1b4467ace6
      - AZURE_SPEECH_REGION=eastasia
      - FRONTEND_PORT=3001
    volumes:
      - /volume1/docker/admin-platform/storage:/storage
    networks:
      - admin-platform-network

  web:
    image: $WEB_REMOTE
    container_name: admin-platform-web
    restart: unless-stopped
    depends_on:
      - server
    environment:
      - NEXT_PUBLIC_API_URL=http://your-nas-ip:4000
    ports:
      - "3001:3000"
      - "4000:4000"
    networks:
      - admin-platform-network

networks:
  admin-platform-network:
    driver: bridge
"@

$nasConfig | Out-File -FilePath "docker-compose.nas.yml" -Encoding UTF8
Write-Host "✅ 已生成 docker-compose.nas.yml`n" -ForegroundColor Green

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "后续步骤" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "1. 将 docker-compose.nas.yml 上传到NAS" -ForegroundColor White
Write-Host "2. 在NAS上修改配置文件中的路径和密钥" -ForegroundColor White
Write-Host "3. 在NAS上执行: docker-compose -f docker-compose.nas.yml up -d" -ForegroundColor White
Write-Host "4. 访问: http://nas-ip:3001" -ForegroundColor White
Write-Host "`n部署完成！🚀`n" -ForegroundColor Green


