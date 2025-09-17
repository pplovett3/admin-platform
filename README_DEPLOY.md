# Admin Platform 部署指南（阿里云 ECS）

## 架构
- MongoDB（容器，持久化卷）
- 后端 Server（Node.js + Express，容器，端口 4000）
- 前端 Web（Next.js，容器，端口 3000）

## 先决条件
- 已安装 Docker 和 Docker Compose（Docker Desktop 或 Linux 上 docker+docker compose CLI）
- 开放安全组端口：80/443（若走 Nginx 反代）、3000（前端）、4000（后端）、27017（MongoDB，建议仅内网，不对公网暴露）

## 快速开始（Docker Compose）
1. 克隆代码到服务器：
   - `git clone <repo>` 或把本目录上传到服务器，例如 `/opt/admin-platform`
2. 配置环境变量（可选）：
   - `JWT_SECRET`：JWT 密钥，默认 `change_me`，建议设置强随机
   - `NEXT_PUBLIC_API_URL`：前端调用后端地址，默认 `http://localhost:4000`
3. 启动：
   ```bash
   cd admin-platform
   docker compose up -d --build
   ```
4. 访问：
   - 前端：`http://<ECS公网IP>:3000`
   - 后端健康检查：`http://<ECS公网IP>:4000/health` → `{ ok: true }`
5. 首次登录：
   - 账号：手机号 `13800000000`
   - 密码：`admin123`

## 生产建议
- 使用 Nginx 反向代理：将域名 `admin.example.com` 指到前端容器 3000，将 `/api` 代理到后端容器 4000
- 配置 HTTPS：用 Certbot/阿里云证书给 Nginx 加证书
- MongoDB 不要暴露公网端口，`docker-compose.yml` 可移除 `27017:27017` 映射，仅容器内部访问
- 备份：挂载 `mongo-data` 卷并做定期备份

## 常用操作
- 查看日志：`docker compose logs -f server` / `web` / `mongo`
- 重启服务：`docker compose restart server web`
- 更新代码后重建：`docker compose up -d --build`

## 环境变量说明
- Server：
  - `PORT`：默认 4000
  - `MONGODB_URI`：默认 `mongodb://mongo:27017/admin_platform`
  - `JWT_SECRET`：默认 `change_me`
- Web：
  - `NEXT_PUBLIC_API_URL`：默认 `http://localhost:4000`
  - 生产环境需要设置为实际后端地址，如：`http://106.15.229.165:4000`

## 域名与反代示例（Nginx）
将以下片段放到 Nginx `server` 配置中（以 `admin.example.com` 为例）：
```
server {
    listen 80;
    server_name admin.example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```
将 127.0.0.1 改成前端/后端容器映射的宿主机地址与端口（当前 compose 暴露了 3000/4000）。如启用 HTTPS，请把 `listen 80` 与证书配置改成 443 并添加 `ssl_certificate` 等。 