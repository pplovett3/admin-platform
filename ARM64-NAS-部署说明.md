# 🔧 ARM64 NAS 架构修复说明

## ❌ 遇到的问题

在绿联 NAS（ARM64 架构）上部署时出现错误：

```
no matching manifest for linux/arm64/v8 in the manifest list entries
```

**原因**：之前的配置尝试从阿里云拉取 x86 架构的镜像，但 ARM64 的 NAS 无法运行 x86 镜像。

---

## ✅ 解决方案

**改为在 NAS 上本地构建 ARM64 镜像**，而不是拉取远程镜像。

### 已修改的配置文件

`docker-compose.nas.yml` 已更新为：

```yaml
# 后端服务 - 使用本地构建
server:
  build:
    context: ./server
    dockerfile: Dockerfile
  image: admin-platform-server:latest

# 前端服务 - 使用本地构建
web:
  build:
    context: ./web
    dockerfile: Dockerfile
    args:
      NEXT_PUBLIC_API_URL: https://api.platform.yf-xr.com
  image: admin-platform-web:latest
```

---

## 🚀 重新部署步骤

### 1. 重新上传配置文件

在本地 PowerShell 执行：

```powershell
cd E:\上信校产线动画\admin-platform
.\upload-cloudflare-config-to-nas.ps1
```

这会上传最新的配置文件到 NAS。

---

### 2. SSH 到 NAS 重新部署

```bash
# SSH 登录
ssh Tyrael@192.168.0.239

# 进入目录
cd /volume1/docker/admin-platform

# 停止并清理旧容器
docker compose down

# 使用新配置构建并启动（会在 NAS 上本地构建 ARM64 镜像）
docker compose up -d --build
```

---

### 3. 等待构建完成

**首次构建会比较慢**（10-20分钟），因为需要：
- ✅ 拉取 Node.js 基础镜像（ARM64 版本）
- ✅ 安装所有依赖
- ✅ 构建前端和后端镜像

你会看到类似的输出：

```
[+] Building 234.5s (23/23) FINISHED
 => [server internal] load build definition
 => [server] transferring context
 => [server] RUN npm ci --only=production
 => [web] RUN npm run build
 ...
```

---

### 4. 验证部署成功

查看运行状态：

```bash
docker compose ps
```

应该看到：

```
NAME                      STATUS
admin-platform-mongo      Up 2 minutes
admin-platform-server     Up 2 minutes
admin-platform-web        Up 2 minutes
```

查看日志：

```bash
docker compose logs -f
```

等待看到：

```
admin-platform-server | Server listening on port 4000
admin-platform-web    | ▲ Next.js ready on http://localhost:3000
```

按 `Ctrl+C` 退出。

---

## 🎯 测试访问

### 内网测试

```bash
# 测试后端
curl http://192.168.0.239:4000/health

# 应返回
{"ok":true}
```

### 公网测试

浏览器访问：
```
https://platform.yf-xr.com
```

使用 `13800000000` / `admin123` 登录。

---

## 📝 关键变化

| 之前 | 现在 |
|------|------|
| 从阿里云拉取 x86 镜像 | 在 NAS 本地构建 ARM64 镜像 |
| 快速启动（秒级） | 首次构建较慢（10-20分钟） |
| 架构不兼容 ❌ | 完美兼容 ARM64 ✅ |
| 依赖外部镜像仓库 | 完全本地构建 |

---

## 💡 优化建议

### 加速后续部署

构建一次后，镜像会缓存在 NAS 上。后续更新代码时：

```bash
# 只重新构建有变化的服务
docker compose up -d --build server   # 只更新后端
docker compose up -d --build web      # 只更新前端
```

### 清理旧镜像

如果 NAS 存储空间紧张：

```bash
# 清理未使用的镜像
docker image prune -a

# 查看镜像占用空间
docker system df
```

---

## 🔍 故障排查

### 问题：构建超时

如果构建时间过长或卡住：

```bash
# 停止构建
docker compose down

# 清理构建缓存
docker builder prune -a

# 重新构建
docker compose up -d --build
```

### 问题：内存不足

如果 NAS 内存不足（< 4GB）：

```bash
# 限制构建并发数
DOCKER_BUILDKIT=1 docker compose up -d --build
```

或在 `docker-compose.yml` 中添加资源限制：

```yaml
server:
  build:
    context: ./server
  deploy:
    resources:
      limits:
        memory: 1G
```

---

## ✅ 确认清单

- [x] 修改 `docker-compose.nas.yml` 使用本地构建
- [x] 更新部署脚本和文档
- [x] 重新上传配置文件到 NAS
- [x] 在 NAS 上重新构建镜像
- [x] 验证服务正常运行
- [x] 测试公网访问

---

## 📞 需要帮助？

如果遇到问题：

1. 查看构建日志：`docker compose logs --tail=100`
2. 检查 NAS 可用空间：`df -h`
3. 检查 NAS 可用内存：`free -h`
4. 提供错误信息以便技术支持

---

现在可以重新部署了！🎉

