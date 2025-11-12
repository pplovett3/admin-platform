# 🚀 Nginx 反向代理方案说明

## 📋 架构设计

```
┌─────────────────────────────────────────────────────────┐
│  访问方式                                                 │
├─────────────────────────────────────────────────────────┤
│  内网 HTTP:  http://192.168.0.239:3001                  │
│  公网 HTTPS: https://platform.yf-xr.com                 │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Nginx 反向代理 (端口 3001)                              │
├─────────────────────────────────────────────────────────┤
│  /          → web:3000  (前端)                          │
│  /api/*     → server:4000 (后端)                        │
└─────────────────────────────────────────────────────────┘
                    ↓                ↓
        ┌──────────────┐    ┌──────────────┐
        │  Web 容器     │    │ Server 容器   │
        │  (Next.js)   │    │  (Express)   │
        │  端口 3000    │    │  端口 4000    │
        └──────────────┘    └──────────────┘
```

## ✅ 优势

### 1. **统一入口**
- 前端和后端通过同一个域名和端口访问
- 无需配置多个 Cloudflare Tunnel 路由
- 简化网络架构

### 2. **自动解决 Mixed Content**
- 前端使用相对路径 `/api/*`
- HTTP 访问时：`http://192.168.0.239:3001/api/...`
- HTTPS 访问时：`https://platform.yf-xr.com/api/...`
- 协议自动匹配，无 Mixed Content 错误

### 3. **灵活的代理规则**
- 可以添加缓存策略
- 可以设置超时时间
- 可以限制请求大小
- 可以添加安全头

### 4. **简化 CORS 配置**
- 前后端同源，无需复杂的 CORS 配置
- 减少跨域问题

## 📝 配置文件详解

### Nginx 配置 (`nginx.conf`)

```nginx
server {
    listen 3001;  # 监听 3001 端口
    server_name _;
    
    client_max_body_size 100M;  # 允许上传大文件

    # 前端静态资源
    location / {
        proxy_pass http://web:3000;  # 转发到内部 web 容器
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # API 请求
    location /api/ {
        proxy_pass http://server:4000;  # 转发到后端服务
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

### Docker Compose 配置

```yaml
services:
  # Web 前端 (不直接暴露端口)
  web:
    build: ./web
    environment:
      - NEXT_PUBLIC_API_URL=  # 留空，使用相对路径
    networks:
      - admin-platform-network
    # 无需 ports 配置

  # Server 后端 (可选暴露 4000，用于直接调试)
  server:
    build: ./server
    ports:
      - "4000:4000"  # 可选：用于直接访问后端调试
    networks:
      - admin-platform-network

  # Nginx 反向代理 (对外唯一入口)
  nginx:
    image: nginx:alpine
    ports:
      - "3001:3001"  # 对外暴露的唯一端口
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - web
      - server
    networks:
      - admin-platform-network
```

## 🔧 Cloudflare Tunnel 配置

### 只需一个路由！

在 Cloudflare Zero Trust 中配置：

| 配置项 | 值 |
|--------|-----|
| Public Hostname | `platform.yf-xr.com` |
| Service | `HTTP` |
| URL | `192.168.0.239:3001` |

**就这一个！** 无需配置 `api.platform.yf-xr.com`。

## 📊 请求流程示例

### 示例 1：登录请求

**内网访问：**
```
浏览器: http://192.168.0.239:3001/login
前端JS: fetch('/api/auth/login', ...)
实际请求: http://192.168.0.239:3001/api/auth/login
Nginx: 转发到 http://server:4000/api/auth/login
```

**公网访问：**
```
浏览器: https://platform.yf-xr.com/login
前端JS: fetch('/api/auth/login', ...)
实际请求: https://platform.yf-xr.com/api/auth/login
Cloudflare: 转发到 NAS http://192.168.0.239:3001/api/auth/login
Nginx: 转发到 http://server:4000/api/auth/login
```

### 示例 2：公开课程访问

**内网访问：**
```
浏览器: http://192.168.0.239:3001/course/xxx
前端JS: fetch('/api/public/course/xxx', ...)
实际请求: http://192.168.0.239:3001/api/public/course/xxx
Nginx: 转发到 http://server:4000/api/public/course/xxx
```

**公网访问：**
```
浏览器: https://platform.yf-xr.com/course/xxx
前端JS: fetch('/api/public/course/xxx', ...)
实际请求: https://platform.yf-xr.com/api/public/course/xxx
Cloudflare: 转发到 NAS http://192.168.0.239:3001/api/public/course/xxx
Nginx: 转发到 http://server:4000/api/public/course/xxx
```

## 🎯 关键点

### 1. **前端环境变量为空**

```yaml
environment:
  - NEXT_PUBLIC_API_URL=  # 留空！
```

当 `NEXT_PUBLIC_API_URL` 为空时，前端代码中的：

```typescript
const baseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
```

会自动使用 `window.location.origin`，即：
- 内网：`http://192.168.0.239:3001`
- 公网：`https://platform.yf-xr.com`

### 2. **相对路径 API 请求**

前端请求：
```typescript
fetch('/api/auth/login', ...)
```

会自动变成：
- 内网：`http://192.168.0.239:3001/api/auth/login`
- 公网：`https://platform.yf-xr.com/api/auth/login`

### 3. **Nginx 路由规则**

- `/` → 前端静态资源 (`web:3000`)
- `/api/` → 后端 API (`server:4000`)

## 🔍 调试技巧

### 查看 Nginx 日志

```bash
docker logs admin-platform-nginx
docker logs -f admin-platform-nginx  # 实时查看
```

### 测试 Nginx 配置

```bash
# 进入 Nginx 容器
docker exec -it admin-platform-nginx sh

# 测试配置语法
nginx -t

# 重新加载配置
nginx -s reload
```

### 测试后端连接

```bash
# 进入 Nginx 容器
docker exec -it admin-platform-nginx sh

# 测试后端是否可达
wget -O- http://server:4000/health

# 测试前端是否可达
wget -O- http://web:3000
```

## 🚀 部署步骤

### 1. 上传文件

```powershell
cd E:\上信校产线动画\admin-platform
.\upload-cloudflare-config-to-nas.ps1
```

会上传：
- `docker-compose.yml` (包含 Nginx 配置)
- `nginx.conf` (Nginx 反向代理规则)
- 后端代码文件

### 2. 部署

```bash
ssh Tyrael@192.168.0.239
cd /volume1/docker/admin-platform
docker compose down
docker compose up -d --build
docker compose logs -f
```

### 3. 验证

**内网测试：**
```bash
curl http://192.168.0.239:3001/health
```

**浏览器测试：**
- 内网：http://192.168.0.239:3001
- 公网：https://platform.yf-xr.com

## ✨ 总结

| 方案 | 优点 | 缺点 |
|------|------|------|
| **Nginx 反向代理** | • 统一入口<br>• 自动解决 Mixed Content<br>• 简化 Cloudflare 配置<br>• 灵活的路由规则 | • 多一层代理<br>• 稍微增加复杂度 |
| 双域名方案 | • 前后端完全分离<br>• 便于独立扩展 | • 需要配置两个域名<br>• Mixed Content 问题<br>• CORS 配置复杂 |

**推荐使用 Nginx 反向代理方案！** 🎉

