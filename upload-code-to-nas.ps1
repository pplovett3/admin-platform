# 上传项目代码到 NAS
Write-Host "=========================================="
Write-Host "上传项目代码到 NAS"
Write-Host "=========================================="

$NAS_USER = "Tyrael"
$NAS_IP = "192.168.0.239"
$NAS_PATH = "/volume1/docker/admin-platform"
$LOCAL_PATH = "E:\上信校产线动画\admin-platform"

Write-Host ""
Write-Host "准备上传以下目录："
Write-Host "  - server/"
Write-Host "  - web/"
Write-Host "  - nas-build-deploy.sh"
Write-Host ""

# 使用 scp 上传（需要多次输入密码）
Write-Host "提示: 每次都需要输入 NAS 密码"
Write-Host ""

# 上传 server 目录
Write-Host "1/3: 上传 server 目录..."
scp -r "$LOCAL_PATH\server" "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ server 上传失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ server 上传成功" -ForegroundColor Green

# 上传 web 目录
Write-Host ""
Write-Host "2/3: 上传 web 目录..."
scp -r "$LOCAL_PATH\web" "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ web 上传失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ web 上传成功" -ForegroundColor Green

# 上传构建脚本
Write-Host ""
Write-Host "3/3: 上传构建脚本..."
scp "$LOCAL_PATH\nas-build-deploy.sh" "${NAS_USER}@${NAS_IP}:${NAS_PATH}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ 构建脚本上传失败" -ForegroundColor Red
    exit 1
}
Write-Host "✓ 构建脚本上传成功" -ForegroundColor Green

Write-Host ""
Write-Host "=========================================="
Write-Host "上传完成！"
Write-Host "=========================================="
Write-Host ""
Write-Host "现在请执行以下命令在 NAS 上构建并部署："
Write-Host ""
Write-Host "  ssh ${NAS_USER}@${NAS_IP}" -ForegroundColor Cyan
Write-Host "  cd ${NAS_PATH}" -ForegroundColor Cyan
Write-Host "  chmod +x nas-build-deploy.sh" -ForegroundColor Cyan
Write-Host "  ./nas-build-deploy.sh" -ForegroundColor Cyan
Write-Host ""


