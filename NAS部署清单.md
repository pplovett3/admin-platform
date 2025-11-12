# 🚀 绿联NAS快速部署清单

## ✅ 部署前准备

### 1. 本地推送镜像到阿里云（已在本地完成）

按照上方显示的命令执行：

```bash
# 1. 登录阿里云
docker login registry.cn-shanghai.aliyuncs.com

# 2. 标记和推送镜像
$VERSION = "v1.0.0"
$REGISTRY = "registry.cn-shanghai.aliyuncs.com"
$NAMESPACE = "admin-platform"

docker tag admin-platform-server:latest $REGISTRY/$NAMESPACE/admin-platform-server:$VERSION
docker tag admin-platform-web:latest $REGISTRY/$NAMESPACE/admin-platform-web:$VERSION

docker push $REGISTRY/$NAMESPACE/admin-platform-server:$VERSION
docker push $REGISTRY/$NAMESPACE/admin-platform-web:$VERSION
```

**✅ 确认推送成功**：访问阿里云控制台查看镜像
- https://cr.console.aliyun.com/cn-shanghai/instances

---

## 📦 NAS部署步骤

### 第一步：连接到NAS

**方式1：SSH连接**
```bash
ssh admin@你的NAS局域网IP
# 例如：ssh admin@192.168.1.100
```

**方式2：NAS Web界面**
- 使用NAS的文件管理器和Docker管理工具

---

### 第二步：创建目录结构

```bash
# 创建项目目录
mkdir -p /volume1/docker/admin-platform

# 创建数据目录
mkdir -p /volume1/docker/admin-platform/mongodb
mkdir -p /volume1/docker/admin-platform/storage

# 设置权限
chmod -R 755 /volume1/docker/admin-platform
```

---

### 第三步：上传配置文件

将本地的 `docker-compose.nas.yml` 上传到NAS：

**目标路径**：`/volume1/docker/admin-platform/docker-compose.yml`

**上传方式**：
- 通过NAS Web界面上传
- 使用SCP：`scp docker-compose.nas.yml admin@NAS_IP:/volume1/docker/admin-platform/docker-compose.yml`
- 使用FTP/SFTP工具（如FileZilla）

---

### 第四步：修改配置文件

编辑 `/volume1/docker/admin-platform/docker-compose.yml`，修改以下内容：

#### 必须修改的配置项：

1. **MongoDB密码**（第16行和第30行）：
   ```yaml
   # 第16行
   - MONGO_INITDB_ROOT_PASSWORD=你的MongoDB密码
   
   # 第30行
   - MONGODB_URI=mongodb://admin:你的MongoDB密码@mongo:27017/...
   ```

2. **JWT密钥**（第32行）：
   ```yaml
   - JWT_SECRET=随机生成的长字符串
   ```
   可以使用随机密码生成器，例如：`Kj8#mP2$nQ9@vL5&xR7^wT3!`

3. **NAS IP地址**（第59行）：
   ```yaml
   - NEXT_PUBLIC_API_URL=http://192.168.1.100:4000
   ```
   将 `192.168.1.100` 改为你的NAS实际IP

#### 可选修改的配置项：

- 存储路径（如果你的NAS不是 `/volume1`，需要调整）
- 端口号（如果3001或4000端口被占用）

---

### 第五步：登录阿里云镜像仓库

在NAS上执行：

```bash
docker login registry.cn-shanghai.aliyuncs.com
# 用户名：唐万羽（或你的阿里云账号）
# 密码：Tt19910805
```

---

### 第六步：启动服务

```bash
# 进入项目目录
cd /volume1/docker/admin-platform

# 拉取镜像（首次部署）
docker-compose pull

# 启动服务
docker-compose up -d

# 查看启动状态
docker-compose ps
```

**预期输出**：
```
NAME                      IMAGE                                                              STATUS
admin-platform-mongo      mongo:7.0                                                          Up
admin-platform-server     registry.cn-shanghai.aliyuncs.com/admin-platform/...               Up
admin-platform-web        registry.cn-shanghai.aliyuncs.com/admin-platform/...               Up
```

---

### 第七步：查看日志

```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f server
docker-compose logs -f web
docker-compose logs -f mongo
```

**正常日志示例**：
- Server: `Server is running on port 4000`
- Web: `ready - started server on 0.0.0.0:3000`
- Mongo: `Waiting for connections`

---

### 第八步：访问测试

1. **打开浏览器**访问：
   ```
   http://你的NAS_IP:3001
   ```

2. **使用默认账号登录**：
   - 用户名：`admin`
   - 密码：`admin123`

3. **测试功能**：
   - 上传资源
   - 创建课程
   - AI生成大纲
   - 发布课程

---

## 🔧 故障排查

### 问题1：容器无法启动

```bash
# 查看详细日志
docker-compose logs server
docker-compose logs web

# 检查配置文件语法
docker-compose config
```

**常见原因**：
- MongoDB密码不一致
- 端口被占用
- 存储路径权限不足

---

### 问题2：无法访问网页

**检查清单**：
- [ ] 容器是否运行：`docker ps`
- [ ] 端口是否开放：`netstat -tuln | grep 3001`
- [ ] 防火墙设置：允许3001和4000端口
- [ ] IP地址是否正确：检查 `NEXT_PUBLIC_API_URL`

---

### 问题3：镜像拉取失败

```bash
# 重新登录阿里云
docker login registry.cn-shanghai.aliyuncs.com

# 手动拉取镜像
docker pull registry.cn-shanghai.aliyuncs.com/admin-platform/admin-platform-server:v1.0.0
docker pull registry.cn-shanghai.aliyuncs.com/admin-platform/admin-platform-web:v1.0.0
```

---

### 问题4：MongoDB连接失败

检查 `docker-compose.yml` 中：
- [ ] `MONGO_INITDB_ROOT_PASSWORD` 是否设置
- [ ] `MONGODB_URI` 中的密码是否一致
- [ ] MongoDB容器是否正常运行

```bash
# 查看MongoDB日志
docker logs admin-platform-mongo

# 测试MongoDB连接
docker exec -it admin-platform-mongo mongosh -u admin -p 你的密码 --authenticationDatabase admin
```

---

## 🔄 维护操作

### 更新镜像

```bash
cd /volume1/docker/admin-platform

# 拉取最新镜像
docker-compose pull

# 重启服务
docker-compose down
docker-compose up -d
```

---

### 备份数据

```bash
# 备份MongoDB
docker exec admin-platform-mongo mongodump \
  --username admin \
  --password 你的密码 \
  --authenticationDatabase admin \
  --out /data/db/backup

# 复制到NAS
docker cp admin-platform-mongo:/data/db/backup \
  /volume1/docker/admin-platform/backup-$(date +%Y%m%d)

# 备份存储文件
tar -czf storage-backup-$(date +%Y%m%d).tar.gz \
  /volume1/docker/admin-platform/storage
```

---

### 恢复数据

```bash
# 恢复MongoDB
docker exec admin-platform-mongo mongorestore \
  --username admin \
  --password 你的密码 \
  --authenticationDatabase admin \
  /data/db/backup
```

---

## 📊 监控

### 查看资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
du -sh /volume1/docker/admin-platform/*
```

---

### 日志管理

```bash
# 限制日志大小（在docker-compose.yml中添加）
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## ✅ 部署完成检查清单

- [ ] MongoDB容器运行正常
- [ ] Server容器运行正常
- [ ] Web容器运行正常
- [ ] 可以访问 http://NAS_IP:3001
- [ ] 可以登录管理后台
- [ ] 文件上传功能正常
- [ ] AI功能测试通过
- [ ] 课程发布功能正常

---

## 🎉 完成！

部署成功后，你可以：
1. 在局域网内访问系统
2. 创建更多管理员账号
3. 配置定期备份任务
4. （可选）配置外网访问

如有问题，请查看日志：
```bash
docker-compose logs -f
```

祝使用愉快！🚀


