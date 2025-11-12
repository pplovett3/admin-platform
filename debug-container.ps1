# ============================================
# 容器内代码检查脚本
# 用于验证容器内的代码是否是最新的
# ============================================

Write-Host "================================" -ForegroundColor Cyan
Write-Host "检查容器内的前端代码" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$containerName = "admin-platform-web"

# 检查容器是否运行
$containerStatus = docker ps -q -f "name=$containerName"
if (-not $containerStatus) {
    Write-Host "✗ 容器 $containerName 未运行" -ForegroundColor Red
    Write-Host "请先运行: docker-compose up -d web" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ 容器正在运行" -ForegroundColor Green
Write-Host ""

# 检查构建ID
Write-Host "1. 检查 Next.js 构建 ID:" -ForegroundColor Yellow
docker exec $containerName cat /app/.next/BUILD_ID 2>$null
Write-Host ""

# 检查构建时间
Write-Host "2. 检查构建文件时间戳:" -ForegroundColor Yellow
docker exec $containerName ls -lh /app/.next/BUILD_ID 2>$null
Write-Host ""

# 检查源代码文件
Write-Host "3. 检查关键源代码文件:" -ForegroundColor Yellow
Write-Host "   激活页面 (activate/page.tsx):" -ForegroundColor Cyan
$activateContent = docker exec $containerName cat /app/app/activate/page.tsx 2>$null
if ($activateContent) {
    $lineCount = ($activateContent | Measure-Object -Line).Lines
    Write-Host "   ✓ 文件存在 ($lineCount 行)" -ForegroundColor Green
    Write-Host "   文件前10行内容:" -ForegroundColor Gray
    ($activateContent -split "`n" | Select-Object -First 10) | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "   ✗ 文件不存在或无法读取" -ForegroundColor Red
}
Write-Host ""

# 检查构建输出
Write-Host "4. 检查构建输出目录结构:" -ForegroundColor Yellow
docker exec $containerName ls -lh /app/.next/server/app/ 2>$null
Write-Host ""

# 检查环境变量
Write-Host "5. 检查环境变量:" -ForegroundColor Yellow
docker exec $containerName printenv | Select-String "NEXT_PUBLIC", "NODE_ENV"
Write-Host ""

# 检查 package.json 版本
Write-Host "6. 检查 package.json:" -ForegroundColor Yellow
docker exec $containerName cat /app/package.json | Select-String "version"
Write-Host ""

# 对比本地和容器内的文件
Write-Host "7. 对比本地和容器内的文件差异:" -ForegroundColor Yellow
Write-Host "   本地 activate/page.tsx 行数:" -ForegroundColor Cyan
$localContent = Get-Content ".\web\app\activate\page.tsx"
Write-Host "   $($localContent.Count) 行" -ForegroundColor Gray

Write-Host "   容器内 activate/page.tsx 行数:" -ForegroundColor Cyan
$containerLineCount = docker exec $containerName sh -c "wc -l < /app/app/activate/page.tsx" 2>$null
Write-Host "   $containerLineCount 行" -ForegroundColor Gray

if ($localContent.Count -eq [int]$containerLineCount.Trim()) {
    Write-Host "   ✓ 行数一致" -ForegroundColor Green
} else {
    Write-Host "   ✗ 行数不一致，可能代码未更新！" -ForegroundColor Red
}
Write-Host ""

# 进入容器进行交互式检查
Write-Host "================================" -ForegroundColor Cyan
Write-Host "提示: 进行更详细的检查" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "如需进入容器交互式检查，运行:" -ForegroundColor Yellow
Write-Host "  docker exec -it $containerName sh" -ForegroundColor Cyan
Write-Host ""
Write-Host "进入后可执行的命令:" -ForegroundColor Yellow
Write-Host "  ls -la /app/app/                    # 查看源代码目录" -ForegroundColor Gray
Write-Host "  cat /app/app/activate/page.tsx     # 查看具体文件内容" -ForegroundColor Gray
Write-Host "  ls -la /app/.next/                  # 查看构建输出" -ForegroundColor Gray
Write-Host "  cat /app/.next/BUILD_ID             # 查看构建ID" -ForegroundColor Gray


