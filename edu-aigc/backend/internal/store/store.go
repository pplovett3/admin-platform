package store

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"edu-aigc/internal/desensitize"
	"edu-aigc/internal/rag"
	"golang.org/x/crypto/bcrypt"

	_ "modernc.org/sqlite"
)

const (
	TenantID     = "t-demo"
	UserAdmin    = "u-admin"
	UserSchool   = "u-school"
	UserLead     = "u-lead"
	UserTeacher  = "u-teacher"
	UserMath     = "u-math"
	KBYuwen      = "kb-yuwen"
	KBMath       = "kb-math"
	KBScience    = "kb-science"
	AgentYuwen   = "ag-yuwen"
	AgentMath    = "ag-math"
	AgentReport  = "ag-report"
	DemoPassword = "Edu123456"
)

type Store struct {
	db      *sql.DB
	dataDir string
}

type User struct {
	ID           string `json:"id"`
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	TenantID     string `json:"tenant_id"`
	Role         string `json:"role"`
	Department   string `json:"department"`
	DisplayName  string `json:"display_name"`
	CreateTime   string `json:"create_time"`
	Status       string `json:"status"`
}

type KB struct {
	ID          string `json:"id"`
	TenantID    string `json:"tenant_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	OwnerID     string `json:"owner_id"`
	ShareType   string `json:"share_type"`
	Department  string `json:"department"`
	ACLUserIDs  string `json:"acl_user_ids"`
	CreatedAt   string `json:"created_at"`
}

type Document struct {
	ID               string `json:"id"`
	KBID             string `json:"kb_id"`
	FileName         string `json:"file_name"`
	OriginalPath     string `json:"-"`
	DesensitizedPath string `json:"-"`
	Status           string `json:"status"`
	SensitiveFlag    bool   `json:"sensitive_flag"`
	Level            int    `json:"desensitize_level"`
	DesensitizeLog   string `json:"desensitize_log"`
	UploadUserID     string `json:"upload_user_id"`
	UploadTime       string `json:"upload_time"`
	ErrorMessage     string `json:"error_message"`
	Preview          string `json:"preview"`
}

type Chunk struct {
	ID         string
	DocID      string
	KBID       string
	Text       string
	MetaJSON   string
	VectorJSON string
	VectorID   string
	Vector     []float32
}

type Agent struct {
	ID           string   `json:"id"`
	TenantID     string   `json:"tenant_id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	SystemPrompt string   `json:"system_prompt"`
	OwnerID      string   `json:"owner_id"`
	ShareType    string   `json:"share_type"`
	Department   string   `json:"department"`
	KBIDs        []string `json:"kb_ids"`
	PluginIDs    []string `json:"plugin_ids"`
	CreateTime   string   `json:"create_time"`
}

type Plugin struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	PluginType    string `json:"plugin_type"`
	InvokeAddress string `json:"invoke_address"`
	InputSchema   string `json:"input_schema"`
	OutputSchema  string `json:"output_schema"`
}

type Conversation struct {
	ID         string `json:"id"`
	UserID     string `json:"user_id"`
	AgentID    string `json:"agent_id"`
	Title      string `json:"title"`
	CreateTime string `json:"create_time"`
	ExpireTime string `json:"expire_time"`
}

type Message struct {
	ID             string `json:"id"`
	ConversationID string `json:"conversation_id"`
	Role           string `json:"role"`
	Content        string `json:"content"`
	Citations      string `json:"citations"`
	Validation     string `json:"validation"`
	Model          string `json:"model"`
	CreateTime     string `json:"create_time"`
}

type Audit struct {
	ID              string `json:"id"`
	TenantID        string `json:"tenant_id"`
	UserID          string `json:"user_id"`
	IP              string `json:"ip_addr"`
	OperationType   string `json:"operation_type"`
	ResourceType    string `json:"resource_type"`
	ResourceID      string `json:"resource_id"`
	OperationDetail string `json:"operation_detail"`
	Result          string `json:"operation_result"`
	CreateTime      string `json:"create_time"`
	UserName        string `json:"user_name"`
	Department      string `json:"department"`
}

type Resource struct {
	ID             string `json:"id"`
	TenantID       string `json:"tenant_id"`
	UserID         string `json:"user_id"`
	ConversationID string `json:"conversation_id"`
	MessageID      string `json:"message_id"`
	Title          string `json:"title"`
	Kind           string `json:"kind"`
	FilePath       string `json:"-"`
	Watermark      string `json:"watermark"`
	TraceCode      string `json:"trace_code"`
	CreateTime     string `json:"create_time"`
}

type WhitelistTerm struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenant_id"`
	Term       string `json:"term"`
	CreateTime string `json:"create_time"`
}

type LearningStat struct {
	ID         string `json:"id"`
	TenantID   string `json:"tenant_id"`
	Department string `json:"department"`
	ClassName  string `json:"class_name"`
	Subject    string `json:"subject"`
	Summary    string `json:"summary"`
}

func Open(dbPath, dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o750); err != nil {
		return nil, err
	}
	for _, sub := range []string{"original-files", "desensitized-files", "generated-resource", "privacy-archive"} {
		if err := os.MkdirAll(filepath.Join(dataDir, sub), 0o750); err != nil {
			return nil, err
		}
	}
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o750); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", "file:"+dbPath+"?_pragma=busy_timeout(5000)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	return &Store{db: db, dataDir: dataDir}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func (s *Store) DataDir() string { return s.dataDir }

func (s *Store) Migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS tenants (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '', security_config_json TEXT NOT NULL DEFAULT '{}')`,
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, tenant_id TEXT NOT NULL,
			role TEXT NOT NULL, department TEXT NOT NULL DEFAULT '', display_name TEXT NOT NULL DEFAULT '',
			create_time TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active')`,
		`CREATE TABLE IF NOT EXISTS knowledge_bases (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
			owner_id TEXT NOT NULL, share_type TEXT NOT NULL, department TEXT NOT NULL DEFAULT '',
			acl_user_ids TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS knowledge_documents (
			id TEXT PRIMARY KEY, kb_id TEXT NOT NULL, file_name TEXT NOT NULL, original_file_path TEXT NOT NULL DEFAULT '',
			desensitized_file_path TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, sensitive_flag INTEGER NOT NULL DEFAULT 0,
			desensitize_level INTEGER NOT NULL DEFAULT 0, desensitize_log TEXT NOT NULL DEFAULT '',
			upload_user_id TEXT NOT NULL, upload_time TEXT NOT NULL, error_message TEXT NOT NULL DEFAULT '', preview TEXT NOT NULL DEFAULT '')`,
		`CREATE TABLE IF NOT EXISTS document_chunks (
			id TEXT PRIMARY KEY, doc_id TEXT NOT NULL, kb_id TEXT NOT NULL, chunk_text TEXT NOT NULL,
			meta_json TEXT NOT NULL DEFAULT '{}', vector_json TEXT NOT NULL, vector_id TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS agents (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
			system_prompt TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, share_type TEXT NOT NULL,
			department TEXT NOT NULL DEFAULT '', kb_ids TEXT NOT NULL DEFAULT '[]', plugin_ids TEXT NOT NULL DEFAULT '[]',
			create_time TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS plugins (
			id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', plugin_type TEXT NOT NULL,
			invoke_address TEXT NOT NULL, input_schema TEXT NOT NULL DEFAULT '{}', output_schema TEXT NOT NULL DEFAULT '{}')`,
		`CREATE TABLE IF NOT EXISTS conversations (
			id TEXT PRIMARY KEY, user_id TEXT NOT NULL, agent_id TEXT NOT NULL, title TEXT NOT NULL,
			create_time TEXT NOT NULL, expire_time TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS messages (
			id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL,
			citations TEXT NOT NULL DEFAULT '', validation TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
			create_time TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS audit_logs (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, ip_addr TEXT NOT NULL DEFAULT '',
			operation_type TEXT NOT NULL, resource_type TEXT NOT NULL DEFAULT '', resource_id TEXT NOT NULL DEFAULT '',
			operation_detail TEXT NOT NULL DEFAULT '', operation_result TEXT NOT NULL DEFAULT 'success', create_time TEXT NOT NULL)`,
		`CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END`,
		`CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END`,
		`CREATE TABLE IF NOT EXISTS generated_resources (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, user_id TEXT NOT NULL, conversation_id TEXT NOT NULL DEFAULT '',
			message_id TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, kind TEXT NOT NULL, file_path TEXT NOT NULL,
			watermark TEXT NOT NULL DEFAULT '', trace_code TEXT NOT NULL DEFAULT '', create_time TEXT NOT NULL)`,
		`CREATE TABLE IF NOT EXISTS whitelist_terms (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, term TEXT NOT NULL, create_time TEXT NOT NULL,
			UNIQUE(tenant_id, term))`,
		`CREATE TABLE IF NOT EXISTS learning_stats (
			id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, department TEXT NOT NULL, class_name TEXT NOT NULL,
			subject TEXT NOT NULL, summary TEXT NOT NULL)`,
		`CREATE INDEX IF NOT EXISTS idx_chunks_kb ON document_chunks(kb_id)`,
		`CREATE INDEX IF NOT EXISTS idx_docs_kb ON knowledge_documents(kb_id)`,
		`CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id)`,
	}
	for _, stmt := range stmts {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("迁移失败: %w\n%s", err, stmt)
		}
	}
	return nil
}

func Now() string { return time.Now().UTC().Format(time.RFC3339) }

func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Store) Login(username, password string) (User, error) {
	u, err := s.UserByUsername(username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return User{}, errors.New("用户名或密码错误")
		}
		return User{}, err
	}
	if u.Status != "active" {
		return User{}, errors.New("账号已停用")
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return User{}, errors.New("用户名或密码错误")
	}
	return u, nil
}

func (s *Store) UserByUsername(name string) (User, error) {
	row := s.db.QueryRow(`SELECT id, username, password_hash, tenant_id, role, department, display_name, create_time, status FROM users WHERE username=?`, name)
	return scanUser(row)
}

func (s *Store) UserByID(id string) (User, error) {
	row := s.db.QueryRow(`SELECT id, username, password_hash, tenant_id, role, department, display_name, create_time, status FROM users WHERE id=?`, id)
	return scanUser(row)
}

func (s *Store) TenantName(id string) string {
	var name string
	_ = s.db.QueryRow(`SELECT name FROM tenants WHERE id=?`, id).Scan(&name)
	if name == "" {
		return "本校"
	}
	return name
}

func scanUser(row scanner) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Username, &u.PasswordHash, &u.TenantID, &u.Role, &u.Department, &u.DisplayName, &u.CreateTime, &u.Status)
	return u, err
}

type scanner interface{ Scan(dest ...any) error }

func (s *Store) AddAudit(a Audit) error {
	if a.ID == "" {
		a.ID = NewID()
	}
	if a.CreateTime == "" {
		a.CreateTime = Now()
	}
	if a.Result == "" {
		a.Result = "success"
	}
	a.OperationDetail = clip(a.OperationDetail, 240)
	_, err := s.db.Exec(`INSERT INTO audit_logs (id, tenant_id, user_id, ip_addr, operation_type, resource_type, resource_id, operation_detail, operation_result, create_time)
		VALUES (?,?,?,?,?,?,?,?,?,?)`, a.ID, a.TenantID, a.UserID, a.IP, a.OperationType, a.ResourceType, a.ResourceID, a.OperationDetail, a.Result, a.CreateTime)
	return err
}

func (s *Store) CountAudit(userID, op, since string) (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM audit_logs WHERE user_id=? AND operation_type=? AND create_time>=?`, userID, op, since).Scan(&n)
	return n, err
}

func (s *Store) ListAudit(viewer User, limit int) ([]Audit, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	rows, err := s.db.Query(`SELECT a.id, a.tenant_id, a.user_id, a.ip_addr, a.operation_type, a.resource_type, a.resource_id,
		a.operation_detail, a.operation_result, a.create_time, u.display_name, u.department
		FROM audit_logs a JOIN users u ON u.id=a.user_id
		WHERE (?='admin') OR (?='school_admin' AND a.tenant_id=?) OR (?='group_lead' AND u.department=? AND a.tenant_id=?) OR a.user_id=?
		ORDER BY a.create_time DESC LIMIT ?`,
		viewer.Role, viewer.Role, viewer.TenantID, viewer.Role, viewer.Department, viewer.TenantID, viewer.ID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Audit
	for rows.Next() {
		var a Audit
		if err := rows.Scan(&a.ID, &a.TenantID, &a.UserID, &a.IP, &a.OperationType, &a.ResourceType, &a.ResourceID, &a.OperationDetail, &a.Result, &a.CreateTime, &a.UserName, &a.Department); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) CreateKB(k KB) error {
	if k.ACLUserIDs == "" {
		k.ACLUserIDs = "[]"
	}
	_, err := s.db.Exec(`INSERT INTO knowledge_bases (id, tenant_id, name, description, owner_id, share_type, department, acl_user_ids, created_at)
		VALUES (?,?,?,?,?,?,?,?,?)`, k.ID, k.TenantID, k.Name, k.Description, k.OwnerID, k.ShareType, k.Department, k.ACLUserIDs, k.CreatedAt)
	return err
}

func (s *Store) GetKB(id string) (KB, error) {
	var k KB
	err := s.db.QueryRow(`SELECT id, tenant_id, name, description, owner_id, share_type, department, acl_user_ids, created_at FROM knowledge_bases WHERE id=?`, id).
		Scan(&k.ID, &k.TenantID, &k.Name, &k.Description, &k.OwnerID, &k.ShareType, &k.Department, &k.ACLUserIDs, &k.CreatedAt)
	return k, err
}

func (s *Store) ListKB(u User) ([]KB, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, description, owner_id, share_type, department, acl_user_ids, created_at FROM knowledge_bases ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []KB
	for rows.Next() {
		var k KB
		if err := rows.Scan(&k.ID, &k.TenantID, &k.Name, &k.Description, &k.OwnerID, &k.ShareType, &k.Department, &k.ACLUserIDs, &k.CreatedAt); err != nil {
			return nil, err
		}
		if CanReadKB(u, k) {
			out = append(out, k)
		}
	}
	return out, rows.Err()
}

func (s *Store) CreateDocument(d Document) error {
	flag := 0
	if d.SensitiveFlag {
		flag = 1
	}
	_, err := s.db.Exec(`INSERT INTO knowledge_documents (id, kb_id, file_name, original_file_path, desensitized_file_path, status, sensitive_flag, desensitize_level, desensitize_log, upload_user_id, upload_time, error_message, preview)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, d.ID, d.KBID, d.FileName, d.OriginalPath, d.DesensitizedPath, d.Status, flag, d.Level, d.DesensitizeLog, d.UploadUserID, d.UploadTime, d.ErrorMessage, d.Preview)
	return err
}

func (s *Store) SaveDocumentState(d Document) error {
	flag := 0
	if d.SensitiveFlag {
		flag = 1
	}
	_, err := s.db.Exec(`UPDATE knowledge_documents SET original_file_path=?, desensitized_file_path=?, status=?, sensitive_flag=?, desensitize_level=?, desensitize_log=?, error_message=?, preview=? WHERE id=?`,
		d.OriginalPath, d.DesensitizedPath, d.Status, flag, d.Level, d.DesensitizeLog, d.ErrorMessage, d.Preview, d.ID)
	return err
}

func (s *Store) GetDocument(id string) (Document, error) {
	var d Document
	var flag int
	err := s.db.QueryRow(`SELECT id, kb_id, file_name, original_file_path, desensitized_file_path, status, sensitive_flag, desensitize_level, desensitize_log, upload_user_id, upload_time, error_message, preview FROM knowledge_documents WHERE id=?`, id).
		Scan(&d.ID, &d.KBID, &d.FileName, &d.OriginalPath, &d.DesensitizedPath, &d.Status, &flag, &d.Level, &d.DesensitizeLog, &d.UploadUserID, &d.UploadTime, &d.ErrorMessage, &d.Preview)
	d.SensitiveFlag = flag == 1
	return d, err
}

func (s *Store) ListDocuments(kbID string) ([]Document, error) {
	rows, err := s.db.Query(`SELECT id, kb_id, file_name, original_file_path, desensitized_file_path, status, sensitive_flag, desensitize_level, desensitize_log, upload_user_id, upload_time, error_message, preview FROM knowledge_documents WHERE kb_id=? ORDER BY upload_time DESC`, kbID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Document
	for rows.Next() {
		var d Document
		var flag int
		if err := rows.Scan(&d.ID, &d.KBID, &d.FileName, &d.OriginalPath, &d.DesensitizedPath, &d.Status, &flag, &d.Level, &d.DesensitizeLog, &d.UploadUserID, &d.UploadTime, &d.ErrorMessage, &d.Preview); err != nil {
			return nil, err
		}
		d.SensitiveFlag = flag == 1
		d.Preview = clip(d.Preview, 280)
		out = append(out, d)
	}
	return out, rows.Err()
}

func (s *Store) InsertChunks(chunks []Chunk) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, c := range chunks {
		if _, err := tx.Exec(`INSERT INTO document_chunks (id, doc_id, kb_id, chunk_text, meta_json, vector_json, vector_id) VALUES (?,?,?,?,?,?,?)`,
			c.ID, c.DocID, c.KBID, c.Text, c.MetaJSON, c.VectorJSON, c.VectorID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) ListChunks(kbIDs []string) ([]Chunk, error) {
	if len(kbIDs) == 0 {
		return nil, nil
	}
	holders := make([]string, len(kbIDs))
	args := make([]any, len(kbIDs))
	for i, id := range kbIDs {
		holders[i] = "?"
		args[i] = id
	}
	q := `SELECT id, doc_id, kb_id, chunk_text, meta_json, vector_json, vector_id FROM document_chunks WHERE kb_id IN (` + strings.Join(holders, ",") + `)`
	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Chunk
	for rows.Next() {
		var c Chunk
		if err := rows.Scan(&c.ID, &c.DocID, &c.KBID, &c.Text, &c.MetaJSON, &c.VectorJSON, &c.VectorID); err != nil {
			return nil, err
		}
		var nums []float64
		if json.Unmarshal([]byte(c.VectorJSON), &nums) == nil {
			c.Vector = make([]float32, len(nums))
			for i, n := range nums {
				c.Vector[i] = float32(n)
			}
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) CreateAgent(a Agent) error {
	kb, _ := json.Marshal(a.KBIDs)
	pl, _ := json.Marshal(a.PluginIDs)
	_, err := s.db.Exec(`INSERT INTO agents (id, tenant_id, name, description, system_prompt, owner_id, share_type, department, kb_ids, plugin_ids, create_time)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)`, a.ID, a.TenantID, a.Name, a.Description, a.SystemPrompt, a.OwnerID, a.ShareType, a.Department, string(kb), string(pl), a.CreateTime)
	return err
}

func (s *Store) UpdateAgent(a Agent) error {
	kb, _ := json.Marshal(a.KBIDs)
	pl, _ := json.Marshal(a.PluginIDs)
	_, err := s.db.Exec(`UPDATE agents SET name=?, description=?, system_prompt=?, share_type=?, department=?, kb_ids=?, plugin_ids=? WHERE id=?`,
		a.Name, a.Description, a.SystemPrompt, a.ShareType, a.Department, string(kb), string(pl), a.ID)
	return err
}

func (s *Store) DeleteAgent(id string) error {
	_, err := s.db.Exec(`DELETE FROM agents WHERE id=?`, id)
	return err
}

func (s *Store) GetAgent(id string) (Agent, error) {
	var a Agent
	var kb, pl string
	err := s.db.QueryRow(`SELECT id, tenant_id, name, description, system_prompt, owner_id, share_type, department, kb_ids, plugin_ids, create_time FROM agents WHERE id=?`, id).
		Scan(&a.ID, &a.TenantID, &a.Name, &a.Description, &a.SystemPrompt, &a.OwnerID, &a.ShareType, &a.Department, &kb, &pl, &a.CreateTime)
	if err != nil {
		return a, err
	}
	_ = json.Unmarshal([]byte(kb), &a.KBIDs)
	_ = json.Unmarshal([]byte(pl), &a.PluginIDs)
	return a, nil
}

func (s *Store) ListAgents(u User) ([]Agent, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, name, description, system_prompt, owner_id, share_type, department, kb_ids, plugin_ids, create_time FROM agents ORDER BY create_time DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Agent
	for rows.Next() {
		var a Agent
		var kb, pl string
		if err := rows.Scan(&a.ID, &a.TenantID, &a.Name, &a.Description, &a.SystemPrompt, &a.OwnerID, &a.ShareType, &a.Department, &kb, &pl, &a.CreateTime); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(kb), &a.KBIDs)
		_ = json.Unmarshal([]byte(pl), &a.PluginIDs)
		if CanReadAgent(u, a) {
			out = append(out, a)
		}
	}
	return out, rows.Err()
}

func (s *Store) ListPlugins() ([]Plugin, error) {
	rows, err := s.db.Query(`SELECT id, name, description, plugin_type, invoke_address, input_schema, output_schema FROM plugins ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Plugin
	for rows.Next() {
		var p Plugin
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.PluginType, &p.InvokeAddress, &p.InputSchema, &p.OutputSchema); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) CreateConversation(c Conversation) error {
	_, err := s.db.Exec(`INSERT INTO conversations (id, user_id, agent_id, title, create_time, expire_time) VALUES (?,?,?,?,?,?)`,
		c.ID, c.UserID, c.AgentID, c.Title, c.CreateTime, c.ExpireTime)
	return err
}

func (s *Store) GetConversation(id string) (Conversation, error) {
	var c Conversation
	err := s.db.QueryRow(`SELECT id, user_id, agent_id, title, create_time, expire_time FROM conversations WHERE id=?`, id).
		Scan(&c.ID, &c.UserID, &c.AgentID, &c.Title, &c.CreateTime, &c.ExpireTime)
	return c, err
}

func (s *Store) ListConversations(userID string) ([]Conversation, error) {
	rows, err := s.db.Query(`SELECT id, user_id, agent_id, title, create_time, expire_time FROM conversations WHERE user_id=? AND expire_time>=? ORDER BY create_time DESC`, userID, Now())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Conversation
	for rows.Next() {
		var c Conversation
		if err := rows.Scan(&c.ID, &c.UserID, &c.AgentID, &c.Title, &c.CreateTime, &c.ExpireTime); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (s *Store) RenameConversation(id, title string) error {
	_, err := s.db.Exec(`UPDATE conversations SET title=? WHERE id=?`, title, id)
	return err
}

func (s *Store) AddMessage(m Message) error {
	_, err := s.db.Exec(`INSERT INTO messages (id, conversation_id, role, content, citations, validation, model, create_time) VALUES (?,?,?,?,?,?,?,?)`,
		m.ID, m.ConversationID, m.Role, m.Content, m.Citations, m.Validation, m.Model, m.CreateTime)
	return err
}

func (s *Store) ListMessages(convID string) ([]Message, error) {
	rows, err := s.db.Query(`SELECT id, conversation_id, role, content, citations, validation, model, create_time FROM messages WHERE conversation_id=? ORDER BY create_time ASC`, convID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.ConversationID, &m.Role, &m.Content, &m.Citations, &m.Validation, &m.Model, &m.CreateTime); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Store) CreateResource(r Resource) error {
	_, err := s.db.Exec(`INSERT INTO generated_resources (id, tenant_id, user_id, conversation_id, message_id, title, kind, file_path, watermark, trace_code, create_time)
		VALUES (?,?,?,?,?,?,?,?,?,?,?)`, r.ID, r.TenantID, r.UserID, r.ConversationID, r.MessageID, r.Title, r.Kind, r.FilePath, r.Watermark, r.TraceCode, r.CreateTime)
	return err
}

func (s *Store) ListResources(u User) ([]Resource, error) {
	rows, err := s.db.Query(`SELECT r.id, r.tenant_id, r.user_id, r.conversation_id, r.message_id, r.title, r.kind, r.file_path, r.watermark, r.trace_code, r.create_time, u.department
		FROM generated_resources r JOIN users u ON u.id=r.user_id WHERE r.tenant_id=? OR ?='admin' ORDER BY r.create_time DESC`, u.TenantID, u.Role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Resource
	for rows.Next() {
		var r Resource
		var dept string
		if err := rows.Scan(&r.ID, &r.TenantID, &r.UserID, &r.ConversationID, &r.MessageID, &r.Title, &r.Kind, &r.FilePath, &r.Watermark, &r.TraceCode, &r.CreateTime, &dept); err != nil {
			return nil, err
		}
		if u.Role == "admin" || u.Role == "school_admin" || r.UserID == u.ID || (u.Role == "group_lead" && dept == u.Department) {
			out = append(out, r)
		}
	}
	return out, rows.Err()
}

func (s *Store) GetResource(id string) (Resource, error) {
	var r Resource
	err := s.db.QueryRow(`SELECT id, tenant_id, user_id, conversation_id, message_id, title, kind, file_path, watermark, trace_code, create_time FROM generated_resources WHERE id=?`, id).
		Scan(&r.ID, &r.TenantID, &r.UserID, &r.ConversationID, &r.MessageID, &r.Title, &r.Kind, &r.FilePath, &r.Watermark, &r.TraceCode, &r.CreateTime)
	return r, err
}

func (s *Store) ListWhitelist(tenantID string) ([]WhitelistTerm, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, term, create_time FROM whitelist_terms WHERE tenant_id=? ORDER BY term`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []WhitelistTerm
	for rows.Next() {
		var w WhitelistTerm
		if err := rows.Scan(&w.ID, &w.TenantID, &w.Term, &w.CreateTime); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

func (s *Store) WhitelistTerms(tenantID string) ([]string, error) {
	items, err := s.ListWhitelist(tenantID)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(items))
	for _, it := range items {
		out = append(out, it.Term)
	}
	return out, nil
}

func (s *Store) AddWhitelist(tenantID, term string) (WhitelistTerm, error) {
	w := WhitelistTerm{ID: NewID(), TenantID: tenantID, Term: strings.TrimSpace(term), CreateTime: Now()}
	_, err := s.db.Exec(`INSERT INTO whitelist_terms (id, tenant_id, term, create_time) VALUES (?,?,?,?)`, w.ID, w.TenantID, w.Term, w.CreateTime)
	return w, err
}

func (s *Store) DeleteWhitelist(id, tenantID string) error {
	_, err := s.db.Exec(`DELETE FROM whitelist_terms WHERE id=? AND tenant_id=?`, id, tenantID)
	return err
}

func (s *Store) ListLearningStats(u User) ([]LearningStat, error) {
	rows, err := s.db.Query(`SELECT id, tenant_id, department, class_name, subject, summary FROM learning_stats WHERE tenant_id=?`, u.TenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []LearningStat
	for rows.Next() {
		var st LearningStat
		if err := rows.Scan(&st.ID, &st.TenantID, &st.Department, &st.ClassName, &st.Subject, &st.Summary); err != nil {
			return nil, err
		}
		if u.Role == "admin" || u.Role == "school_admin" || st.Department == u.Department {
			out = append(out, st)
		}
	}
	return out, rows.Err()
}

func (s *Store) Seed() error {
	var n int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(DemoPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	now := Now()
	if _, err := s.db.Exec(`INSERT INTO tenants (id, name, contact, security_config_json) VALUES (?,?,?,?)`,
		TenantID, "示范小学", "admin@school.local", `{"desensitize":"standard","model_allow":["local-edu-small"]}`); err != nil {
		return err
	}
	users := []User{
		{UserAdmin, "admin", string(hash), TenantID, "admin", "平台", "系统管理员", now, "active"},
		{UserSchool, "school", string(hash), TenantID, "school_admin", "校务", "校务管理员", now, "active"},
		{UserLead, "lead", string(hash), TenantID, "group_lead", "语文教研组", "语文组长", now, "active"},
		{UserTeacher, "teacher", string(hash), TenantID, "teacher", "语文教研组", "语文教师", now, "active"},
		{UserMath, "math", string(hash), TenantID, "teacher", "数学教研组", "数学教师", now, "active"},
	}
	for _, u := range users {
		if _, err := s.db.Exec(`INSERT INTO users (id, username, password_hash, tenant_id, role, department, display_name, create_time, status) VALUES (?,?,?,?,?,?,?,?,?)`,
			u.ID, u.Username, u.PasswordHash, u.TenantID, u.Role, u.Department, u.DisplayName, u.CreateTime, u.Status); err != nil {
			return err
		}
	}
	kbs := []KB{
		{KBYuwen, TenantID, "小学语文课标与教案", "公开课标摘录与比喻句教学提示，供备课引用。", UserLead, "public", "语文教研组", "[]", now},
		{KBMath, TenantID, "小学数学教研组资料", "分数初步认识等教研组共享材料。", UserMath, "group", "数学教研组", "[]", now},
		{KBScience, TenantID, "小学科学公开要点", "光合作用等科学常识，用于知识点校验对照。", UserSchool, "public", "校务", "[]", now},
	}
	for _, k := range kbs {
		if err := s.CreateKB(k); err != nil {
			return err
		}
	}
	type seeded struct {
		kb, name, text string
	}
	docs := []seeded{
		{KBYuwen, "小学语文三年级-比喻句.txt", "小学三年级语文课标摘录：比喻句是把一种事物比作另一种有相似点的事物，常见词语有像、好像、仿佛、如同。教学时先让学生观察校园景物，再口头仿写一句，最后写到练习本上。评价时看本体、喻体是否清楚，不要把高年级篇章提前搬进三年级课堂。"},
		{KBYuwen, "小学语文-朗读要求.txt", "小学语文朗读要求：能用普通话正确、流利、有感情地朗读课文。低年级侧重生字认读和句读，中年级开始关注语气和段落。"},
		{KBMath, "小学数学三年级-分数初步.txt", "小学三年级数学：分数初步认识。把一个物体或一个整体平均分成几份，其中的一份或几份可以用分数表示。教学时用折纸、分月饼等实物，强调平均分。先不要引入繁分式运算。"},
		{KBScience, "小学科学-光合作用.txt", "小学科学：光合作用需要光。绿色植物在光照下，利用二氧化碳和水制造有机物并放出氧气。没有光就不能进行光合作用。"},
	}
	for _, d := range docs {
		docID := NewID()
		doc := Document{ID: docID, KBID: d.kb, FileName: d.name, Status: "finished", UploadUserID: UserSchool, UploadTime: now, Preview: d.text}
		if err := s.CreateDocument(doc); err != nil {
			return err
		}
		id := NewID()
		vec, _ := json.Marshal(rag.Embed(d.text))
		meta := `{"doc_type":"curriculum"}`
		if err := s.InsertChunks([]Chunk{{ID: id, DocID: docID, KBID: d.kb, Text: d.text, MetaJSON: meta, VectorJSON: string(vec), VectorID: id}}); err != nil {
			return err
		}
	}
	plugins := []Plugin{
		{"lesson", "文档生成", "生成教案、教学计划、教研总结和评语", "document", "builtin://lesson", "{}", "{}"},
		{"ppt", "PPT课件大纲", "输出可直接上讲台的分页课件大纲", "ppt", "builtin://ppt", "{}", "{}"},
		{"quiz", "出题组卷", "按知识点和难度生成习题、答案与解析", "quiz", "builtin://quiz", "{}", "{}"},
		{"grade", "智能批改", "客观题判分，主观题踩点，全程留在校内", "grade", "builtin://grade", "{}", "{}"},
		{"analytics", "学情分析", "只读取脱敏后的班级汇总指标并生成报告", "analytics", "builtin://analytics", "{}", "{}"},
		{"rewrite", "文档解析重构", "把旧教案整理成结构完整的教学设计", "rewrite", "builtin://rewrite", "{}", "{}"},
	}
	for _, p := range plugins {
		if _, err := s.db.Exec(`INSERT INTO plugins (id, name, description, plugin_type, invoke_address, input_schema, output_schema) VALUES (?,?,?,?,?,?,?)`,
			p.ID, p.Name, p.Description, p.PluginType, p.InvokeAddress, p.InputSchema, p.OutputSchema); err != nil {
			return err
		}
	}
	agents := []Agent{
		{ID: AgentYuwen, TenantID: TenantID, Name: "语文备课助手", Description: "依据校本语文资料写教案、课件大纲和练习。", SystemPrompt: "你是小学语文备课助手。优先引用知识库里的课标和教案表述，语言要能直接用于课堂。", OwnerID: UserLead, ShareType: "public", Department: "语文教研组", KBIDs: []string{KBYuwen}, PluginIDs: []string{"lesson", "ppt", "quiz", "rewrite", "grade"}, CreateTime: now},
		{ID: AgentMath, TenantID: TenantID, Name: "数学出题助手", Description: "面向数学教研组，生成分数等内容的练习。", SystemPrompt: "你是小学数学出题助手。题目必须落在已学知识点内，并给出答案解析。", OwnerID: UserMath, ShareType: "group", Department: "数学教研组", KBIDs: []string{KBMath}, PluginIDs: []string{"quiz", "lesson"}, CreateTime: now},
		{ID: AgentReport, TenantID: TenantID, Name: "学情分析助手", Description: "只根据班级汇总指标写学情报告，不接触学生明细。", SystemPrompt: "你只讨论班级汇总指标。禁止推测或索要学生姓名、学号和个人分数。", OwnerID: UserSchool, ShareType: "public", Department: "校务", KBIDs: nil, PluginIDs: []string{"analytics"}, CreateTime: now},
	}
	for _, a := range agents {
		if err := s.CreateAgent(a); err != nil {
			return err
		}
	}
	seenTerm := map[string]struct{}{}
	for _, term := range desensitize.DefaultTerms() {
		if _, ok := seenTerm[term]; ok {
			continue
		}
		seenTerm[term] = struct{}{}
		if _, err := s.db.Exec(`INSERT INTO whitelist_terms (id, tenant_id, term, create_time) VALUES (?,?,?,?)`, NewID(), TenantID, term, now); err != nil {
			return err
		}
	}
	stats := []LearningStat{
		{NewID(), TenantID, "语文教研组", "三年级1班", "语文", "三年级1班语文：平均表现处于中等偏上，优秀率约三成，及格率接近全体。薄弱点为比喻句仿写和段落概括。此为汇总指标，不含学生姓名与个人分数。"},
		{NewID(), TenantID, "数学教研组", "三年级2班", "数学", "三年级2班数学：整体达到课堂目标，薄弱点为平均分的含义和看图列式。此为汇总指标，不含学生姓名与个人分数。"},
	}
	for _, st := range stats {
		if _, err := s.db.Exec(`INSERT INTO learning_stats (id, tenant_id, department, class_name, subject, summary) VALUES (?,?,?,?,?,?)`,
			st.ID, st.TenantID, st.Department, st.ClassName, st.Subject, st.Summary); err != nil {
			return err
		}
	}
	return nil
}

func clip(s string, n int) string {
	rs := []rune(s)
	if len(rs) <= n {
		return s
	}
	return string(rs[:n])
}
