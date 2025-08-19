### 平台最小可用版本（MVP）需求文档

## 目标与范围
- 面向学校的虚拟仿真培训通用管理平台，支持多学校（多租户）运营。
- 管理维度：学校、用户、课程、成绩/学习统计。
- 角色明确，接口统一，便于 Unity 课程对接（含仅时长统计与多模块成绩两类）。

## 角色与权限
- 超级管理员（公司侧）
  - 学校管理：增删改查
  - 学校管理员管理：创建/禁用/重置密码
  - 课程管理：创建/配置/发布/禁用（全局课程模板）
  - 查看全平台汇总（按学校聚合）
- 学校管理员（学校侧）
  - 学生管理：增删改查、重置密码、导入（CSV/XLSX，MVP 可先不做导入）
  - 教师管理：创建/禁用（可选，MVP 可由超管创建）
  - 课程分配：给本校班级/学生分配课程
  - 成绩/学习统计查看：按课程/班级/学生
- 学生
  - 登录并查看个人课程学习情况、模块成绩/时长

## 课程形态与统计
- 简单课程（无考核）：仅记录学习时长（支持 heartbeat/stop 汇总）
- 模块化课程（有考核）
  - 课程包含 1..N 个模块
  - 每模块独立成绩（分数/满分/尝试次数/完成时间）
  - 课程总分按模块汇总（总分与满分）

## 数据模型 v1
- School
  - id, name, code(唯一), address?, contact?, enabled
- User
  - id, schoolId, name, email(唯一), role(admin|teacher|student), className?, studentId?, passwordHash, enabled, createdAt
- Course
  - id, name, code(唯一), type(simple|modular), description?, enabled, createdAt
- CourseModule（仅 modular）
  - id, courseId, moduleId(唯一于课程内), name, maxScore(default:100), order
- Enrollment（课程分配）
  - id, userId, courseId, assignedBy, assignedAt, status(active|archived)
- ModuleScore
  - id, userId, courseId, moduleId, score, maxScore, attempts, completedAt, updatedAt
  - 约束：唯一索引(userId, courseId, moduleId)
- TimeLog（时长统计）
  - id, userId, courseId, startedAt, endedAt, durationSec
  - 衍生统计：TotalDurationSec = sum(durationSec) by userId+courseId

## 后端接口（MVP）
- 鉴权
  - POST /api/auth/login
- 学校（仅超级管理员）
  - GET/POST/PUT/DELETE /api/schools
- 用户
  - 超管：在任意学校创建学校管理员、教师
  - 学校管理员：在本校创建学生、教师
  - GET/POST/PUT/DELETE /api/users
  - 支持查询条件：schoolId、role、className、q（name/email/studentId）
- 课程
  - 超管：GET/POST/PUT/DELETE /api/courses（含 type 配置）
  - 模块：GET/POST/PUT/DELETE /api/courses/:courseId/modules
- 分配
  - 学校管理员：POST /api/enrollments（批量 userId[] + courseId）
  - GET /api/enrollments?schoolId=&courseId=&userId=
- 成绩与时长（Unity 对接重点）
  - 模块成绩（teacher/admin 写入；student 查询）
    - GET /api/scores/user/:userId?courseId=
    - PUT /api/scores/user/:userId
      - body: courseId, moduleScores[{ moduleId, score, maxScore?, attempts, completedAt? }]
  - 时长统计（简单课程）
    - POST /api/timelog/start { courseId }
    - POST /api/timelog/heartbeat { courseId }
    - POST /api/timelog/stop { courseId, startedAt? }
    - GET /api/timelog/user/:userId?courseId=
- 汇总/报表（学校管理员与以上）
  - GET /api/reports/class?schoolId=&className=&courseId=
  - GET /api/reports/course?schoolId=&courseId=
  - 返回：total、maxTotal、moduleBreakdown、totalDurationSec（type 为 simple 时）

说明：所有写接口需带 JWT，并校验角色 + schoolId 所属（多租户隔离）；GET 接口默认分页：page, pageSize，支持排序 createdAt desc。

## 前端管理台页面（MVP）
- 超级管理员：学校管理、用户管理（学校管理员/教师）、课程管理、平台总览
- 学校管理员：学生管理、课程分配、成绩/时长汇总
- 学生：我的课程（简单课程显示总时长；模块化课程显示模块成绩与进度）

## Unity 对接约定（MVP）
- 登录：POST /api/auth/login（拿 token）
- 获取个人课程状态：
  - 简单课程：GET /api/timelog/user/:userId?courseId=（返回 totalDurationSec）
  - 模块化课程：GET /api/scores/user/:userId?courseId=
- 写入：
  - 时长：start/heartbeat/stop；或退化为 upsertTime { courseId, durationSec }（后端累加）
  - 成绩：PUT /api/scores/user/:userId（按模块数组 upsert）

## 权限与多租户
- JWT 携带 userId、role、schoolId；所有数据查询与写入在后端按 schoolId 过滤。
- 资源操作权限：
  - 超管：跨学校读写
  - 学校管理员：仅本 schoolId 范围（teacher/student）
  - 学生：仅查询自己

## 非功能性（MVP）
- 安全：密码哈希、JWT 7 天
- 日志：接口错误日志（持久化后续迭代）
- 幂等：PUT/upsert 接口
- 分页：默认 pageSize=20；最大 100
- 部署：Dockerfile；PORT/MONGODB_URI/JWT_SECRET

## 迭代计划
- v1（当前）：学校/用户/课程（含模块）/分配/成绩与时长接口 + 管理台基础页 + Unity 联调
- v1.1：导入导出（用户/成绩）、课程封面与说明、筛选与排序增强、课程可见范围
- v1.2：操作审计、软删除、密码重置、刷新令牌、速率限制、报表导出（CSV）

## 验收标准（MVP）
- 超管可创建学校、课程（simple/modular）、学校管理员
- 学校管理员可创建学生、分配课程、查看班级与学生成绩/时长
- 学生可登录并查看自己的课程学习情况
- Unity 能登录、写入模块成绩与时长、查询个人数据 