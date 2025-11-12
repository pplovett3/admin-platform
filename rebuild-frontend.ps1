# ============================================
# 前端镜像重建脚本 - 完全清理缓存版本
# ============================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "开始前端镜像完全重建流程" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 步骤1: 停止并删除旧容器
Write-Host "步骤 1/6: 停止并删除旧的 web 容器..." -ForegroundColor Yellow
docker stop admin-platform-web 2>$null
docker rm admin-platform-web 2>$null
Write-Host "✓ 旧容器已清理" -ForegroundColor Green
Write-Host ""

# 步骤2: 删除旧镜像
Write-Host "步骤 2/6: 删除旧的 web 镜像..." -ForegroundColor Yellow
$oldImages = docker images admin-platform-web -q
if ($oldImages) {
    docker rmi -f $oldImages 2>$null
    Write-Host "✓ 旧镜像已删除" -ForegroundColor Green
} else {
    Write-Host "✓ 没有找到旧镜像" -ForegroundColor Green
}
Write-Host ""

# 步骤3: 清理 Docker 构建缓存
Write-Host "步骤 3/6: 清理 Docker 构建缓存..." -ForegroundColor Yellow
docker builder prune -f
Write-Host "✓ 构建缓存已清理" -ForegroundColor Green
Write-Host ""

# 步骤4: 显示本地前端代码最新修改时间（验证）
Write-Host "步骤 4/6: 验证本地代码..." -ForegroundColor Yellow
$webFiles = Get-ChildItem -Path ".\web\app" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 5
Write-Host "最近修改的前端文件:" -ForegroundColor Cyan
foreach ($file in $webFiles) {
    Write-Host "  - $($file.FullName)" -ForegroundColor Gray
    Write-Host "    修改时间: $($file.LastWriteTime)" -ForegroundColor Gray
}
Write-Host ""

# 步骤5: 无缓存重新构建镜像
Write-Host "步骤 5/6: 重新构建镜像（无缓存）..." -ForegroundColor Yellow
Write-Host "这可能需要几分钟时间..." -ForegroundColor Gray
docker-compose build --no-cache web
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 镜像构建成功" -ForegroundColor Green
} else {
    Write-Host "✗ 镜像构建失败，请查看上面的错误信息" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 步骤6: 启动新容器
Write-Host "步骤 6/6: 启动新容器..." -ForegroundColor Yellow
docker-compose up -d web
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 容器启动成功" -ForegroundColor Green
} else {
    Write-Host "✗ 容器启动失败" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 验证步骤
Write-Host "================================" -ForegroundColor Cyan
Write-Host "验证新容器状态" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# 等待容器启动
Write-Host "等待容器启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 显示容器状态
Write-Host "容器状态:" -ForegroundColor Cyan
docker ps -a --filter "name=admin-platform-web" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host ""

# 显示最新日志
Write-Host "容器日志 (最后20行):" -ForegroundColor Cyan
docker logs --tail 20 admin-platform-web
Write-Host ""

# 进入容器检查文件
Write-Host "================================" -ForegroundColor Cyan
Write-Host "检查容器内的代码文件" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "正在检查容器内的构建文件..." -ForegroundColor Yellow

# 列出容器内的关键文件
docker exec admin-platform-web ls -lh /app/.next/BUILD_ID
docker exec admin-platform-web cat /app/.next/BUILD_ID

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "重建完成！" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址: http://localhost:3001" -ForegroundColor Yellow
Write-Host ""
Write-Host "如果浏览器显示仍是旧代码，请:" -ForegroundColor Yellow
Write-Host "  1. 按 Ctrl + Shift + R (Windows) 强制刷新" -ForegroundColor Gray
Write-Host "  2. 或使用无痕模式访问" -ForegroundColor Gray
Write-Host "  3. 或清除浏览器缓存" -ForegroundColor Gray
Write-Host ""
Write-Host "查看实时日志命令: docker logs -f admin-platform-web" -ForegroundColor Cyan


