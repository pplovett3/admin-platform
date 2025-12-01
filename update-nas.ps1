# ============================================
# NAS 更新脚本 - 上传代码并重新构建部署
# ============================================

$NAS_USER = "Tyrael"
$NAS_IP = "192.168.0.239"
$NAS_PATH = "/volume1/docker/admin-platform"
$LOCAL_PATH = $PSScriptRoot

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "NAS 更新流程" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

Write-Host "此脚本将：" -ForegroundColor Yellow
Write-Host "  1. 上传更新的 server 和 web 代码到 NAS" -ForegroundColor White
Write-Host "  2. 上传构建脚本" -ForegroundColor White
Write-Host "  3. 提供在 NAS 上执行的更新命令`n" -ForegroundColor White

$confirm = Read-Host "是否继续？(Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "已取消" -ForegroundColor Yellow
    exit 0
}

# 1. 上传 server 目录
Write-Host "`n[1/3] 上传 server 目录..." -ForegroundColor Yellow
Write-Host "提示: 需要输入 NAS 密码" -ForegroundColor Gray
scp -r "$LOCAL_PATH\server" "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ server 上传失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ server 上传成功" -ForegroundColor Green

# 2. 上传 web 目录
Write-Host "`n[2/3] 上传 web 目录..." -ForegroundColor Yellow
Write-Host "提示: 需要输入 NAS 密码" -ForegroundColor Gray
scp -r "$LOCAL_PATH\web" "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ web 上传失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ web 上传成功" -ForegroundColor Green

# 3. 上传构建脚本和更新脚本
Write-Host "`n[3/4] 上传构建脚本..." -ForegroundColor Yellow
scp "$LOCAL_PATH\nas-build-deploy.sh" "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ 构建脚本上传失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 构建脚本上传成功" -ForegroundColor Green

Write-Host "`n[4/4] 上传更新脚本..." -ForegroundColor Yellow
scp "$LOCAL_PATH\update-nas.sh" "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ 更新脚本上传失败" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ 更新脚本上传成功" -ForegroundColor Green

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "✅ 代码上传完成！" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Cyan

Write-Host "下一步：在 NAS 上执行以下命令更新部署`n" -ForegroundColor Yellow

Write-Host "1. SSH 连接到 NAS：" -ForegroundColor White
Write-Host "   ssh ${NAS_USER}@${NAS_IP}`n" -ForegroundColor Cyan

Write-Host "2. 进入项目目录并停止旧容器：" -ForegroundColor White
Write-Host "   cd ${NAS_PATH}" -ForegroundColor Cyan
Write-Host "   docker compose down`n" -ForegroundColor Cyan

Write-Host "3. 给更新脚本添加执行权限并运行：" -ForegroundColor White
Write-Host "   chmod +x update-nas.sh" -ForegroundColor Cyan
Write-Host "   ./update-nas.sh`n" -ForegroundColor Cyan

Write-Host "   或者使用构建脚本（会重新创建 docker-compose.yml）：" -ForegroundColor Gray
Write-Host "   chmod +x nas-build-deploy.sh" -ForegroundColor Cyan
Write-Host "   ./nas-build-deploy.sh`n" -ForegroundColor Cyan

Write-Host "注意：" -ForegroundColor Yellow
Write-Host "  - 构建过程可能需要 20-30 分钟" -ForegroundColor White
Write-Host "  - 构建完成后会自动启动新容器" -ForegroundColor White
Write-Host "  - 可以通过 'docker compose logs -f' 查看日志`n" -ForegroundColor White

Write-Host "或者，如果你想手动控制更新过程，可以执行：" -ForegroundColor Yellow
Write-Host "   cd ${NAS_PATH}" -ForegroundColor Cyan
Write-Host "   docker compose down" -ForegroundColor Cyan
Write-Host "   cd server && docker build -t admin-platform-server:latest ." -ForegroundColor Cyan
Write-Host "   cd ../web && docker build --build-arg NEXT_PUBLIC_API_URL=http://192.168.0.239:4000 -t admin-platform-web:latest ." -ForegroundColor Cyan
Write-Host "   cd .. && docker compose up -d`n" -ForegroundColor Cyan

