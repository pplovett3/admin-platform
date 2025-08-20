# 更新部署指南（Windows 服务器 + NSSM + Git）

cd "E:\上信校产线动画\admin-platform"

# 可先看下有哪些改动
git status

# 提交并推送（请改成你的提交说明）
git add -A
git commit -m "chore: update code"
git pull --rebase origin main
git push origin main

> 适用于此前按指南在 Windows 上用 NSSM 注册了两个服务：`AdminPlatform-API` 和 `AdminPlatform-Web`。

## 快速更新（每次上线）
```powershell
# 1) 停服务并拉取最新代码
nssm stop AdminPlatform-Web
nssm stop AdminPlatform-API

cd C:\admin-platform
git pull

# 2) 后端更新与重启
cd C:\admin-platform\server
npm ci
npm run build
nssm start AdminPlatform-API

# 3) 前端更新与重启
cd C:\admin-platform\web
$env:NEXT_PUBLIC_API_URL="http://106.15.229.165:4000"
npm ci --legacy-peer-deps
npm run build
nssm set AdminPlatform-Web AppEnvironmentExtra "NEXT_PUBLIC_API_URL=http://106.15.229.165:4000"
nssm start AdminPlatform-Web

# 4) 健康检查（后端）
Invoke-WebRequest http://127.0.0.1:4000/health -UseBasicParsing
```

## 只改后端时
```powershell
nssm stop AdminPlatform-API
cd C:\admin-platform
git pull
cd C:\admin-platform\server
npm ci
npm run build
nssm start AdminPlatform-API
```

## 只改前端时
```powershell
nssm stop AdminPlatform-Web
cd C:\admin-platform
git pull
cd C:\admin-platform\web
npm ci --legacy-peer-deps
npm run build
nssm start AdminPlatform-Web
```

## 常见问题
- 前端 `npm ci` 报 ERESOLVE（eslint 版本冲突）
  - 临时解决：`npm ci --legacy-peer-deps`
  - 根治方案：在本地将 `web/package.json` 的 `eslint` 降到 `^8.57.1` 后再推送。
- 端口不通：
  - Windows 防火墙放行 3000/4000：
    ```powershell
    netsh advfirewall firewall add rule name='AdminPlatform API 4000' dir=in action=allow protocol=TCP localport=4000 profile=any
    netsh advfirewall firewall add rule name='AdminPlatform Web 3000' dir=in action=allow protocol=TCP localport=3000 profile=any
    ```
  - 阿里云安全组为当前实例绑定的所有安全组放行相应端口（入方向 TCP 3000/4000）。

## 查看日志与服务管理
```powershell
# 查看服务状态
Get-Service AdminPlatform-API,AdminPlatform-Web

# 查看运行日志（尾部跟随）
Get-Content -Wait C:\admin-platform\server\run.log
Get-Content -Wait C:\admin-platform\web\run.log

# 重启/停止服务
nssm restart AdminPlatform-API
nssm restart AdminPlatform-Web
nssm stop AdminPlatform-API
nssm stop AdminPlatform-Web
```

## 一键更新脚本（可选）
保存为 `C:\admin-platform\update-all.ps1` 后右键“以管理员身份运行”：
```powershell
nssm stop AdminPlatform-Web
nssm stop AdminPlatform-API

cd C:\admin-platform
git pull

cd C:\admin-platform\server
npm ci
npm run build

cd C:\admin-platform\web
npm ci --legacy-peer-deps
npm run build

nssm start AdminPlatform-API
nssm start AdminPlatform-Web

try { Invoke-WebRequest http://127.0.0.1:4000/health -UseBasicParsing | Out-Null; "API OK" } catch { "API FAIL" }
```

## 环境变量与服务
- 后端 `.env`（路径 `C:\admin-platform\server\.env`）
  - `PORT=4000`
  - `MONGODB_URI=mongodb://127.0.0.1:27017/admin_platform`
  - `JWT_SECRET=change_me_prod`
- 前端（可选）：`AdminPlatform-Web` 服务可设置 `AppEnvironmentExtra` 为 `NEXT_PUBLIC_API_URL=http://<你的IP或域名>:4000` 