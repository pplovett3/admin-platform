-- 与一期 SQLite 切片同构，供后续切换 PostgreSQL 14+。
-- 物理表名 users 对应设计文档中的 user，避免保留字。

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  security_config_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  create_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  share_type TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  acl_user_ids TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id TEXT PRIMARY KEY,
  kb_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  original_file_path TEXT NOT NULL DEFAULT '',
  desensitized_file_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  sensitive_flag BOOLEAN NOT NULL DEFAULT FALSE,
  desensitize_level INT NOT NULL DEFAULT 0,
  desensitize_log TEXT NOT NULL DEFAULT '',
  upload_user_id TEXT NOT NULL,
  upload_time TIMESTAMPTZ NOT NULL,
  error_message TEXT NOT NULL DEFAULT '',
  preview TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  kb_id TEXT NOT NULL,
  chunk_text TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  vector_json TEXT NOT NULL,
  vector_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL,
  share_type TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  kb_ids TEXT NOT NULL DEFAULT '[]',
  plugin_ids TEXT NOT NULL DEFAULT '[]',
  create_time TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS plugins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  plugin_type TEXT NOT NULL,
  invoke_address TEXT NOT NULL,
  input_schema TEXT NOT NULL DEFAULT '{}',
  output_schema TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  create_time TIMESTAMPTZ NOT NULL,
  expire_time TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations TEXT NOT NULL DEFAULT '',
  validation TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  create_time TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  ip_addr TEXT NOT NULL DEFAULT '',
  operation_type TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT '',
  resource_id TEXT NOT NULL DEFAULT '',
  operation_detail TEXT NOT NULL DEFAULT '',
  operation_result TEXT NOT NULL DEFAULT 'success',
  create_time TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_no_update ON audit_logs;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

DROP TRIGGER IF EXISTS audit_no_delete ON audit_logs;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

CREATE TABLE IF NOT EXISTS generated_resources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL DEFAULT '',
  message_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  watermark TEXT NOT NULL DEFAULT '',
  trace_code TEXT NOT NULL DEFAULT '',
  create_time TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS whitelist_terms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  term TEXT NOT NULL,
  create_time TIMESTAMPTZ NOT NULL,
  UNIQUE (tenant_id, term)
);

CREATE TABLE IF NOT EXISTS learning_stats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  department TEXT NOT NULL,
  class_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  summary TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_kb ON document_chunks (kb_id);
CREATE INDEX IF NOT EXISTS idx_docs_kb ON knowledge_documents (kb_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (create_time);
