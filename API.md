### 培训后台管理平台 API 说明（更新）

- 基础地址: `http://localhost:4000`
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
  - 说明
    - `score`: 模块历史最高分；未提交过为 `null`
    - `attempts`: 模块提交次数（从历史记录汇总）
    - `completedAt`: 最高分对应的完成时间；无则为 `null`

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
  - 说明
    - `moreDetail`：可选，外链 URL。若提供，将被写入“提交历史”；若该次分数成为该模块的最高分，也会同步到聚合成绩中。
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
  - 说明
    - 服务端会同时写入“提交历史”，并更新“聚合成绩”：每模块保留最高分并累计 `attempts`

- 提交历史（任意角色可看自己；教师/校级/超管可看任意学生）
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

- 班级课程成绩汇总（modular，teacher/schoolAdmin/superadmin）
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

### 健康检查
- GET `/health` → `{ "ok": true }`

### 状态码约定
- 400 参数错误；401 未登录或 token 无效；403 无权限；404 不存在；409 冲突（如手机号重复） 