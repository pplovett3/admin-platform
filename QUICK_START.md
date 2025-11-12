# 快速开始指南

## 🚀 本地 Docker 测试（3 分钟）

### 1. 准备环境变量
```bash
# Windows PowerShell
cd admin-platform
Copy-Item env.template .env

# 编辑 .env 文件，至少修改以下内容：
# JWT_SECRET=你的随机密钥
# NEXT_PUBLIC_API_URL=http://localhost:4000
# STORAGE_ROOT=Y:\\metaclassroom（改为你的实际路径）
```

### 2. 启动服务
```bash
docker compose up -d --build
```

### 3. 访问应用
- 前端：http://localhost:3000
- 后端：http://localhost:4000/health
- 默认账号：13800000000 / admin123

---

## 📦 推送到阿里云镜像仓库

### 1. 配置脚本
编辑 `build-and-push.ps1` 或 `build-and-push.sh`，修改：
```powershell
$REGISTRY = "registry.cn-hangzhou.aliyuncs.com"  # 你的区域
$NAMESPACE = "mycompany"  # 你的命名空间
```

### 2. 执行推送
```bash
# Windows PowerShell
.\build-and-push.ps1

# Linux/Mac
chmod +x build-and-push.sh
./build-and-push.sh
```

---

## 🏠 NAS Docker 部署

### 1. 准备配置文件
在 NAS 创建目录：
```bash
mkdir -p /volume1/docker/admin-platform
cd /volume1/docker/admin-platform
```

上传以下文件到此目录：
- `docker-compose.prod.yml`
- `env.template`（复制为 `.env.prod` 并修改）

### 2. 修改配置
编辑 `docker-compose.prod.yml`，将镜像地址改为你的：
```yaml
image: registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-server:latest
```

编辑 `.env.prod`：
```env
JWT_SECRET=你的生产环境密钥
NEXT_PUBLIC_API_URL=http://你的NAS_IP:4000
```

### 3. 登录并拉取镜像
```bash
docker login registry.cn-hangzhou.aliyuncs.com
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-server:latest
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-web:latest
```

### 4. 启动服务
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 5. 查看状态
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

---

## 🔄 更新部署

### 本地更新代码后：
```bash
# 1. 重新构建推送
.\build-and-push.ps1 v1.0.1

# 2. NAS 拉取新镜像
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-server:v1.0.1

# 3. 更新 docker-compose.prod.yml 中的版本号
# 4. 重启服务
docker compose -f docker-compose.prod.yml up -d
```

---

## 📝 常用命令

```bash
# 查看日志
docker compose logs -f [server|web|mongo]

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 进入容器
docker exec -it admin-platform-server sh

# 备份数据库
docker exec admin-platform-mongo mongodump --out /backup

# 清理旧镜像
docker image prune -a
```

---

## ⚠️ 注意事项

1. **生产环境必须修改：**
   - JWT_SECRET（使用强随机字符串）
   - 默认管理员密码
   - MongoDB 不要暴露到公网

2. **数据备份：**
   - 定期备份 MongoDB 数据卷
   - 定期备份文件存储目录

3. **安全建议：**
   - 使用 Nginx 反向代理并配置 HTTPS
   - 配置防火墙规则
   - 定期更新镜像

---

详细文档请参考 [DOCKER_DEPLOY_GUIDE.md](./DOCKER_DEPLOY_GUIDE.md)

