# 更新部署指南（Windows 服务器 + NSSM + Git）

cd "E:\上信校产线动画\admin-platform"

# 可先看下有哪些改动
git status

# 提交并推送（请改成你的提交说明）
git add -A
git commit -m "chore: update code"
git push origin main



git pull --rebase origin main
> 适用于此前按指南在 Windows 上用 NSSM 注册了两个服务：`AdminPlatform-API` 和 `AdminPlatform-Web`。

## Git 推送（SSH 走 443，适用于 HTTPS 被限制的网络）
1) 生成 SSH 密钥（建议用 Git Bash 执行）
```bash
ssh-keygen -t ed25519 -C "admin-platform"
# 连续回车，默认保存到 ~/.ssh/id_ed25519，并设置空密码
cat ~/.ssh/id_ed25519.pub   # 复制输出
```

2) 在 GitHub 添加公钥
- 头像 → Settings → SSH and GPG keys → New SSH key → 粘贴上一步输出

3) Windows 开启 ssh-agent 并加载私钥
```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
ssh-add $env:USERPROFILE\.ssh\id_ed25519
```

4) 强制 GitHub 使用 443 端口（SSH over 443）
```powershell
@"
Host github.com
  HostName ssh.github.com
  Port 443
  User git
"@ | Set-Content $env:USERPROFILE\.ssh\config -Encoding ascii
```

5) 切换远程为 SSH 并测试连接
```powershell
git remote set-url origin git@github.com:pplovett3/admin-platform.git
ssh -T git@github.com   # 首次会提示 yes，看到 Hi <username>! 说明成功
```

6) 推送
```powershell
git push origin main
```

问题排查（Windows）
- 到 GitHub 443 不通：
  ```powershell
  Test-NetConnection ssh.github.com -Port 443
  ```
- 私钥/配置权限过宽（出现 Unprotected private key / Bad permissions）：
  ```powershell
  icacls $env:USERPROFILE\.ssh\id_ed25519 /inheritance:r
  icacls $env:USERPROFILE\.ssh\id_ed25519 /remove:g *S-1-1-0
  icacls $env:USERPROFILE\.ssh\id_ed25519 /grant:r "$env:USERNAME:(R)"
  icacls $env:USERPROFILE\.ssh\config /inheritance:r
  icacls $env:USERPROFILE\.ssh\config /remove:g *S-1-1-0
  icacls $env:USERPROFILE\.ssh\config /grant:r "$env:USERNAME:(R)"
  ```


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
# 优先使用 npm ci；如遇 lock 不一致或 swc 依赖补丁提示，请改用 npm install
npm ci --legacy-peer-deps
# 如果上一步报 EUSAGE / lock 不一致 / 要求先 npm install：
# npm install --legacy-peer-deps
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
/volume1/data/metaclassroom/users/689c46d6191b483b08e9c560/2025/08/68af080883f0e85a3dd4d11e/0_1.png
## 只改前端时
```powershell
nssm stop AdminPlatform-Web
cd C:\admin-platform
git pull
cd C:\admin-platform\web
# 优先使用 npm ci；若遇 EUSAGE/lock 不一致，使用 npm install --legacy-peer-deps
npm ci --legacy-peer-deps
# npm install --legacy-peer-deps
npm run build
nssm start AdminPlatform-Web
```

## 常见问题
- 前端 `npm ci` 报 ERESOLVE（eslint 版本冲突）
  - 临时解决：`npm ci --legacy-peer-deps`
  - 根治方案：在本地将 `web/package.json` 的 `eslint` 降到 `^8.57.1` 后再推送。
- 前端 `npm ci` 报 EUSAGE（package.json 与 lock 不一致）
  - 原因：新增依赖（如 three/@types/three）后 lock 未同步。
  - 处理：先执行 `npm install --legacy-peer-deps` 同步 lock，再 `npm run build`。
  - 提醒：请将 `web/package-lock.json` 一并提交推送。
- 构建期 SWC 提示：`Found lockfile missing swc dependencies, patching...`、让你执行 `npm install`
  - 按提示先执行一次 `npm install` 再 `npm run build`。
- Webpack ModuleConcatenationPlugin 报错（如 `TypeError: E.filter is not a function`）
  - 已在 `web/next.config.mjs` 中临时关闭 `optimization.concatenateModules` 以规避。
  - 若后续想恢复该优化，请先确认依赖冲突已解决再开启。

## 本次“三维课件编辑器”集成的部署注意事项
- 新增依赖：`three` 与 `@types/three`，需确保服务器执行过 `npm install` 同步 lock。
- 若此前服务器使用 `npm ci` 且报错，请按上文“常见问题”指引切换为 `npm install --legacy-peer-deps`。
- 新增页面：
  - 列表：`/admin/three-courseware`
  - 新建：`/admin/three-courseware/new`
  - 编辑：`/admin/three-courseware/[id]`
  - 快速编辑（资源直链）：`/admin/three-courseware/editor?src=<GLB直链>`
- 资源管理页（`/resources`）中的 GLB 支持一键“用三维课件编辑器打开”。
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





# 设定 App 路径/目录/参数（按你的 Node 安装路径调整）
nssm set AdminPlatform-API AppPath "C:\Program Files\nodejs\node.exe"
nssm set AdminPlatform-API AppDirectory "C:\admin-platform\server"
nssm set AdminPlatform-API AppParameters "dist/index.js"

# 建议设置日志输出
mkdir C:\admin-platform\server\logs -Force
nssm set AdminPlatform-API AppStdout C:\admin-platform\server\logs\run-server.out.log
nssm set AdminPlatform-API AppStderr C:\admin-platform\server\logs\run-server.err.log
nssm set AdminPlatform-API AppRotateFiles 1

# 确认状态并重启
nssm stop AdminPlatform-API
nssm start AdminPlatform-API







# 设置可执行程序（指向你的 node.exe）
nssm set AdminPlatform-API Application "C:\Program Files\nodejs\node.exe"

# 确认工作目录与参数（你已有）
nssm set AdminPlatform-API AppDirectory "C:\admin-platform\server"
nssm set AdminPlatform-API AppParameters "dist/index.js"

# 环境变量（你已有，确保包含 SEED_DEFAULT_ADMIN=false）
nssm set AdminPlatform-API AppEnvironmentExtra "PORT=4000;MONGODB_URI=mongodb://127.0.0.1:27017/admin_platform;JWT_SECRET=dev_secret_change_me;SEED_DEFAULT_ADMIN=false"

# 建议配置日志，便于排错
nssm set AdminPlatform-API AppStdout C:\admin-platform\server\run-server.out.log
nssm set AdminPlatform-API AppStderr C:\admin-platform\server\run-server.err.log
nssm set AdminPlatform-API AppRotateFiles 1