## 绿联 NAS + Nginx 静态资源 403/404 排查与修复指南

适用场景：将 NAS 共享目录映射到 Nginx 容器，提供内网/直链静态访问（图片/视频/GLB 等）。

### 常见现象
- 访问根路径返回 403 Forbidden
- 访问具体文件返回 404 Not Found 或 403 Forbidden
- 同一文件在容器内 `cat` 正常，但浏览器访问异常

### 根因总结（本次问题最终原因）
1) 站点配置未被 Nginx 实际加载（写错目录：alpine 用 `/etc/nginx/http.d/`，Debian/官方版用 `/etc/nginx/conf.d/`；或被系统默认站点覆盖）。
2) 根路径无 `index.html` 且未开启 `autoindex`，访问 `/` 直接 403。
3) 共享目录/文件对 Nginx 用户（`nginx`）无读/遍历权限，导致 403。

### 快速决策树
1) 确认容器映射：将 NAS 目录映射到 `/usr/share/nginx/html`（或你约定的根）。
2) 写入最小可用配置（根据镜像类型选择路径）并重载：
   - Debian/官方版：`/etc/nginx/conf.d/default.conf`
   - Alpine：`/etc/nginx/http.d/default.conf`
3) 若 `nginx -t` 通过但仍异常，进一步最小化 `/etc/nginx/nginx.conf`，只保留一个 `server` 块，排除默认站点覆盖。
4) 若 `/__ping` 200 但 `/health.txt` 403，修复共享目录权限（`chmod -R a+rX` 或 `chown -R nginx:nginx`）。

---

## 一、容器映射规范
- 推荐将 NAS 目录映射为：
  - NAS：`/volume1/data` 或 `/volume1/data/metaclassroom`
  - 容器：`/usr/share/nginx/html`（站点根）
  - 权限：读写/只读均可（只读更安全，排障时可先读写）
- 路径规则：若映射为 `/volume1/data/metaclassroom → /usr/share/nginx/html`，访问 URL 从 `/` 开始，不再带 `metaclassroom` 前缀。

## 二、最小可用配置（两类镜像）

### 方案 A：Debian/官方版（conf.d）
将以下内容写入容器内 `/etc/nginx/conf.d/default.conf`：
```nginx
server {
    listen 80 default_server;
    server_name _;
    root /usr/share/nginx/html;
    autoindex on;
    autoindex_exact_size off;
    autoindex_localtime on;
    location / { try_files $uri $uri/ =404; }
}
```

### 方案 B：Alpine（http.d）
将相同内容写入 `/etc/nginx/http.d/default.conf`。

写完后执行：
```sh
nginx -t && nginx -s reload
```

> 若仍被默认站点覆盖，可将主配置最小化（仅保留一个 server）：编辑 `/etc/nginx/nginx.conf`，参照“附录A 最小化 nginx.conf”。

## 三、健康检查与命中验证
容器内执行：
```sh
echo ok >/usr/share/nginx/html/health.txt
nginx -t && nginx -s reload
# 站点命中探针（可选，见附录A）
wget -S -O - http://127.0.0.1/health.txt      # 期望返回 ok
```
浏览器访问：
- 根目录（应列目录、不再 403）：`http://<NAS_IP>:<映射端口>/`
- 健康检查：`http://<NAS_IP>:<映射端口>/health.txt`
- 具体文件：从 `/` 开始拼接容器内真实子路径。

## 四、权限修复（403 的根因之一）
当 `/__ping` 200、配置已生效，但 `/health.txt` 或文件仍 403，多为权限/ACL 问题：

容器内快速修复：
```sh
chmod -R a+rX /usr/share/nginx/html
# 如仍不行（验证用）：
chown -R nginx:nginx /usr/share/nginx/html
nginx -s reload
```

若容器为 `user nginx;` 仍因 ACL 读取失败，可临时将 `user root;` 验证（仅排障用，修复后改回）：
```sh
sed -i 's/^user .*/user root;/' /etc/nginx/nginx.conf
nginx -s reload
# 验证后再改回：sed -i 's/^user .*/user nginx;/' /etc/nginx/nginx.conf && nginx -s reload
```

> 注意：NAS 服务账号对映射目录应有读/执行（遍历）权限；如是 SMB/NFS 共享，建议在共享面板为“所有人/访客”开放只读与遍历权限（或为容器运行用户授予访问权限）。

## 五、常见对照表
- 访问 `/` 403：开启 `autoindex on;` 或提供 `index.html`。
- 访问文件 404：
  - 路径不对（映射根与 URL 不匹配）；
  - 配置没生效（写错目录、被默认站点覆盖）；
  - 文件确实不存在（容器内 `ls`/`cat` 校验）。
- 访问文件 403：
  - 权限/ACL 不足（`chmod -R a+rX`、`chown -R nginx:nginx`）。

## 六、绿联面板操作要点
1) 容器 → 存储空间：确认“NAS目录 ↔ 容器目录”映射正确（示例：`/volume1/data → /usr/share/nginx/html`）。
2) 端口映射：如内网使用 8080→80。
3) 终端/控制台：选择 `/bin/sh` 进入容器执行上述命令（容器内无 `sudo`，无需 `docker exec`）。
4) 如需在宿主机执行，先开启 SSH，再使用：
   ```sh
   ssh <admin@NAS_IP>
   sudo docker exec <容器名> sh -c '...你的命令...'
   ```

## 七、与平台后端的协同（可选）
- 若直链域名无法改动或跨域受限，可通过平台后端提供受控代理：`GET /api/files/proxy?url=...`（白名单域名），前端使用代理 URL 即可绕过 CORS/同源限制。
- 后端直链/下载基址：
  - `STORAGE_ROOT` 指向统一的物理存储（建议 UNC 路径）；
  - `PUBLIC_VIEW_BASE`/`PUBLIC_DOWNLOAD_BASE` 用于生成资源直链，需要与 Nginx/对象存储一致。

---

## 附录A：最小化 nginx.conf（强制仅启用单站点）
适用于“默认站点覆盖/配置目录不确定”场景：
```nginx
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

events { worker_connections 1024; }

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log /var/log/nginx/access.log combined;
  sendfile on; keepalive_timeout 65;

  server {
    listen 80 default_server;
    server_name _;
    root /usr/share/nginx/html;

    # 命中探针
    location = /__ping { default_type text/plain; return 200 "pong\n"; }

    # 目录列表与基础 404 逻辑
    location / { autoindex on; try_files $uri $uri/ =404; }
  }
}
```

验证：
```sh
nginx -t && nginx -s reload
echo ok >/usr/share/nginx/html/health.txt
wget -S -O - http://127.0.0.1/__ping      # 返回 pong
wget -S -O - http://127.0.0.1/health.txt  # 返回 ok
```

---

## 附录B：常用排查命令
```sh
# 查看当前生效配置与 include 目录
nginx -T | sed -n '1,200p'

# 实时错误/访问日志
tail -n 100 /var/log/nginx/error.log
tail -n 100 /var/log/nginx/access.log

# 校验容器内文件存在性
ls -la /usr/share/nginx/html
ls -la /usr/share/nginx/html/<你的相对路径>
cat    /usr/share/nginx/html/<你的相对路径> >/dev/null && echo OK || echo FAIL
```

---

## 结论（遇到同类问题如何快速修复）
1) 对齐映射：确认 “NAS目录 → /usr/share/nginx/html”。
2) 写入最小可用站点配置（根据镜像写到 `conf.d` 或 `http.d`），`nginx -t && nginx -s reload`。
3) 若被覆盖，最小化 `/etc/nginx/nginx.conf` 只保留一个 `server`，并用 `/__ping` 验证命中。
4) 403：`chmod -R a+rX` 或 `chown -R nginx:nginx` 修复共享目录权限。
5) 404：校验路径/文件是否存在、URL 是否与映射规则一致。
6) 如需跨域或外链：使用后端受控代理 `/api/files/proxy` 或配置 `PUBLIC_VIEW_BASE` 直链与同一存储对齐。


