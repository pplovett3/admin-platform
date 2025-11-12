# 构建并推送 Docker 镜像到阿里云容器镜像服务（Windows PowerShell）
# 使用方法：.\build-and-push.ps1 [版本号]

param(
    [string]$Version = "latest"
)

# 设置错误时停止
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  Admin Platform Docker 镜像构建工具  " -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# 配置区域（请根据实际情况修改）
$REGISTRY = "registry.cn-hangzhou.aliyuncs.com"
$NAMESPACE = "mycompany"

Write-Host "镜像仓库：$REGISTRY" -ForegroundColor Blue
Write-Host "命名空间：$NAMESPACE" -ForegroundColor Blue
Write-Host "版本标签：$Version" -ForegroundColor Blue
Write-Host ""

# 完整镜像地址
$SERVER_IMAGE = "$REGISTRY/$NAMESPACE/admin-platform-server"
$WEB_IMAGE = "$REGISTRY/$NAMESPACE/admin-platform-web"

# 询问是否继续
$confirmation = Read-Host "是否继续构建和推送？(y/n)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "已取消" -ForegroundColor Red
    exit
}

# 检查 Docker 是否运行
Write-Host ""
Write-Host "[1/5] 检查 Docker 运行状态..." -ForegroundColor Blue
try {
    docker info | Out-Null
    Write-Host "✓ Docker 运行正常" -ForegroundColor Green
} catch {
    Write-Host "错误：Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}

# 询问是否需要登录
$loginConfirm = Read-Host "是否需要登录阿里云镜像仓库？(y/n)"
if ($loginConfirm -eq 'y' -or $loginConfirm -eq 'Y') {
    Write-Host "正在登录 $REGISTRY ..." -ForegroundColor Yellow
    docker login $REGISTRY
}

# 构建 Server 镜像
Write-Host ""
Write-Host "[2/5] 构建 Server 镜像..." -ForegroundColor Blue
Push-Location server
docker build -t "admin-platform-server:$Version" .
docker tag "admin-platform-server:$Version" "${SERVER_IMAGE}:$Version"
docker tag "admin-platform-server:$Version" "${SERVER_IMAGE}:latest"
Pop-Location
Write-Host "✓ Server 镜像构建完成" -ForegroundColor Green

# 构建 Web 镜像
Write-Host ""
Write-Host "[3/5] 构建 Web 镜像..." -ForegroundColor Blue
Push-Location web
docker build -t "admin-platform-web:$Version" .
docker tag "admin-platform-web:$Version" "${WEB_IMAGE}:$Version"
docker tag "admin-platform-web:$Version" "${WEB_IMAGE}:latest"
Pop-Location
Write-Host "✓ Web 镜像构建完成" -ForegroundColor Green

# 推送 Server 镜像
Write-Host ""
Write-Host "[4/5] 推送 Server 镜像..." -ForegroundColor Blue
docker push "${SERVER_IMAGE}:$Version"
docker push "${SERVER_IMAGE}:latest"
Write-Host "✓ Server 镜像推送完成" -ForegroundColor Green

# 推送 Web 镜像
Write-Host ""
Write-Host "[5/5] 推送 Web 镜像..." -ForegroundColor Blue
docker push "${WEB_IMAGE}:$Version"
docker push "${WEB_IMAGE}:latest"
Write-Host "✓ Web 镜像推送完成" -ForegroundColor Green

# 完成
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ 所有镜像构建和推送完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Server 镜像："
Write-Host "  - ${SERVER_IMAGE}:$Version"
Write-Host "  - ${SERVER_IMAGE}:latest"
Write-Host ""
Write-Host "Web 镜像："
Write-Host "  - ${WEB_IMAGE}:$Version"
Write-Host "  - ${WEB_IMAGE}:latest"
Write-Host ""
Write-Host "下一步：在 NAS 上拉取并运行这些镜像" -ForegroundColor Blue
Write-Host "  docker pull ${SERVER_IMAGE}:latest"
Write-Host "  docker pull ${WEB_IMAGE}:latest"
Write-Host "  docker compose -f docker-compose.prod.yml up -d"
Write-Host ""

