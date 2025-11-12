# 🐳 Admin Platform Docker 容器化部署使用指南

## 📌 方案概述

您的 Admin Platform 已完全支持 Docker 容器化部署，实现从本地开发到生产环境的完整工作流：

```
本地开发 → 构建镜像 → 推送阿里云 → NAS 部署
```

**✅ 完全可行！** 您的方案非常合理且完整。

---

## 🎯 快速开始（三步走）

### 第一步：本地 Docker 测试

1. **准备环境变量**
```powershell
cd admin-platform
Copy-Item env.template .env
# 编辑 .env，修改 JWT_SECRET 和 STORAGE_ROOT
```

2. **启动服务**
```powershell
docker compose up -d --build
```

3. **验证运行**
- 前端：http://localhost:3000
- 后端：http://localhost:4000/health
- 默认账号：`13800000000` / `admin123`

---

### 第二步：推送到阿里云镜像仓库

1. **准备阿里云容器镜像服务**
   - 访问：https://cr.console.aliyun.com
   - 创建命名空间（如：`mycompany`）
   - 创建仓库：
     - `admin-platform-server`
     - `admin-platform-web`

2. **修改构建脚本**
   
编辑 `build-and-push.ps1`：
```powershell
$REGISTRY = "registry.cn-hangzhou.aliyuncs.com"  # 改为你的区域
$NAMESPACE = "mycompany"  # 改为你的命名空间
```

3. **执行推送**
```powershell
.\build-and-push.ps1
```

脚本会自动：
- ✅ 构建 Server 镜像
- ✅ 构建 Web 镜像
- ✅ 打标签
- ✅ 推送到阿里云

---

### 第三步：NAS Docker 部署

1. **在 NAS 上创建部署目录**
```bash
mkdir -p /volume1/docker/admin-platform
cd /volume1/docker/admin-platform
```

2. **上传配置文件**
从本地上传以下文件到 NAS：
- `docker-compose.prod.yml`
- `env.template`（复制为 `.env.prod`）

3. **修改生产配置**

编辑 `docker-compose.prod.yml`：
```yaml
services:
  server:
    image: registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-server:latest
  web:
    image: registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-web:latest
```

编辑 `.env.prod`：
```env
JWT_SECRET=生产环境的强随机密钥
NEXT_PUBLIC_API_URL=http://你的NAS_IP:4000
```

4. **登录阿里云镜像仓库**
```bash
docker login registry.cn-hangzhou.aliyuncs.com
```

5. **拉取并启动**
```bash
# 拉取镜像
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-server:latest
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-web:latest

# 启动服务
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 查看状态
docker compose -f docker-compose.prod.yml ps
```

6. **访问服务**
- 前端：`http://你的NAS_IP:3000`
- 后端：`http://你的NAS_IP:4000`

---

## 📁 项目文件结构

```
admin-platform/
├── 📄 文档
│   ├── DOCKER_README.md              # Docker 文档索引（从这里开始）
│   ├── QUICK_START.md                # 3 分钟快速指南
│   ├── DOCKER_DEPLOY_GUIDE.md        # 详细部署指南
│   ├── DEPLOYMENT_CHECKLIST.md       # 部署检查清单
│   └── DOCKER使用指南.md             # 本文档
│
├── ⚙️ Docker 配置
│   ├── docker-compose.yml            # 开发环境配置
│   ├── docker-compose.prod.yml       # 生产环境配置
│   ├── server/Dockerfile             # 后端镜像
│   └── web/Dockerfile                # 前端镜像
│
├── 🔧 环境变量
│   ├── env.template                  # 环境变量模板
│   ├── .env                          # 本地环境变量（不提交）
│   └── .env.prod                     # 生产环境变量（不提交）
│
├── 🚀 自动化脚本
│   ├── build-and-push.ps1            # Windows 构建推送
│   ├── build-and-push.sh             # Linux/Mac 构建推送
│   └── deploy-to-nas.sh              # NAS 一键部署
│
└── 💻 源代码
    ├── server/                       # 后端代码
    └── web/                          # 前端代码
```

---

## 🔄 日常使用场景

### 场景 1：本地开发和调试

```powershell
# 启动开发环境
cd admin-platform
docker compose up -d

# 查看日志
docker compose logs -f server

# 停止环境
docker compose down
```

### 场景 2：代码更新后推送新版本

```powershell
# 1. 本地测试
docker compose up -d --build

# 2. 测试通过后推送
.\build-and-push.ps1 v1.0.1

# 3. 在 NAS 上更新
# SSH 到 NAS
docker pull registry.cn-hangzhou.aliyuncs.com/命名空间/admin-platform-server:v1.0.1
docker pull registry.cn-hangzhou.aliyuncs.com/命名空间/admin-platform-web:v1.0.1
docker compose -f docker-compose.prod.yml up -d
```

### 场景 3：查看 NAS 上的运行状态

```bash
# SSH 到 NAS
cd /volume1/docker/admin-platform

# 查看容器状态
docker compose -f docker-compose.prod.yml ps

# 查看实时日志
docker compose -f docker-compose.prod.yml logs -f

# 查看资源使用
docker stats

# 重启服务
docker compose -f docker-compose.prod.yml restart
```

### 场景 4：数据备份

```bash
# 备份 MongoDB
docker exec admin-platform-mongo mongodump --out /backup

# 将备份复制到宿主机
docker cp admin-platform-mongo:/backup ./mongo-backup-$(date +%Y%m%d)

# 备份文件存储
tar -czf metaclassroom-backup-$(date +%Y%m%d).tar.gz /volume1/metaclassroom
```

### 场景 5：故障排查

```bash
# 查看所有容器
docker ps -a

# 查看特定容器日志
docker logs admin-platform-server

# 进入容器调试
docker exec -it admin-platform-server sh

# 检查网络连接
docker network inspect admin-platform_admin-network

# 检查数据卷
docker volume ls
docker volume inspect admin-platform_mongo-data
```

---

## 🔑 关键配置说明

### 1. 镜像仓库地址

根据您的阿里云区域选择：
- 华北2（北京）：`registry.cn-beijing.aliyuncs.com`
- 华东1（杭州）：`registry.cn-hangzhou.aliyuncs.com`
- 华东2（上海）：`registry.cn-shanghai.aliyuncs.com`
- 华南1（深圳）：`registry.cn-shenzhen.aliyuncs.com`

### 2. 环境变量

**必须修改的变量：**
- `JWT_SECRET` - 每个环境使用不同的强随机密钥
- `NEXT_PUBLIC_API_URL` - 前端访问后端的地址
- `STORAGE_ROOT` - 文件存储路径

**生成强密钥的方法：**
```powershell
# PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 3. 端口映射

默认端口：
- MongoDB: 27017（建议仅容器内部访问）
- Server: 4000（后端 API）
- Web: 3000（前端页面）

如需修改，编辑 `docker-compose.yml` 中的 `ports` 部分。

### 4. 数据持久化

重要数据卷：
- `mongo-data` - MongoDB 数据
- 文件存储目录 - 用户上传的文件

**⚠️ 警告：** 不要使用 `docker compose down -v`，这会删除数据卷！

---

## 🛡️ 安全最佳实践

### 开发环境
- ✅ 使用 localhost 访问
- ✅ 不要暴露到公网
- ✅ 使用不同于生产环境的密钥

### 生产环境（NAS）
- ✅ 修改所有默认密码和密钥
- ✅ MongoDB 不要暴露到公网
- ✅ 使用 Nginx 反向代理 + HTTPS
- ✅ 配置防火墙规则
- ✅ 定期备份数据
- ✅ 定期更新镜像和依赖
- ✅ 设置日志监控和告警

### Nginx 反向代理配置示例

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 📊 性能优化建议

### 1. 资源限制
在 `docker-compose.prod.yml` 中添加：
```yaml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 2. 日志管理
```yaml
services:
  server:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 3. 健康检查
已在 `docker-compose.prod.yml` 中配置，会自动重启失败的容器。

---

## 🆘 常见问题

### Q1: 容器无法启动
**A:** 检查日志
```bash
docker compose logs server
docker compose logs web
docker compose logs mongo
```

常见原因：
- 端口被占用
- 环境变量配置错误
- 数据卷权限问题

### Q2: 前端无法连接后端
**A:** 检查 `NEXT_PUBLIC_API_URL` 配置
- 开发环境：`http://localhost:4000`
- 生产环境：`http://NAS_IP:4000` 或域名

### Q3: 文件上传失败
**A:** 检查存储路径
- 确认 `STORAGE_ROOT` 路径存在
- 确认容器有写权限
- 检查磁盘空间

### Q4: NAS 上拉取镜像失败
**A:** 
1. 确认已登录：`docker login registry.cn-hangzhou.aliyuncs.com`
2. 检查镜像仓库权限（公开/私有）
3. 检查网络连接

### Q5: MongoDB 数据丢失
**A:** 
- 不要使用 `docker compose down -v`
- 确认数据卷正确挂载
- 定期备份数据

---

## 📞 获取帮助

### 文档资源
1. **快速参考**：[QUICK_START.md](./QUICK_START.md)
2. **详细指南**：[DOCKER_DEPLOY_GUIDE.md](./DOCKER_DEPLOY_GUIDE.md)
3. **部署清单**：[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
4. **文档索引**：[DOCKER_README.md](./DOCKER_README.md)

### 常用命令速查
```bash
# 启动
docker compose up -d

# 停止
docker compose down

# 重启
docker compose restart

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f

# 进入容器
docker exec -it admin-platform-server sh

# 更新服务
docker compose up -d --pull always
```

---

## ✅ 总结

您的部署方案**完全可行且推荐使用**：

1. ✅ **本地 Docker 开发** - 环境一致，快速启动
2. ✅ **阿里云镜像仓库** - 版本管理，安全可靠
3. ✅ **NAS Docker 部署** - 资源隔离，易于管理

**优势：**
- 🎯 环境一致性（开发 = 生产）
- 🚀 快速部署和回滚
- 📦 版本管理和镜像复用
- 🔒 容器隔离和安全性
- 📈 易于扩展和维护

**现在就开始吧！**
```powershell
# 第一步：本地测试
docker compose up -d --build

# 第二步：推送镜像
.\build-and-push.ps1

# 第三步：NAS 部署
# （在 NAS 上执行部署命令）
```

祝您部署顺利！🎉

