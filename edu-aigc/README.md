# 校本智教

本地化教育资料与大模型结合的教学平台一期切片。教师可以对话生成教案、课件大纲和练习，把校本文档脱敏后放进私有知识库，并由本地规则校验学段是否超纲。

学生姓名、手机号、精确分数和全班成绩表不会进入检索，也不会在未配置密钥时离开本机。没有模型密钥时，生成走内置本地小模型，方便在校园内网直接演示。

## 运行

需要 Go 1.22 或更高版本（模块会按需使用 Go 1.26 工具链）以及 Node.js 22。

```bash
cd edu-aigc/frontend
npm install
npm run build
cd ../backend
go run ./cmd/server
```

浏览器打开 http://127.0.0.1:8080

演示账号：`admin`、`school`、`lead`、`teacher`、`math`  
密码都是 `Edu123456`

建议先用语文教师走一遍：知识库里已有比喻句材料，在对话里选择「语文备课助手」，输入「请根据知识库写一份三年级语文比喻句教案」。

## 环境变量

| 变量 | 作用 |
| --- | --- |
| `ADDR` | 监听地址，默认 `:8080` |
| `DATA_DIR` | 数据库与文件目录，默认 `backend/data` |
| `JWT_SECRET` | 登录令牌密钥 |
| `DATA_KEY` | 原始文件加密密钥 |
| `MODEL_BASE_URL` | OpenAI 兼容接口，例如通义兼容模式 |
| `MODEL_API_KEY` | 留空则只用本地模型 |
| `MODEL_NAME` | 公有模型名称 |
| `STATIC_DIR` | 前端构建目录，默认自动寻找 `frontend/dist` |

学情分析、批改和评语始终只走本地模型。送往公有接口之前还会再扫一遍手机号和身份证。

## 测试

```bash
cd edu-aigc/backend
go test ./...
```

覆盖脱敏三级策略、白名单、混合检索权限、超纲校验，以及登录、上传、拦截、越权检索、对话和审计的接口流程。

## 目录

- `backend`：Go 服务，包含脱敏、检索、校验、插件和模型网关
- `frontend`：Vue 3 + Vite 工作台
- `deploy/schema.postgres.sql`：与当前表结构对应的 PostgreSQL 脚本
- `docker-compose.yml`：应用本身可独立启动；`postgres`、`minio`、`qdrant`、`rabbitmq` 在 `infra` profile 中，供后续切换
