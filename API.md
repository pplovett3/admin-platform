### 培训后台管理平台 API 说明（更新）

- 基础地址: `http://106.15.229.165:4000`
- 认证: JWT，放在请求头 `Authorization: Bearer <token>`
- 内容类型: `application/json`
- 角色: `superadmin` | `schoolAdmin` | `teacher` | `student`
- 默认超管: 账号 `Admin`，手机 `13800000000`，密码 `admin123`
- 公共返回错误示例：
  ```json
  { "message": "描述" }
  ```

### 鉴权
- 登录（手机号+密码）
  - 方法: POST `/api/auth/login`
  - Body
    ```json
    { "phone": "13800000000", "password": "admin123" }
    ```
  - Postman 示例
    1) 新建请求：POST `http://106.15.229.165:4000/api/auth/login`
    2) Headers: `Content-Type: application/json`
    3) Body 选择 raw(JSON)，粘贴上面的示例 JSON
    4) Send，复制响应中的 `token`
  - 200
    ```json
    {
      "token": "JWT_STRING",
      "user": {
        "id": "66b9...d3",
        "name": "Admin",
        "role": "superadmin",
        "className": "Admin",
        "school": "Default",
        "schoolId": "66b9...ab",
        "phone": "13800000000"
      }
    }
    ```
  - JWT 负载包含：`userId` `role` `className` `school` `schoolId` `name` `phone`，有效期 7 天
  - 推荐：登录后，如需限制某课程访问，可调用“课程授权校验”接口校验用户所在学校是否被授权该课程

### 用户管理（需登录，权限见各接口）
- 列表
  - GET `/api/users?schoolId=&className=&role=&q=`
  - Query 可选：`schoolId` `className` `role=schoolAdmin|teacher|student` `q`(模糊 name/phone/studentId)
- 新增
  - POST `/api/users`
  - Body（根据操作者角色自动限制/默认值，如教师默认创建学生，学校默认为自身）
    ```json
    { "name": "张三", "phone": "13700000001", "studentId": "A101", "className": "演示一班", "role": "student", "password": "111111" }
    ```
- 详情: GET `/api/users/:id`
- 更新: PUT `/api/users/:id`
- 删除: DELETE `/api/users/:id`（仅 superadmin）

### 资源（需登录）
- 类型字典
  - `type` 中文：`图片` | `视频` | `模型` | `PDF` | `PPT` | `WORD` | `其他`
  - 上传支持格式：图片（jpg/png）、视频（mp4）、模型（glb/fbx/obj/stl）、文档（pdf/ppt/pptx/doc/docx）
- 上传
  - POST `/api/files/upload`
  - form-data: `file`；超管可额外传 `visibility=public` 上传公共资源，默认私有
  - Postman 示例
    1) 新建请求：POST `http://106.15.229.165:4000/api/files/upload`
    2) Headers: `Authorization: Bearer <token>`
    3) Body 选择 form-data：`file`(File) 选文件，(可选) `visibility=public`
    4) Send
- 我的资源（管理台使用）
  - GET `/api/files/mine?type=&q=&page=&pageSize=` → 返回分页（含下载/查看链接）
  - Postman 示例：GET `http://106.15.229.165:4000/api/files/mine`，Headers 带 `Authorization: Bearer <token>`，必要时加 Query
- 公共资源（管理台使用）
  - GET `/api/files/public?type=&q=&page=&pageSize=` → 返回分页（含下载/查看链接）
  - Postman 示例：GET `http://106.15.229.165:4000/api/files/public`，Headers 带 `Authorization: Bearer <token>`
- 下载（鉴权）
  - GET `/api/files/:id/download` → 仅本人/公共/超管可下
  - Postman 示例：GET `http://106.15.229.165:4000/api/files/<id>/download`，Headers 带 `Authorization: Bearer <token>`
- 删除
  - DELETE `/api/files/:id` → 本人或超管
  - Postman 示例：DELETE `http://106.15.229.165:4000/api/files/<id>`，Headers 带 `Authorization: Bearer <token>`
- 简化获取列表（给客户端/大厅使用，需在请求头携带 JWT：`Authorization: Bearer <token>`）
  - 个人资源
    - GET `/api/files/client/mine`
    - 200
      ```json
      {
        "rows": [
          { "name": "手签图片.png", "type": "图片", "download": "https://dl.yf-xr.com/users/.../手签图片.png" }
        ]
      }
      ```
    - Postman 示例
      1) 新建请求：GET `http://106.15.229.165:4000/api/files/client/mine`
      2) Headers: `Authorization: Bearer <token>`
      3) Send
  - 公共资源
    - GET `/api/files/client/public`
    - 200 与上相同结构
    - Postman 示例
      1) 新建请求：GET `http://106.15.229.165:4000/api/files/client/public`
      2) Headers: `Authorization: Bearer <token>`
      3) Send
  - 说明
    - `download` 为你在后端 `.env` 设置的 `PUBLIC_DOWNLOAD_BASE`（例如 `https://dl.yf-xr.com`）拼上存储相对路径
    - 仅图片/视频返回 `viewUrl`（管理台分页接口中），指向 `PUBLIC_VIEW_BASE`（例如 `https://video.yf-xr.com`）

### 学校管理（superadmin）
- 基础 CRUD：`/api/schools`

### 课程管理（superadmin）
- 基础 CRUD：`/api/courses`
- 模块管理：`/api/courses/:id/modules`
- 课程类型：`simple`（时长）| `modular`（多模块成绩）

### 课程授权（superadmin）
- 学校-课程授权列表：GET `/api/enrollments/schools?schoolId=&courseId=`
- 新增/更新授权：POST `/api/enrollments/schools`  Body: `{ schoolId, courseId, enabled }`
- 删除授权：DELETE `/api/enrollments/schools/:id`
- 授权校验（所有角色可用）：GET `/api/enrollments/schools/check?schoolId=&courseId=` → `{ allowed: true|false }`

### 成绩（需登录）
- 说明
  - `courseId` 参数支持传课程 `_id`、`code` 或 `name`，服务端会自动归一化为课程 `_id` 存储/查询

- 个人课程成绩（学生仅可查自己；教师/校级/超管可查任意学生）
  - GET `/api/scores/user/:userId?courseId=<courseId|code|name>`
  - 200（modular 课程会返回该课程下“所有模块”，未提交过的模块将返回占位信息）
    ```json
    {
      "user": "66b9...d3",
      "courseId": "<normalizedCourseObjectId>",
      "moduleScores": [
        { "moduleId": "001", "moduleName": "产线认知", "score": 80, "maxScore": 100, "attempts": 2, "completedAt": "2025-08-08T07:00:00.000Z" },
        { "moduleId": "002", "moduleName": "机械安装", "score": null, "maxScore": 100, "attempts": 0, "completedAt": null }
      ]
    }
    ```
  - Postman 示例：GET `http://106.15.229.165:4000/api/scores/user/<userId>?courseId=<id|code|name>`，Headers 带 `Authorization: Bearer <token>`

- 写入/更新某学生成绩（teacher/schoolAdmin/superadmin；student 仅可提交自己的成绩）
  - PUT `/api/scores/user/:userId`
  - 约束：单次“仅允许提交一个模块”的成绩
  - Body
    ```json
    {
      "courseId": "<courseId|code|name>",
      "moduleScores": [
        { "moduleId": "001", "score": 80, "maxScore": 100, "completedAt": "2025-08-08T07:00:00.000Z", "moreDetail": "https://example.com/report/123" }
      ]
    }
    ```
  - 200（返回聚合后的当前成绩文档，非本次“原始提交”）
    ```json
    {
      "_id": "66c2...",
      "user": "66b9...d3",
      "courseId": "<normalizedCourseObjectId>",
      "moduleScores": [
        { "moduleId": "001", "score": 85, "maxScore": 100, "attempts": 3, "completedAt": "2025-08-11T09:55:21.000Z", "moreDetail": "https://example.com/report/xxx" }
      ]
    }
    ```
  - Postman 示例：PUT `http://106.15.229.165:4000/api/scores/user/<userId>`，Headers 带 `Authorization: Bearer <token>` 与 `Content-Type: application/json`，Body raw(JSON) 粘贴上面的结构

### 提交历史（任意角色可看自己；教师/校级/超管可看任意学生）
- GET `/api/scores/user/:userId/submissions?courseId=<courseId|code|name>`
- 200（按提交时间倒序；单次仅包含一个模块）
  ```json
  {
    "rows": [
      {
        "_id": "66c3...",
        "user": "66b9...d3",
        "courseId": "<normalizedCourseObjectId>",
        "submittedAt": "2025-08-11T10:00:00.000Z",
        "moduleScores": [ { "moduleId": "001", "moduleName": "产线认知", "score": 80, "maxScore": 100, "completedAt": "2025-08-11T10:00:00.000Z", "moreDetail": "https://example.com/report/123" } ]
      }
    ]
  }
  ```
- Postman 示例：GET `http://106.15.229.165:4000/api/scores/user/<userId>/submissions?courseId=<id>`，Headers 带 `Authorization: Bearer <token>`

### 班级课程成绩汇总（modular，teacher/schoolAdmin/superadmin）
- GET `/api/scores/class/:className?courseId=<courseId|code|name>`
- 200（每个学生一条，带模块明细、提交时间、模块名称）
  ```json
  [
    {
      "userId": "66b9...d3",
      "name": "李四",
      "studentId": "A102",
      "className": "演示一班",
      "school": "浪浪山学校",
      "total": 170,
      "maxTotal": 200,
      "lastSubmittedAt": "2025-08-11T09:55:21.000Z",
      "moduleScores": [
        { "moduleId": "001", "moduleName": "产线认知", "score": 80, "maxScore": 100, "attempts": 2, "completedAt": "2025-08-11T09:55:21.000Z" },
        { "moduleId": "002", "moduleName": "机械安装", "score": 90, "maxScore": 100, "attempts": 1 }
      ]
    }
  ]
  ```
- Postman 示例：GET `http://106.15.229.165:4000/api/scores/class/<className>?courseId=<id>`，Headers 带 `Authorization: Bearer <token>`

### 时长（simple 课程，需登录）
- 学生个人课程时长（教师/校级/超管也可查任意学生）
  - GET `/api/timelog/user/:userId?courseId=<courseId>`
  - 200
    ```json
    {
      "userId": "66b9...d3",
      "courseId": "<courseId>",
      "totalDurationSec": 5400,
      "logs": [
        { "_id": "66c1...", "startedAt": "2025-08-11T08:00:00.000Z", "endedAt": "2025-08-11T09:00:00.000Z", "durationSec": 3600 }
      ]
    }
    ```
- 班级课程时长汇总（teacher/schoolAdmin/superadmin）
  - GET `/api/timelog/class/:className?courseId=<courseId>`
  - 200
    ```json
    {
      "rows": [
        { "userId": "66b9...d3", "name": "张三", "studentId": "A101", "totalDurationSec": 7200, "sessions": 3 },
        { "userId": "66b9...d4", "name": "李四", "studentId": "A102", "totalDurationSec": 3600, "sessions": 1 }
      ],
      "classAverageDurationSec": 5400
    }
    ```
- 结束并上报一次会话（客户端在学习结束或退出时调用）
  - POST `/api/timelog/stop`
  - Body
    ```json
    {
      "courseId": "<courseId>",
      "startedAt": "2025-08-11T08:00:00.000Z",
      "endedAt": "2025-08-11T09:00:00.000Z"
    }
    ```
  - 200
    ```json
    {
      "ok": true,
      "saved": {
        "_id": "66c2...",
        "userId": "66b9...d3",
        "courseId": "<courseId>",
        "startedAt": "2025-08-11T08:00:00.000Z",
        "endedAt": "2025-08-11T09:00:00.000Z",
        "durationSec": 3600
      }
    }
    ```
  - 说明：服务端根据 `startedAt` 和 `endedAt` 计算 `durationSec`；多次调用将追加会话记录

### 数据总览（Analytics，需登录）
- 超管平台总览
  - GET `/api/analytics/overview` → 学校数、课程数（按类型）、学生数、学习人次、成绩提交总次数
  - GET `/api/analytics/schools` → 学校维度（授权课程数、学生数、学习人次）
  - GET `/api/analytics/courses/:id` → 课程明细（modular: 参与人数/模块均分/班级均分；simple: 参与人数/学习人次）
  - 趋势与榜单：
    - GET `/api/analytics/trend/sessions?days=14`
    - GET `/api/analytics/active-students?days=7`
    - GET `/api/analytics/top/courses?metric=sessions|submissions&limit=10`
    - GET `/api/analytics/top/schools?limit=10`
- 校级总览
  - GET `/api/analytics/school/overview`
  - GET `/api/analytics/school/trend/sessions?days=14`
  - GET `/api/analytics/school/top/courses?metric=sessions|submissions&limit=10`
- 教师总览（按所带班级聚合）
  - GET `/api/analytics/teacher/overview`
  - GET `/api/analytics/teacher/trend/sessions?days=14`
  - GET `/api/analytics/teacher/top/courses?metric=sessions|submissions&limit=10`
- 学生总览
  - GET `/api/analytics/student/overview`
  - GET `/api/analytics/student/trend/sessions?days=14`

### 三维课件管理（需登录，权限：superadmin/schoolAdmin/teacher）
- 课件列表
  - GET `/api/coursewares?q=&page=&limit=`
  - Query可选：`q`(模糊搜索名称/描述) `page`(页码，默认1) `limit`(每页条数，默认20)
  - 200
    ```json
    {
      "items": [
        {
          "_id": "68bc53d55f017bd5c72d4013",
          "name": "小米su7轮胎",
          "description": "",
          "modelUrl": "https://dl.yf-xr.com/models/68af267e83f0e85a3dd4d13f.glb",
          "modifiedModelUrl": "https://dl.yf-xr.com/models/68bc54af5f017bd5c72d402a.glb",
          "createdAt": "2025-09-06T15:31:33.035Z",
          "updatedAt": "2025-09-06T15:35:11.071Z",
          "createdBy": { "_id": "689c46d6191b483b08e9c560", "name": "Admin" },
          "version": 3
        }
      ],
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "pages": 1
      }
    }
    ```
  - Postman示例：GET `http://106.15.229.165:4000/api/coursewares`，Headers带`Authorization: Bearer <token>`
  - 说明：`modelUrl`和`modifiedModelUrl`使用公网直链格式 `https://dl.yf-xr.com/models/{文件ID}.glb`，可直接下载

- 课件详情（包含完整的动画、标注、模型结构数据）
  - GET `/api/coursewares/:id`
  - 200（完整JSON结构见下方Unity开发文档中的示例）
  - Postman示例：GET `http://106.15.229.165:4000/api/coursewares/68bc53d55f017bd5c72d4013`，Headers带`Authorization: Bearer <token>`

- 创建课件
  - POST `/api/coursewares`
  - Body
    ```json
    {
      "name": "课件名称",
      "description": "课件描述（可选）",
      "modelUrl": "https://dl.yf-xr.com/models/文件ID.glb"
    }
    ```

- 更新课件
  - PUT `/api/coursewares/:id`
  - Body（包含完整的课件数据：标注、动画、设置等）

- 删除课件
  - DELETE `/api/coursewares/:id`

### 健康检查
- GET `/health` → `{ "ok": true }`

### 状态码约定
- 400 参数错误；401 未登录或 token 无效；403 无权限；404 不存在；409 冲突（如手机号重复） 