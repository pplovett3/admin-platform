# 平台用户登录接口 — 对接 API 文档

> 用途：第三方项目对接本平台的**用户登录/账号体系**（统一用平台账号登录）。
> 适用范围：登录校验、获取用户身份（角色/学校/班级）、拿到访问令牌（JWT）。

---

## 一、接入地址（Base URL）

| 场景 | Base URL |
|---|---|
| 校园内网 · 直连后端 | `http://172.17.136.200:4000` |
| 校园内网 · 经前端代理 | `http://172.17.136.200:3001`（`/api/*` 自动转发到后端） |
| 公网（Cloudflare Tunnel） | `https://api.platform.yf-xr.com` |

> 推荐**服务端到服务端**调用走 `:4000` 或公网后端域名。浏览器前端直连见下方「跨域(CORS)」说明。

---

## 二、登录接口

### `POST /api/auth/login`

用手机号 + 密码登录，成功返回 JWT 令牌与用户信息。

#### 请求头

```
Content-Type: application/json
```

#### 请求体

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `phone` | string | 是 | 登录手机号（平台账号唯一标识） |
| `password` | string | 是 | 登录密码（明文，走 HTTPS 传输） |
| `courseId` | string | 否 | 课程授权校验。传入后会校验「该用户所属学校是否被授权该课程」，未授权返回 403。可传课程的 `id` / `code` / `name`。仅对 `student`/`teacher` 角色生效。**普通登录不要传此字段。** |

#### 请求示例

```bash
curl -X POST http://172.17.136.200:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","password":"admin123"}'
```

#### 成功响应 `200 OK`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "6a155b4d9e8255bf2ae3999e",
    "name": "张三",
    "role": "student",
    "className": "2024级水利1班",
    "school": "水利水电职业技术学院",
    "schoolId": "6a13...e21",
    "phone": "13800000000",
    "metaverseAllowed": false
  },
  "myFiles": [
    {
      "id": "6a1d...baf",
      "type": "model",
      "originalName": "钻机.glb",
      "size": 44304720,
      "createdAt": "2026-06-01T07:53:00.000Z",
      "downloadUrl": "/api/files/6a1d...baf/download"
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `token` | JWT 访问令牌，有效期 **7 天**。后续请求放在 `Authorization: Bearer <token>` 头里 |
| `user.id` | 用户唯一 ID |
| `user.role` | 角色，枚举见第四节 |
| `user.className` | 班级名（学生/教师可能有） |
| `user.school` / `user.schoolId` | 所属学校名 / ID |
| `user.metaverseAllowed` | 是否允许进入元宇宙大厅 |
| `myFiles` | 该用户最近 20 个上传文件（如不需要可忽略） |

#### 失败响应

| 状态码 | body | 含义 |
|---|---|---|
| `400` | `{"message":"phone and password are required"}` | 缺少手机号或密码 |
| `401` | `{"message":"Invalid credentials"}` | 手机号不存在或密码错误 |
| `403` | `{"message":"No school assigned for user"}` | 传了 `courseId` 但用户无学校 |
| `403` | `{"message":"Course not found by id/code/name"}` | 传了 `courseId` 但课程不存在 |
| `403` | `{"message":"Course not authorized for your school"}` | 课程未授权给该用户所属学校 |

---

## 三、令牌（JWT）的使用与校验

### 3.1 携带令牌访问受保护接口

```
Authorization: Bearer <token>
```

### 3.2 令牌内容（payload）

`token` 是标准 JWT（HS256 签名）。Base64 解出 payload 即可拿到用户身份，无需再查库：

```json
{
  "userId": "6a155b4d9e8255bf2ae3999e",
  "role": "student",
  "className": "2024级水利1班",
  "school": "水利水电职业技术学院",
  "schoolId": "6a13...e21",
  "name": "张三",
  "phone": "13800000000",
  "metaverseAllowed": false,
  "iat": 1717225200,
  "exp": 1717830000
}
```

### 3.3 其它项目如何校验登录态

平台**当前没有独立的 `/me` 或 `/verify` 接口**，登录响应本身已返回完整 `user`。校验登录态有两种方式：

- **方式 A（推荐，最简单）**：你的项目调用 `POST /api/auth/login` 成功后，直接信任返回的 `user` 与 `token`，自行保存会话即可。
- **方式 B（服务端校验 JWT 签名）**：用平台的 **JWT 密钥**（`JWT_SECRET`，在平台 `.env` 中，需向平台管理员索取并妥善保管）在你的后端用 HS256 验签，验签通过即令牌有效，从 payload 取用户信息。示例（Node.js）：

```js
const jwt = require('jsonwebtoken');
try {
  const payload = jwt.verify(token, process.env.PLATFORM_JWT_SECRET); // 与平台同一个密钥
  // payload.userId / payload.role / payload.phone ...
} catch (e) {
  // 令牌无效或过期
}
```

> ⚠️ JWT 密钥属于敏感凭据，只能放在你项目的**后端**，绝不能下发到前端/客户端。

> 如果你更希望平台提供一个标准的「校验令牌 / 获取当前用户」接口（如 `GET /api/auth/me`），告诉平台开发方，可以加。

---

## 四、资源 / 模型下载接口（供下载工具对接）

> 用途：第三方下载工具登录后，**列出可用模型并下载**。
> 资源分两类：
> - **公共资源**：仅超级管理员（`superadmin`）上传，**全平台所有登录用户可见、可下载**（学生可据此创建三维课件）。
> - **个人资源**：其他用户（教师/学生等）上传，**仅本人可见、可下载**（每人 5GB 配额；超管不限容量）。
>
> 以下接口均需在请求头携带登录拿到的令牌：`Authorization: Bearer <token>`。

### 4.1 获取**公共资源**模型列表

#### `GET /api/files/public`

返回全平台公共资源（所有登录用户都能调用，结果一致）。

##### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | string | 否 | 资源类型过滤。**下载模型时传 `model`**。枚举：`model`/`image`/`video`/`pdf`/`ppt`/`word`/`other` |
| `q` | string | 否 | 按文件名模糊搜索 |
| `page` | number | 否 | 页码，默认 `1` |
| `pageSize` | number | 否 | 每页条数，默认 `20`，**最大 `100`** |

##### 请求示例

```bash
curl "http://172.17.136.200:4000/api/files/public?type=model&pageSize=100" \
  -H "Authorization: Bearer <token>"
```

##### 成功响应 `200 OK`

```json
{
  "rows": [
    {
      "id": "6a1d...baf",
      "type": "模型",
      "originalName": "钻机.glb",
      "size": 44304720,
      "createdAt": "2026-06-01T07:53:00.000Z",
      "downloadUrl": "/api/files/6a1d...baf/download/%E9%92%BB%E6%9C%BA.glb",
      "viewUrl": null,
      "thumbnailUrl": "/api/files/6a1d...baf/cover"
    }
  ],
  "total": 12,
  "page": 1,
  "pageSize": 100
}
```

> 取全部：按 `total` 翻页，或把 `pageSize` 设到 `100` 多次请求直到取完。

### 4.2 获取**个人资源**模型列表

#### `GET /api/files/mine`

返回**当前登录用户自己**的资源（由 `token` 决定身份，他人不可见）。

##### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | string | 否 | 同上，下载模型传 `model` |
| `visibility` | string | 否 | `private`（默认，仅本人私有资源）/ `public`（本人上传的公共资源）/ `all`（本人全部） |
| `q` | string | 否 | 按文件名模糊搜索 |
| `folderId` | string | 否 | 文件夹 ID；传 `root` 或不传=全部目录 |
| `page` / `pageSize` | number | 否 | 分页，默认 `1` / `20`，`pageSize` 最大 `100` |

##### 请求示例

```bash
curl "http://172.17.136.200:4000/api/files/mine?type=model&pageSize=100" \
  -H "Authorization: Bearer <token>"
```

响应结构同 4.1（`rows/total/page/pageSize`），每行额外带 `visibility` 字段（`private`/`public`）。

### 4.3 字段说明（列表行 `rows[i]`）

| 字段 | 说明 |
|---|---|
| `id` | 文件唯一 ID，下载时使用 |
| `type` | 类型中文名（`模型`/`图片`/`视频`/`PDF`/`PPT`/`WORD`/`其他`）。**注意：这是展示用中文，与查询参数 `type` 的英文枚举不同** |
| `originalName` | 原始文件名（含扩展名，如 `钻机.glb`） |
| `size` | 文件字节数 |
| `createdAt` | 上传时间（ISO8601） |
| `downloadUrl` | 下载地址（见 4.4）。当前部署为相对路径 `/api/files/{id}/download/{文件名}`；若平台配置了公网静态域名则可能是绝对 URL（`https://...`） |
| `viewUrl` | 在线预览地址，未配置静态域名时为 `null`，下载工具忽略即可 |
| `thumbnailUrl` | **封面/截图地址**（见 4.7）。模型上传时系统自动生成截图作为封面；无封面时为 `null`。值为相对路径 `/api/files/{id}/cover`，拼上 `{BaseURL}` 即可直接 `<img>` 显示（**免登录**） |

### 4.4 下载模型文件

拿到列表后，有两种下载方式：

#### 方式 A（推荐，通用）：带 token 走鉴权下载接口

#### `GET /api/files/{id}/download`

- 需要 `Authorization: Bearer <token>`。
- 权限：**公共资源任意登录用户可下；个人资源仅拥有者本人（或超管）可下**。
- 支持 HTTP `Range` 断点续传（大模型推荐分块下载）。
- 响应为文件二进制流，`Content-Disposition` 头带文件名。

```bash
# 直接保存为本地文件
curl -L "http://172.17.136.200:4000/api/files/6a1d...baf/download" \
  -H "Authorization: Bearer <token>" \
  -o 钻机.glb
```

> 若列表里的 `downloadUrl` 是相对路径，拼接方式为 `{BaseURL}{downloadUrl}`，并同样带上 `Authorization` 头。
> 若 `downloadUrl` 已是绝对 `https://` 地址（平台启用了公网静态域名），则该地址为静态直链，可直接 GET 下载（一般无需 token）。

#### 方式 B（仅公共模型，免 token）：公开模型直链

#### `GET /api/files/public-model/{id}`

- **无需登录令牌**，方便纯下载工具拉取公共模型。
- 仅允许模型文件：`.glb` / `.gltf` / `.fbx` / `.obj`（其它类型返回 403）。
- 以附件形式（`Content-Disposition: attachment`）返回文件流，带 1 天缓存。

```bash
curl -L "http://172.17.136.200:4000/api/files/public-model/6a1d...baf" -o 钻机.glb
```

> 说明：平台上传时已统一把 `.fbx/.obj/.stl` 转换为 `.glb` 存储，因此**模型基本都是 `.glb`**，任何端（含 Unity）都能直接加载。

### 4.5 失败响应

| 状态码 | 含义 |
|---|---|
| `401` | 未带令牌或令牌无效/过期（4.1/4.2/方式 A） |
| `403` | 无权下载（个人资源非本人）；或 `public-model` 传了非模型文件 |
| `404` | 文件不存在，或磁盘上文件缺失 |

### 4.6 下载工具最小流程

1. `POST /api/auth/login` 登录拿 `token`。
2. 列模型：
   - 公共：`GET /api/files/public?type=model&pageSize=100`（按需翻页）。
   - 个人：`GET /api/files/mine?type=model&pageSize=100`。
3. 遍历 `rows`，对每个 `id`：
   - 公共模型可走 `GET /api/files/public-model/{id}`（免 token）；
   - 通用走 `GET /api/files/{id}/download`（带 `Authorization`）。
4. 用 `originalName` 作为保存文件名，`size` 可用于校验下载完整性。

### 4.7 模型封面 / 截图

模型在**首次上传时由系统自动生成一张截图作为封面**并存于服务器（之后可在平台「资源管理」里手动更换）。列表接口（4.1 / 4.2，及 Unity 的 `/client/*`）的每行都带 `thumbnailUrl` 字段，方便你的系统做**卡片封面**展示。

#### `GET /api/files/{id}/cover`

- **无需登录令牌**，可直接作为 `<img>` 的 `src`。
- 返回封面图片（PNG/JPG/WEBP），带 1 天缓存。
- 无封面时返回 `404`（你的前端可回退到占位图/类型图标）。

```html
<!-- 直接在你的系统里显示模型封面 -->
<img src="http://172.17.136.200:4000/api/files/6a1d...baf/cover" alt="模型封面" />
```

> 说明：`thumbnailUrl` 为相对路径时拼接 `{BaseURL}` 使用；该接口免鉴权，公共/个人模型的封面都可直接显示（封面本身不含敏感信息）。

---

## 五、角色枚举（`role`）

| 值 | 含义 |
|---|---|
| `superadmin` | 超级管理员 |
| `schoolAdmin` | 校级管理员 |
| `teacher` | 教师 |
| `student` | 学生 |

---

## 六、跨域（CORS）说明

平台后端启用了 **CORS 白名单**。

- **服务端到服务端**调用（你的后端直接请求平台）：不受 CORS 限制，可直接用。
- **浏览器前端直接**请求平台登录接口：浏览器会做跨域校验，你的前端域名/端口**必须先加入平台后端的 CORS 白名单**（平台 `server/src/index.ts` 的 `corsOptions.origin` 列表），否则会被浏览器拦截。请把你的前端访问地址提供给平台开发方添加。

允许的请求头：`Authorization`、`Content-Type`、`Accept`、`X-Requested-With`。

---

## 七、最小对接流程

1. 你的项目收集用户输入的**手机号 + 密码**。
2. 调用 `POST {BaseURL}/api/auth/login`。
3. 成功 → 保存返回的 `token` 与 `user`，用 `user.role` 等做你侧的权限控制。
4. 需要长期校验登录态时，按 3.3 的方式 A 或 B 处理（注意 7 天过期，过期需重新登录）。

---

## 附录：联系方式

| 角色 | 联系方式 |
|---|---|
| 平台开发负责人 | （待补充） |
| JWT 密钥 / CORS 白名单申请 | 向平台管理员索取 |
