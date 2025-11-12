# Docker 容器化部署完整指南

## 📋 目录
1. [本地 Docker 运行测试](#1-本地-docker-运行测试)
2. [构建并推送镜像到阿里云](#2-构建并推送镜像到阿里云)
3. [NAS Docker 部署](#3-nas-docker-部署)
4. [环境变量配置](#4-环境变量配置)
5. [常见问题](#5-常见问题)

---

## 1. 本地 Docker 运行测试

### 1.1 准备工作
确保本地已安装：
- Docker Desktop（Windows）
- Docker Compose

检查版本：
```bash
docker --version
docker compose version
```

### 1.2 配置环境变量
在 `admin-platform` 目录创建 `.env` 文件：

```env
# JWT 密钥（请修改为随机字符串）
JWT_SECRET=your-super-secret-jwt-key-change-this

# 前端 API 地址（本地测试用）
NEXT_PUBLIC_API_URL=http://localhost:4000

# 存储路径（根据您的实际情况修改）
STORAGE_ROOT=Y:\\metaclassroom
```

### 1.3 启动本地 Docker 服务
```bash
cd admin-platform

# 构建并启动所有服务
docker compose up -d --build

# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f
```

### 1.4 验证服务
- **前端**：打开浏览器访问 http://localhost:3000
- **后端健康检查**：http://localhost:4000/health
- **MongoDB**：mongodb://localhost:27017

默认登录账号：
- 手机号：`13800000000`
- 密码：`admin123`

### 1.5 停止服务
```bash
# 停止服务
docker compose down

# 停止并删除数据卷（谨慎使用）
docker compose down -v
```

---

## 2. 构建并推送镜像到阿里云

### 2.1 登录阿里云容器镜像服务

首先在阿里云控制台创建命名空间和仓库：
1. 访问：https://cr.console.aliyun.com
2. 创建命名空间（如：`mycompany`）
3. 创建仓库：
   - `admin-platform-server`
   - `admin-platform-web`
   - `admin-platform-mongo`（可选，使用官方镜像也可）

登录阿里云镜像仓库：
```bash
# 替换 <registry-url> 为您的阿里云镜像仓库地址
# 格式：registry.cn-<region>.aliyuncs.com
# 例如：registry.cn-hangzhou.aliyuncs.com

docker login registry.cn-hangzhou.aliyuncs.com
# 输入阿里云账号的镜像仓库用户名和密码
```

### 2.2 构建镜像并打标签

```bash
cd admin-platform

# 设置镜像仓库地址（请修改为您的实际地址）
export REGISTRY=registry.cn-hangzhou.aliyuncs.com/mycompany
# 或者 Windows PowerShell:
$REGISTRY="registry.cn-hangzhou.aliyuncs.com/mycompany"

# 构建 Server 镜像
docker build -t admin-platform-server:latest ./server
docker tag admin-platform-server:latest $REGISTRY/admin-platform-server:latest
docker tag admin-platform-server:latest $REGISTRY/admin-platform-server:v1.0.0

# 构建 Web 镜像
docker build -t admin-platform-web:latest ./web
docker tag admin-platform-web:latest $REGISTRY/admin-platform-web:latest
docker tag admin-platform-web:latest $REGISTRY/admin-platform-web:v1.0.0
```

### 2.3 推送镜像到阿里云

```bash
# 推送 Server 镜像
docker push $REGISTRY/admin-platform-server:latest
docker push $REGISTRY/admin-platform-server:v1.0.0

# 推送 Web 镜像
docker push $REGISTRY/admin-platform-web:latest
docker push $REGISTRY/admin-platform-web:v1.0.0
```

### 2.4 使用脚本自动化（推荐）

创建 `build-and-push.sh` 脚本（见下方），一键完成构建和推送：

```bash
# Linux/Mac
chmod +x build-and-push.sh
./build-and-push.sh

# Windows PowerShell
.\build-and-push.ps1
```

---

## 3. NAS Docker 部署

### 3.1 准备 NAS 环境

确保 NAS 已安装：
- Docker
- Docker Compose

### 3.2 创建部署目录

SSH 登录到 NAS 或使用 NAS 文件管理器：
```bash
# 创建部署目录
mkdir -p /volume1/docker/admin-platform
cd /volume1/docker/admin-platform
```

### 3.3 创建生产环境配置文件

创建 `docker-compose.prod.yml`：
```yaml
version: "3.8"

services:
  mongo:
    image: mongo:6
    container_name: admin-platform-mongo
    restart: always
    volumes:
      - /volume1/docker/admin-platform/mongo-data:/data/db
    networks:
      - admin-network
    # 注意：不暴露到公网，仅容器内部访问

  server:
    image: registry.cn-hangzhou.aliyuncs.com/mycompany/admin-platform-server:latest
    container_name: admin-platform-server
    restart: always
    environment:
      - PORT=4000
      - MONGODB_URI=mongodb://mongo:27017/admin_platform
      - JWT_SECRET=${JWT_SECRET}
      - STORAGE_ROOT=/storage
    volumes:
      - /volume1/metaclassroom:/storage
    depends_on:
      - mongo
    networks:
      - admin-network
    ports:
      - "4000:4000"

  web:
    image: registry.cn-hangzhou.aliyuncs.com/mycompany/admin-platform-web:latest
    container_name: admin-platform-web
    restart: always
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    depends_on:
      - server
    networks:
      - admin-network
    ports:
      - "3000:3000"

networks:
  admin-network:
    driver: bridge

volumes:
  mongo-data:
```

### 3.4 创建环境变量文件

创建 `.env.prod`：
```env
# JWT 密钥（强烈建议使用强随机字符串）
JWT_SECRET=your-production-jwt-secret-change-this

# 前端 API 地址（改为您的 NAS 公网 IP 或域名）
NEXT_PUBLIC_API_URL=http://your-nas-ip:4000
# 或者使用域名：
# NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 3.5 登录阿里云镜像仓库并拉取镜像

```bash
# 在 NAS 上登录阿里云镜像仓库
docker login registry.cn-hangzhou.aliyuncs.com

# 拉取镜像
docker pull registry.cn-hangzhou.aliyuncs.com/mycompany/admin-platform-server:latest
docker pull registry.cn-hangzhou.aliyuncs.com/mycompany/admin-platform-web:latest
docker pull mongo:6
```

### 3.6 启动服务

```bash
cd /volume1/docker/admin-platform

# 使用生产配置启动
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 查看运行状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f
```

### 3.7 配置 Nginx 反向代理（推荐）

如果您的 NAS 上有 Nginx，建议配置反向代理：

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;

    # API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 前端代理
    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 3.8 更新服务

当有新版本时：
```bash
# 拉取最新镜像
docker pull registry.cn-hangzhou.aliyuncs.com/mycompany/admin-platform-server:latest
docker pull registry.cn-hangzhou.aliyuncs.com/mycompany/admin-platform-web:latest

# 重启服务（会自动使用新镜像）
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 清理旧镜像
docker image prune -f
```

---

## 4. 环境变量配置

### 4.1 Server 环境变量

| 变量名 | 说明 | 默认值 | 是否必须 |
|--------|------|--------|----------|
| `PORT` | 服务端口 | `4000` | 否 |
| `MONGODB_URI` | MongoDB 连接字符串 | `mongodb://mongo:27017/admin_platform` | 是 |
| `JWT_SECRET` | JWT 密钥 | `change_me` | 是（生产环境必须修改） |
| `STORAGE_ROOT` | 文件存储根目录 | - | 是 |

### 4.2 Web 环境变量

| 变量名 | 说明 | 默认值 | 是否必须 |
|--------|------|--------|----------|
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `http://localhost:4000` | 是 |

### 4.3 生成强 JWT_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 5. 常见问题

### 5.1 容器无法启动

**检查日志：**
```bash
docker compose logs server
docker compose logs web
docker compose logs mongo
```

**常见原因：**
- 端口被占用（3000/4000/27017）
- 环境变量配置错误
- 数据卷权限问题

### 5.2 前端无法连接后端

**检查：**
1. 确认 `NEXT_PUBLIC_API_URL` 配置正确
2. 确认后端容器正常运行：`curl http://localhost:4000/health`
3. 检查网络连通性

### 5.3 文件上传失败

**检查：**
1. 确认 `STORAGE_ROOT` 路径存在且有写权限
2. 检查容器内的卷挂载是否正确

### 5.4 MongoDB 数据丢失

**确保：**
1. 数据卷正确挂载：`mongo-data:/data/db`
2. 不要使用 `docker compose down -v`（会删除数据卷）

### 5.5 NAS 上镜像拉取失败

**解决方案：**
1. 检查 NAS 网络连接
2. 确认已登录阿里云镜像仓库
3. 检查镜像仓库是否设置为公开或已授权
4. 尝试手动拉取：`docker pull <镜像地址>`

### 5.6 更新代码后需要重新推送

**流程：**
```bash
# 1. 本地测试
docker compose up -d --build

# 2. 重新构建并推送
./build-and-push.sh

# 3. NAS 上拉取最新镜像
docker pull <镜像地址>:latest

# 4. 重启服务
docker compose -f docker-compose.prod.yml up -d
```

---

## 6. 安全建议

### 6.1 生产环境安全清单

- ✅ 修改默认 JWT_SECRET
- ✅ 修改默认管理员密码
- ✅ MongoDB 不暴露到公网（移除端口映射）
- ✅ 使用 HTTPS（Nginx + SSL 证书）
- ✅ 配置防火墙规则
- ✅ 定期备份 MongoDB 数据
- ✅ 使用强密码和多因素认证
- ✅ 定期更新镜像和依赖

### 6.2 数据备份

```bash
# 备份 MongoDB
docker exec admin-platform-mongo mongodump --out /data/backup

# 将备份复制到宿主机
docker cp admin-platform-mongo:/data/backup ./mongo-backup

# 恢复 MongoDB
docker exec admin-platform-mongo mongorestore /data/backup
```

---

## 7. 监控和维护

### 7.1 查看资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df

# 清理未使用的资源
docker system prune -a
```

### 7.2 日志管理

```bash
# 查看实时日志
docker compose logs -f --tail=100

# 清理日志（谨慎使用）
truncate -s 0 $(docker inspect --format='{{.LogPath}}' admin-platform-server)
```

---

## 8. 快速参考

### 8.1 常用命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f [service-name]

# 进入容器
docker exec -it admin-platform-server sh

# 重新构建
docker compose up -d --build
```

### 8.2 目录结构

```
admin-platform/
├── server/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── web/
│   ├── Dockerfile
│   ├── package.json
│   └── app/
├── docker-compose.yml          # 开发环境配置
├── docker-compose.prod.yml     # 生产环境配置
├── .env                        # 开发环境变量
├── .env.prod                   # 生产环境变量
└── build-and-push.sh          # 构建推送脚本
```

---

## 支持

如有问题，请检查：
1. Docker 日志
2. 环境变量配置
3. 网络连接
4. 防火墙规则

更多信息请参考：
- [Docker 官方文档](https://docs.docker.com/)
- [阿里云容器镜像服务](https://help.aliyun.com/product/60716.html)

