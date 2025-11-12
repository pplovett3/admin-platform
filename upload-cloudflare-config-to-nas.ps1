# ============================================
# 上传 Cloudflare 配置文件到 NAS
# ============================================
# 使用说明：
# 1. 在本地 PowerShell 中执行此脚本
# 2. 右键点击此文件，选择"使用 PowerShell 运行"
# ============================================

Write-Host "=========================================="
Write-Host "  上传 Cloudflare 配置到 NAS"
Write-Host "=========================================="
Write-Host ""

# 检查当前目录
if (-not (Test-Path "server\src\index.ts")) {
    Write-Host "❌ 错误: 未找到 server\src\index.ts 文件" -ForegroundColor Red
    Write-Host "请确保在 admin-platform 目录下执行此脚本" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "✅ 当前目录检查通过" -ForegroundColor Green
Write-Host ""

# NAS 地址
$nasPath = "\\192.168.0.239\docker\admin-platform"

# 检查 NAS 是否可访问
Write-Host "1. 检查 NAS 连接..."
if (-not (Test-Path $nasPath)) {
    Write-Host "❌ 无法访问 NAS: $nasPath" -ForegroundColor Red
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "  - NAS 是否开机" -ForegroundColor Yellow
    Write-Host "  - 网络连接是否正常" -ForegroundColor Yellow
    Write-Host "  - 共享文件夹权限是否正确" -ForegroundColor Yellow
    pause
    exit 1
}
Write-Host "✅ NAS 连接正常" -ForegroundColor Green
Write-Host ""

# 复制文件 1: server/src/index.ts
Write-Host "2. 复制 server/src/index.ts..."
$source1 = "server\src\index.ts"
$dest1 = "$nasPath\server\src\index.ts"
try {
    Copy-Item -Path $source1 -Destination $dest1 -Force
    Write-Host "✅ index.ts 复制成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 复制失败: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 复制文件 2: server/src/routes/files.routes.ts
Write-Host "3. 复制 server/src/routes/files.routes.ts..."
$source2 = "server\src\routes\files.routes.ts"
$dest2 = "$nasPath\server\src\routes\files.routes.ts"
try {
    Copy-Item -Path $source2 -Destination $dest2 -Force
    Write-Host "✅ files.routes.ts 复制成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 复制失败: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 复制文件 3: server/src/routes/publish.routes.ts
Write-Host "4. 复制 server/src/routes/publish.routes.ts..."
$source3 = "server\src\routes\publish.routes.ts"
$dest3 = "$nasPath\server\src\routes\publish.routes.ts"
try {
    Copy-Item -Path $source3 -Destination $dest3 -Force
    Write-Host "✅ publish.routes.ts 复制成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 复制失败: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 复制文件 4: docker-compose.nas.yml
Write-Host "5. 复制 docker-compose.nas.yml..."
$source4 = "docker-compose.nas.yml"
$dest4 = "$nasPath\docker-compose.yml"
try {
    Copy-Item -Path $source4 -Destination $dest4 -Force
    Write-Host "✅ docker-compose.yml 复制成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 复制失败: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 复制 Nginx 配置
Write-Host "6. 复制 Nginx 配置..."
$source5 = "nginx.conf"
$dest5 = "$nasPath\nginx.conf"
try {
    Copy-Item -Path $source5 -Destination $dest5 -Force
    Write-Host "✅ nginx.conf 复制成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 复制失败: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 复制前端 Dockerfile
Write-Host "7. 复制前端 Dockerfile..."
$source6 = "web\Dockerfile"
$dest6 = "$nasPath\web\Dockerfile"
try {
    Copy-Item -Path $source6 -Destination $dest6 -Force
    Write-Host "✅ web/Dockerfile 复制成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 复制失败: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

# 复制部署脚本
Write-Host "8. 复制部署脚本..."
$source7 = "Cloudflare-部署命令.sh"
$dest7 = "$nasPath\Cloudflare-部署命令.sh"
try {
    Copy-Item -Path $source7 -Destination $dest7 -Force
    Write-Host "✅ 部署脚本复制成功" -ForegroundColor Green
} catch {
    Write-Host "❌ 复制失败: $_" -ForegroundColor Red
    pause
    exit 1
}
Write-Host ""

Write-Host "=========================================="
Write-Host "  ✅ 所有文件上传完成！"
Write-Host "=========================================="
Write-Host ""
Write-Host "下一步操作："
Write-Host ""
Write-Host "1. 在 Cloudflare Zero Trust 中配置两个域名路由："
Write-Host "   - platform.yf-xr.com → http://192.168.0.239:3001" -ForegroundColor Cyan
Write-Host "   - api.platform.yf-xr.com → http://192.168.0.239:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. SSH 到 NAS 执行部署："
Write-Host "   ssh Tyrael@192.168.0.239" -ForegroundColor Yellow
Write-Host "   cd /volume1/docker/admin-platform" -ForegroundColor Yellow
Write-Host "   bash Cloudflare-部署命令.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. 部署完成后访问："
Write-Host "   https://platform.yf-xr.com" -ForegroundColor Green
Write-Host ""
Write-Host "详细步骤请查看: Cloudflare-部署清单.md"
Write-Host ""
Write-Host "=========================================="
Write-Host ""
pause

