# 🚀 NAS Docker 部署指南

## 📋 部署流程概览

```
本地Docker → 阿里云镜像仓库 → 绿联NAS Docker
```

---

## 第一步：推送镜像到阿里云

### 1.1 准备阿里云账号

1. **访问阿里云容器镜像服务**：https://cr.console.aliyun.com/
2. **创建命名空间**：
   - 进入"命名空间"
   - 点击"创建命名空间"
   - 命名空间名称：`admin-platform`（或自定义）
   - 选择公开或私有（建议私有）

3. **设置访问凭证**：
   - 进入"访问凭证"
   - 设置固定密码（记住这个密码）

### 1.2 执行推送脚本

在本目录下已创建 `push-to-aliyun.ps1`，执行：

```powershell
# 在 PowerShell 中执行
.\push-to-aliyun.ps1
```

或者手动执行以下命令：

```powershell
# 替换这些变量
$ALIYUN_REGION = "cn-hangzhou"  # 你的区域
$ALIYUN_NAMESPACE = "admin-platform"  # 你的命名空间
$VERSION = "v1.0.0"

# 登录阿里云
docker login registry.$ALIYUN_REGION.aliyuncs.com

# 标记并推送 server 镜像
docker tag admin-platform-server:latest registry.$ALIYUN_REGION.aliyuncs.com/$ALIYUN_NAMESPACE/admin-platform-server:$VERSION
docker push registry.$ALIYUN_REGION.aliyuncs.com/$ALIYUN_NAMESPACE/admin-platform-server:$VERSION

# 标记并推送 web 镜像
docker tag admin-platform-web:latest registry.$ALIYUN_REGION.aliyuncs.com/$ALIYUN_NAMESPACE/admin-platform-web:$VERSION
docker push registry.$ALIYUN_REGION.aliyuncs.com/$ALIYUN_NAMESPACE/admin-platform-web:$VERSION
```

---

## 第二步：在NAS上部署

### 2.1 准备NAS环境

1. **确保NAS已安装Docker**
   - 绿联NAS通常在"应用管理"中可以安装Docker
   - 确认Docker和Docker Compose已启动

2. **创建存储目录**（通过NAS文件管理器或SSH）
   ```bash
   mkdir -p /volume1/docker/admin-platform/mongodb
   mkdir -p /volume1/docker/admin-platform/storage
   ```

### 2.2 创建 docker-compose.yml

在NAS上创建文件 `/volume1/docker/admin-platform/docker-compose.yml`：

```yaml
version: '3.8'

services:
  mongo:
    image: mongo:7.0
    container_name: admin-platform-mongo
    restart: unless-stopped
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=Change_This_Password_123
    volumes:
      - /volume1/docker/admin-platform/mongodb:/data/db
    networks:
      - admin-platform-network

  server:
    image: registry.cn-hangzhou.aliyuncs.com/admin-platform/admin-platform-server:v1.0.0
    container_name: admin-platform-server
    restart: unless-stopped
    depends_on:
      - mongo
    environment:
      - NODE_ENV=production
      - PORT=4000
      - MONGODB_URI=mongodb://admin:Change_This_Password_123@mongo:27017/admin-platform?authSource=admin
      - JWT_SECRET=Change_This_JWT_Secret_In_Production
      - STORAGE_ROOT=/storage
      - DEEPSEEK_API_KEY=sk-a5cc44206c5d411cbb633cd73a6c8bd0
      - METASO_API_KEY=mk-53C55DF41C6C448FD0BA54190CDA2A2F
      - MINIMAX_API_KEY=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
      - MINIMAX_BASE_URL=https://api.minimaxi.com
      - AZURE_SPEECH_KEY=7d4ffd0999c5467aa2dc8c1b4467ace6
      - AZURE_SPEECH_REGION=eastasia
      - FRONTEND_PORT=3001
    volumes:
      - /volume1/docker/admin-platform/storage:/storage
    ports:
      - "4000:4000"
    networks:
      - admin-platform-network

  web:
    image: registry.cn-hangzhou.aliyuncs.com/admin-platform/admin-platform-web:v1.0.0
    container_name: admin-platform-web
    restart: unless-stopped
    depends_on:
      - server
    environment:
      - NEXT_PUBLIC_API_URL=http://你的NAS局域网IP:4000
    ports:
      - "3001:3000"
    networks:
      - admin-platform-network

networks:
  admin-platform-network:
    driver: bridge
```

### 2.3 重要配置项说明

需要修改的地方：

1. **MongoDB密码**：`MONGO_INITDB_ROOT_PASSWORD` 和 `MONGODB_URI` 中的密码
2. **JWT密钥**：`JWT_SECRET`
3. **API地址**：`NEXT_PUBLIC_API_URL` 改为你的NAS IP，例如 `http://192.168.1.100:4000`
4. **镜像地址**：替换为你实际的阿里云镜像地址
5. **存储路径**：根据NAS实际路径调整 `/volume1/docker/admin-platform`

### 2.4 启动服务

方式一：通过SSH连接NAS

```bash
# SSH连接到NAS
ssh admin@你的NAS_IP

# 进入目录
cd /volume1/docker/admin-platform

# 登录阿里云镜像仓库（私有仓库需要）
docker login registry.cn-hangzhou.aliyuncs.com

# 启动服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

方式二：通过绿联NAS Docker管理界面

1. 进入NAS的Docker管理界面
2. 导入 docker-compose.yml
3. 启动容器栈

---

## 第三步：验证部署

### 3.1 检查容器状态

```bash
docker ps
```

应该看到三个运行中的容器：
- `admin-platform-mongo`
- `admin-platform-server`
- `admin-platform-web`

### 3.2 访问系统

在浏览器中访问：
```
http://你的NAS局域网IP:3001
```

默认管理员账号：
- 用户名：`admin`
- 密码：`admin123`

### 3.3 检查日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f server
docker-compose logs -f web
```

---

## 🔧 常见问题

### Q1: 容器无法启动？
```bash
# 查看详细日志
docker-compose logs server
docker-compose logs web
```

### Q2: 无法访问网页？
- 检查防火墙是否开放 3001 和 4000 端口
- 确认 `NEXT_PUBLIC_API_URL` 使用正确的IP
- 检查容器是否正常运行：`docker ps`

### Q3: MongoDB连接失败？
- 检查 `MONGODB_URI` 中的密码是否与 `MONGO_INITDB_ROOT_PASSWORD` 一致
- 确认MongoDB容器已启动：`docker logs admin-platform-mongo`

### Q4: 文件上传失败？
- 检查存储目录权限
- 确认卷挂载配置正确：`/volume1/docker/admin-platform/storage:/storage`

### Q5: 镜像拉取失败？
```bash
# 重新登录阿里云
docker login registry.cn-hangzhou.aliyuncs.com

# 手动拉取镜像
docker pull registry.cn-hangzhou.aliyuncs.com/admin-platform/admin-platform-server:v1.0.0
docker pull registry.cn-hangzhou.aliyuncs.com/admin-platform/admin-platform-web:v1.0.0
```

---

## 🔄 更新部署

当有新版本时：

```bash
# 1. 在本地推送新版本到阿里云
.\push-to-aliyun.ps1

# 2. 在NAS上拉取新镜像
docker-compose pull

# 3. 重启服务
docker-compose down
docker-compose up -d
```

---

## 📊 监控和维护

### 备份MongoDB数据

```bash
# 导出数据
docker exec admin-platform-mongo mongodump --username admin --password your_password --authenticationDatabase admin --out /data/db/backup

# 复制到NAS
docker cp admin-platform-mongo:/data/db/backup /volume1/docker/admin-platform/backup
```

### 清理旧数据

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune
```

---

## 🌐 外网访问（可选）

如果需要从外网访问：

1. **配置NAS端口转发**：在路由器中将 3001 和 4000 端口转发到NAS
2. **使用域名**：配置DDNS并更新 `NEXT_PUBLIC_API_URL`
3. **HTTPS配置**：建议使用Nginx反向代理 + Let's Encrypt证书

---

## 📞 技术支持

遇到问题？检查：
1. Docker日志：`docker-compose logs -f`
2. 网络连接：`ping nas-ip`
3. 端口占用：`netstat -an | grep 3001`

完成！🎉


