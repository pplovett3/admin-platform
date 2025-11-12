# ============================================
# 上传文件到NAS
# ============================================

$NAS_IP = "192.168.0.239"
$NAS_USER = "Tyrael"
$NAS_PATH = "/volume1/docker/admin-platform"

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "上传部署文件到NAS" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# 1. 上传 docker-compose.yml
Write-Host "[1/2] 上传 docker-compose.yml..." -ForegroundColor Yellow
scp docker-compose.nas.yml ${NAS_USER}@${NAS_IP}:${NAS_PATH}/docker-compose.yml

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ docker-compose.yml 上传成功`n" -ForegroundColor Green
} else {
    Write-Host "  ✗ 上传失败`n" -ForegroundColor Red
    exit 1
}

# 2. 上传部署脚本
Write-Host "[2/2] 上传部署脚本..." -ForegroundColor Yellow
scp nas-deploy.sh ${NAS_USER}@${NAS_IP}:${NAS_PATH}/deploy.sh

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ 部署脚本上传成功`n" -ForegroundColor Green
} else {
    Write-Host "  ✗ 上传失败`n" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ 所有文件上传完成！" -ForegroundColor Green
Write-Host "==========================================`n" -ForegroundColor Cyan

Write-Host "下一步：在NAS上执行部署" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. SSH连接到NAS：" -ForegroundColor White
Write-Host "   ssh ${NAS_USER}@${NAS_IP}" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. 修改配置文件（重要！）：" -ForegroundColor White
Write-Host "   cd /volume1/docker/admin-platform" -ForegroundColor Cyan
Write-Host "   nano docker-compose.yml" -ForegroundColor Cyan
Write-Host ""
Write-Host "   需要修改的配置项：" -ForegroundColor Yellow
Write-Host "   - MongoDB密码（两处）" -ForegroundColor White
Write-Host "   - JWT_SECRET" -ForegroundColor White
Write-Host "   - NEXT_PUBLIC_API_URL=http://192.168.0.239:4000" -ForegroundColor White
Write-Host ""
Write-Host "3. 执行部署脚本：" -ForegroundColor White
Write-Host "   chmod +x deploy.sh" -ForegroundColor Cyan
Write-Host "   ./deploy.sh" -ForegroundColor Cyan
Write-Host ""


