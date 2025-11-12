# ============================================
# 推送镜像到阿里云个人版容器镜像服务
# ============================================

# 阿里云个人版实例配置
$REGISTRY = "crpi-uiz8h842zcgpj6r1.cn-shanghai.personal.cr.aliyuncs.com"
$NAMESPACE = "admin-platform"
$VERSION = "v1.0.0"

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "推送镜像到阿里云" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# 1. 标记 server 镜像
Write-Host "[1/4] 标记 Server 镜像..." -ForegroundColor Yellow
docker tag admin-platform-server:latest ${REGISTRY}/${NAMESPACE}/admin-platform-server:${VERSION}
docker tag admin-platform-server:latest ${REGISTRY}/${NAMESPACE}/admin-platform-server:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Server 镜像标记成功" -ForegroundColor Green
} else {
    Write-Host "  ✗ Server 镜像标记失败" -ForegroundColor Red
    exit 1
}

# 2. 标记 web 镜像
Write-Host "`n[2/4] 标记 Web 镜像..." -ForegroundColor Yellow
docker tag admin-platform-web:latest ${REGISTRY}/${NAMESPACE}/admin-platform-web:${VERSION}
docker tag admin-platform-web:latest ${REGISTRY}/${NAMESPACE}/admin-platform-web:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Web 镜像标记成功" -ForegroundColor Green
} else {
    Write-Host "  ✗ Web 镜像标记失败" -ForegroundColor Red
    exit 1
}

# 3. 推送 server 镜像
Write-Host "`n[3/4] 推送 Server 镜像到阿里云..." -ForegroundColor Yellow
Write-Host "  推送版本: ${VERSION}" -ForegroundColor Cyan
docker push ${REGISTRY}/${NAMESPACE}/admin-platform-server:${VERSION}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Server 镜像推送失败" -ForegroundColor Red
    exit 1
}

Write-Host "  推送 latest 标签..." -ForegroundColor Cyan
docker push ${REGISTRY}/${NAMESPACE}/admin-platform-server:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Server 镜像推送成功" -ForegroundColor Green
} else {
    Write-Host "  ✗ Server latest 推送失败" -ForegroundColor Red
    exit 1
}

# 4. 推送 web 镜像
Write-Host "`n[4/4] 推送 Web 镜像到阿里云..." -ForegroundColor Yellow
Write-Host "  推送版本: ${VERSION}" -ForegroundColor Cyan
docker push ${REGISTRY}/${NAMESPACE}/admin-platform-web:${VERSION}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Web 镜像推送失败" -ForegroundColor Red
    exit 1
}

Write-Host "  推送 latest 标签..." -ForegroundColor Cyan
docker push ${REGISTRY}/${NAMESPACE}/admin-platform-web:latest

if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Web 镜像推送成功" -ForegroundColor Green
} else {
    Write-Host "  ✗ Web latest 推送失败" -ForegroundColor Red
    exit 1
}

# 5. 显示推送结果
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "✅ 所有镜像推送成功！" -ForegroundColor Green
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "镜像地址：" -ForegroundColor White
Write-Host "  Server: ${REGISTRY}/${NAMESPACE}/admin-platform-server:${VERSION}" -ForegroundColor Cyan
Write-Host "  Web:    ${REGISTRY}/${NAMESPACE}/admin-platform-web:${VERSION}" -ForegroundColor Cyan

Write-Host "`n下一步：在NAS上使用这些镜像地址部署" -ForegroundColor Yellow
Write-Host "请查看 docker-compose.nas.yml 配置文件`n" -ForegroundColor Yellow


