#### 步骤 1：在本地压缩文件

```powershell
# 进入项目目录
cd D:\Admin_Platform_Project\admin-platform

# 压缩 server 目录（Windows 10+ 自带 tar）
tar -czf server.tar.gz server

# 压缩 web 目录
tar -czf web.tar.gz web
```



ssh Tyrael@192.168.0.239
cd /volume1/docker/admin-platform

# 解压文件
tar -xzf server.tar.gz
tar -xzf web.tar.gz
rm server.tar.gz web.tar.gz

# 构建 server（更新 CORS）
cd server
docker build -t admin-platform-server:latest .
cd ..

# 构建 web（重要：使用内网地址，Next.js rewrites 会代理到内网后端）
cd web
docker build --build-arg NEXT_PUBLIC_API_URL=http://192.168.0.239:4000 -t admin-platform-web:latest .
cd ..

# 重启服务
docker compose down
docker compose up -d

# 查看日志
docker compose logs -f web