# Docker 本地更新指南

快速更新本地 Docker 容器的方法。

## 🚀 快速更新（推荐）

### 方法一：一键更新脚本

```powershell
# 停止并删除旧容器
docker stop admin-platform-web
docker rm admin-platform-web

# 重新构建镜像（使用缓存加速）
docker-compose build web

# 启动新容器
docker-compose up -d web

# 查看状态
docker ps --filter "name=admin-platform-web"
docker logs --tail 20 admin-platform-web
```

### 方法二：完全重建（无缓存）

如果遇到缓存问题，使用无缓存重建：

```powershell
# 停止并删除旧容器
docker stop admin-platform-web
docker rm admin-platform-web

# 清理构建缓存
docker builder prune -f

# 无缓存重新构建
docker-compose build --no-cache web

# 启动新容器
docker-compose up -d web
```

## 📋 详细步骤

### 1. 停止旧容器

```powershell
docker stop admin-platform-web
```

### 2. 删除旧容器（可选）

```powershell
docker rm admin-platform-web
```

### 3. 重新构建镜像

**使用缓存（快速）：**
```powershell
docker-compose build web
```

**无缓存（彻底）：**
```powershell
docker-compose build --no-cache web
```

### 4. 启动新容器

```powershell
docker-compose up -d web
```

### 5. 验证状态

```powershell
# 查看容器状态
docker ps --filter "name=admin-platform-web"

# 查看日志
docker logs --tail 30 admin-platform-web

# 实时查看日志
docker logs -f admin-platform-web
```

## 🔍 常见问题排查

### 问题1：容器启动失败

```powershell
# 查看详细错误日志
docker logs admin-platform-web

# 检查镜像是否存在
docker images | Select-String "admin-platform-web"
```

### 问题2：代码没有更新

```powershell
# 完全清理并重建
docker stop admin-platform-web
docker rm admin-platform-web
docker rmi admin-platform-web
docker builder prune -f
docker-compose build --no-cache web
docker-compose up -d web
```

### 问题3：端口被占用

```powershell
# 查看端口占用
netstat -ano | findstr :3001

# 停止占用端口的进程（替换 PID）
taskkill /PID <PID> /F
```

## 📝 完整更新脚本

创建 `update-web.ps1` 文件：

```powershell
# 停止并删除旧容器
Write-Host "停止旧容器..." -ForegroundColor Yellow
docker stop admin-platform-web 2>$null
docker rm admin-platform-web 2>$null

# 重新构建
Write-Host "重新构建镜像..." -ForegroundColor Yellow
docker-compose build web

# 启动新容器
Write-Host "启动新容器..." -ForegroundColor Yellow
docker-compose up -d web

# 等待启动
Start-Sleep -Seconds 5

# 显示状态
Write-Host "`n容器状态:" -ForegroundColor Cyan
docker ps --filter "name=admin-platform-web"

Write-Host "`n最新日志:" -ForegroundColor Cyan
docker logs --tail 15 admin-platform-web
```

运行脚本：
```powershell
.\update-web.ps1
```

## 🎯 访问地址

更新完成后，访问：
- **前端**: http://localhost:3001
- **后端**: http://localhost:4000

## 💡 提示

1. **开发时**：使用 `docker-compose build web`（使用缓存，更快）
2. **遇到问题时**：使用 `docker-compose build --no-cache web`（完全重建）
3. **浏览器缓存**：更新后按 `Ctrl + Shift + R` 强制刷新
4. **查看实时日志**：`docker logs -f admin-platform-web`

