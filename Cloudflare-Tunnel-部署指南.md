# Cloudflare Tunnel 公网访问部署指南

## 📋 架构说明

通过 Cloudflare Tunnel，将 NAS 上的服务安全地暴露到公网：

```
公网访问                    Cloudflare Tunnel              NAS 内网服务
───────────────────────    ───────────────────    ───────────────────────

https://platform.yf-xr.com  ──→  Cloudflare Edge  ──→  http://192.168.0.239:3001 (前端)
                                                    
https://api.platform.yf-xr.com ──→ Cloudflare Edge ──→  http://192.168.0.239:4000 (后端)
```

## 🔧 第一步：配置 Cloudflare Tunnel

### 1. 在 Cloudflare Zero Trust 中创建 Tunnel

1. 登录 [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. 进入 **Networks** → **Tunnels**
3. 点击 **Create a tunnel**
4. 选择 **Cloudflared**
5. 输入名称：`yf-xr-nas-tunnel`
6. 按照指引在 NAS 上安装 cloudflared

### 2. 配置公共主机名（Public Hostnames）

在 Tunnel 中添加两个路由：

#### 路由 1：前端服务
- **Subdomain**: `platform`
- **Domain**: `yf-xr.com`
- **Service Type**: `HTTP`
- **URL**: `192.168.0.239:3001`

完整域名：`platform.yf-xr.com` → `http://192.168.0.239:3001`

#### 路由 2：后端服务
- **Subdomain**: `api.platform`
- **Domain**: `yf-xr.com`
- **Service Type**: `HTTP`
- **URL**: `192.168.0.239:4000`

完整域名：`api.platform.yf-xr.com` → `http://192.168.0.239:4000`

### 3. 高级配置（可选但推荐）

对于后端路由（`api.platform.yf-xr.com`），建议添加以下配置：

在 **Additional application settings** 中：
- ✅ **No TLS Verify**: 启用（因为内网使用 HTTP）
- ✅ **HTTP2 Origin**: 禁用
- ✅ **Origin Request** → **Connect Timeout**: 30s（增加超时时间）

## 🚀 第二步：部署更新到 NAS

### 1. 复制修改后的文件到 NAS

打开文件资源管理器（Windows）或 Finder（Mac），复制以下文件：

```
本地路径 → NAS 路径

E:\上信校产线动画\admin-platform\server\src\index.ts
→ \\192.168.0.239\docker\admin-platform\server\src\index.ts

E:\上信校产线动画\admin-platform\docker-compose.nas.yml
→ \\192.168.0.239\docker\admin-platform\docker-compose.yml
```

### 2. SSH 到 NAS 重新构建和部署

```bash
# SSH 登录 NAS
ssh Tyrael@192.168.0.239

# 进入项目目录
cd /volume1/docker/admin-platform

# 停止当前服务
docker compose down

# 重新构建 server（包含新的 CORS 配置）
cd server
docker build -t admin-platform-server:latest .

# 回到主目录
cd /volume1/docker/admin-platform

# 使用新的配置启动服务
docker compose up -d

# 查看启动日志
docker compose logs -f
```

等待看到以下日志，表示启动成功：
```
admin-platform-server | Server listening on port 4000
admin-platform-web    | ▲ Next.js 14.x.x
admin-platform-web    | - Local:        http://localhost:3000
```

按 `Ctrl+C` 退出日志查看。

## ✅ 第三步：测试验证

### 1. 测试后端 API

在浏览器或命令行测试后端健康检查：

```bash
# 应该返回 {"ok":true}
curl https://api.platform.yf-xr.com/health
```

### 2. 测试前端访问

在浏览器访问：
```
https://platform.yf-xr.com
```

应该能正常打开登录页面。

### 3. 测试登录功能

使用默认账号登录：
- **账号**：13800000000
- **密码**：admin123

如果能正常登录并进入管理后台，说明配置成功！

### 4. 测试公开课程访问

访问任意已发布的课程链接，例如：
```
https://platform.yf-xr.com/course/690038d000a6ca537bcc2f79
```

检查：
- ✅ 页面能正常加载
- ✅ 3D 模型正常显示
- ✅ 音频能正常播放
- ✅ 浏览器控制台无 CORS 错误

## 🔍 故障排查

### 问题 1：Mixed Content 错误

**错误信息**：
```
Mixed Content: The page at 'https://platform.yf-xr.com' was loaded over HTTPS, 
but requested an insecure resource 'http://192.168.0.239:4000/...'. 
This request has been blocked.
```

**原因**：前端代码仍在请求 HTTP 后端地址

**解决**：
1. 确认 `docker-compose.yml` 中 `NEXT_PUBLIC_API_URL` 已设置为 `https://api.platform.yf-xr.com`
2. 重新构建前端镜像
3. 重启服务

### 问题 2：CORS 错误

**错误信息**：
```
Access to fetch at 'https://api.platform.yf-xr.com/api/auth/login' from origin 
'https://platform.yf-xr.com' has been blocked by CORS policy
```

**原因**：后端 CORS 白名单未包含新域名

**解决**：
1. 确认 `server/src/index.ts` 中已添加两个域名
2. 重新构建 server 镜像
3. 重启服务

### 问题 3：Cloudflare Tunnel 连接超时

**错误信息**：524 A timeout occurred

**解决**：
1. 检查 NAS 上的服务是否正常运行：`docker compose ps`
2. 检查 Cloudflare Tunnel 状态是否为 **Healthy**
3. 增加 Tunnel 的连接超时时间（在 Cloudflare 控制台配置）
4. 检查 NAS 防火墙设置

### 问题 4：502 Bad Gateway

**错误信息**：502 Bad Gateway

**解决**：
1. 确认服务正在运行：`docker compose ps`
2. 确认端口正确：前端 3001，后端 4000
3. 检查 Cloudflare Tunnel 配置的内网地址和端口
4. 查看服务日志：`docker compose logs -f`

## 📝 配置文件参考

### Cloudflare Tunnel 配置文件（可选）

如果使用配置文件方式部署 Tunnel，在 NAS 上创建 `/etc/cloudflared/config.yml`：

```yaml
tunnel: <your-tunnel-id>
credentials-file: /etc/cloudflared/<your-tunnel-id>.json

ingress:
  # 前端服务
  - hostname: platform.yf-xr.com
    service: http://192.168.0.239:3001
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
  
  # 后端服务
  - hostname: api.platform.yf-xr.com
    service: http://192.168.0.239:4000
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
  
  # 默认路由（必须）
  - service: http_status:404
```

## 🔒 安全建议

1. **启用 Cloudflare Access**（可选）
   - 限制管理后台只允许特定邮箱访问
   - 公开课程页面保持公开

2. **定期更新 JWT_SECRET**
   - 修改 `docker-compose.yml` 中的 `JWT_SECRET`
   - 重启服务后所有用户需重新登录

3. **备份数据库**
   ```bash
   # 导出 MongoDB 数据
   docker exec admin-platform-mongo mongodump --out=/data/backup
   
   # 复制备份到 NAS 本地
   docker cp admin-platform-mongo:/data/backup /volume1/backups/mongodb/
   ```

4. **监控服务状态**
   - 定期检查 `docker compose logs`
   - 配置 Cloudflare 监控和告警

## 🎉 完成！

现在你的系统可以通过以下方式访问：

- **公网访问**（推荐用于生产）：
  - 前端：https://platform.yf-xr.com
  - 后端：https://api.platform.yf-xr.com

- **内网访问**（开发调试）：
  - 前端：http://192.168.0.239:3001
  - 后端：http://192.168.0.239:4000

---

## 📞 技术支持

如遇问题，请检查：
1. NAS 上的服务日志：`docker compose logs -f`
2. Cloudflare Tunnel 状态
3. 浏览器控制台错误信息

需要帮助请联系技术支持。

