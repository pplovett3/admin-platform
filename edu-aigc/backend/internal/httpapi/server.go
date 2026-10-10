package httpapi

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"edu-aigc/internal/auth"
	"edu-aigc/internal/chat"
	"edu-aigc/internal/desensitize"
	"edu-aigc/internal/ingest"
	"edu-aigc/internal/modelgw"
	"edu-aigc/internal/rag"
	"edu-aigc/internal/store"
)

type Server struct {
	Store      *store.Store
	Secret     []byte
	DataKey    []byte
	Gateway    *modelgw.Gateway
	StaticDir  string
	DailyLimit int
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("POST /api/auth/login", s.login)
	mux.HandleFunc("GET /api/auth/me", s.me)
	mux.HandleFunc("POST /api/chat/conversation", s.createConversation)
	mux.HandleFunc("GET /api/chat/conversation/list", s.listConversations)
	mux.HandleFunc("GET /api/chat/conversation", s.getConversation)
	mux.HandleFunc("POST /api/chat/message", s.postMessage)
	mux.HandleFunc("POST /api/agent/create", s.createAgent)
	mux.HandleFunc("GET /api/agent/list", s.listAgents)
	mux.HandleFunc("PUT /api/agent/update", s.updateAgent)
	mux.HandleFunc("DELETE /api/agent/delete", s.deleteAgent)
	mux.HandleFunc("GET /api/plugin/list", s.listPlugins)
	mux.HandleFunc("POST /api/knowledge/create", s.createKB)
	mux.HandleFunc("GET /api/knowledge/list", s.listKB)
	mux.HandleFunc("POST /api/knowledge/upload", s.upload)
	mux.HandleFunc("GET /api/knowledge/document/list", s.listDocs)
	mux.HandleFunc("GET /api/knowledge/document", s.getDoc)
	mux.HandleFunc("POST /api/knowledge/search", s.search)
	mux.HandleFunc("GET /api/resource/list", s.listResources)
	mux.HandleFunc("GET /api/resource/download", s.download)
	mux.HandleFunc("GET /api/audit/log/list", s.listAudit)
	mux.HandleFunc("GET /api/whitelist", s.listWhitelist)
	mux.HandleFunc("POST /api/whitelist", s.addWhitelist)
	mux.HandleFunc("DELETE /api/whitelist", s.deleteWhitelist)
	mux.HandleFunc("GET /api/learning/stats", s.learningStats)
	mux.HandleFunc("/", s.static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "校本智教"})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, 400, "请求格式不正确")
		return
	}
	u, err := s.Store.Login(strings.TrimSpace(body.Username), body.Password)
	if err != nil {
		_ = s.Store.AddAudit(store.Audit{TenantID: store.TenantID, UserID: "", IP: ipOf(r), OperationType: "login", OperationDetail: "登录失败", Result: "denied"})
		writeErr(w, 401, err.Error())
		return
	}
	tok, err := auth.Sign(s.Secret, u.ID, 24*time.Hour)
	if err != nil {
		writeErr(w, 500, "签发登录状态失败")
		return
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "login", ResourceType: "user", ResourceID: u.ID, OperationDetail: "登录成功", Result: "success"})
	writeJSON(w, 200, map[string]any{"token": tok, "user": u})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	writeJSON(w, 200, map[string]any{"user": u})
}

func (s *Server) createConversation(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	var body struct {
		AgentID string `json:"agent_id"`
		Title   string `json:"title"`
	}
	if err := readJSON(r, &body); err != nil || body.AgentID == "" {
		writeErr(w, 400, "请选择智能体")
		return
	}
	ag, err := s.Store.GetAgent(body.AgentID)
	if err != nil || !store.CanReadAgent(u, ag) {
		writeErr(w, 403, "无权使用该智能体")
		return
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = "新对话"
	}
	now := store.Now()
	c := store.Conversation{ID: store.NewID(), UserID: u.ID, AgentID: ag.ID, Title: title, CreateTime: now, ExpireTime: time.Now().UTC().Add(30 * 24 * time.Hour).Format(time.RFC3339)}
	if err := s.Store.CreateConversation(c); err != nil {
		writeErr(w, 500, "创建会话失败")
		return
	}
	writeJSON(w, 200, c)
}

func (s *Server) listConversations(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListConversations(u.ID)
	if err != nil {
		writeErr(w, 500, "读取会话失败")
		return
	}
	if items == nil {
		items = []store.Conversation{}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) getConversation(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	c, err := s.Store.GetConversation(r.URL.Query().Get("id"))
	if err != nil || c.UserID != u.ID {
		writeErr(w, 404, "会话不存在")
		return
	}
	msgs, err := s.Store.ListMessages(c.ID)
	if err != nil {
		writeErr(w, 500, "读取消息失败")
		return
	}
	if msgs == nil {
		msgs = []store.Message{}
	}
	writeJSON(w, 200, map[string]any{"conversation": c, "messages": msgs})
}

func (s *Server) postMessage(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	var body struct {
		ConversationID string `json:"conversation_id"`
		Content        string `json:"content"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, 400, "请求格式不正确")
		return
	}
	orch := chat.Orchestrator{Store: s.Store, Gateway: s.Gateway, DailyLimit: s.DailyLimit}
	reply, err := orch.Send(r.Context(), u, body.ConversationID, body.Content, ipOf(r))
	if err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	writeJSON(w, 200, reply)
}

func (s *Server) createAgent(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	var a store.Agent
	if err := readJSON(r, &a); err != nil || strings.TrimSpace(a.Name) == "" {
		writeErr(w, 400, "请填写智能体名称")
		return
	}
	if a.ShareType == "" {
		a.ShareType = "private"
	}
	if !store.AllowedShare(u, a.ShareType) {
		writeErr(w, 403, "当前角色不能使用该共享范围")
		return
	}
	a.ID = store.NewID()
	a.TenantID = u.TenantID
	a.OwnerID = u.ID
	if a.Department == "" {
		a.Department = u.Department
	}
	if a.ShareType == "group" {
		a.Department = u.Department
	}
	a.KBIDs = s.filterReadableKB(u, a.KBIDs)
	a.CreateTime = store.Now()
	if err := s.Store.CreateAgent(a); err != nil {
		writeErr(w, 500, "创建智能体失败")
		return
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "agent_create", ResourceType: "agent", ResourceID: a.ID, OperationDetail: "创建智能体 " + a.Name})
	writeJSON(w, 200, a)
}

func (s *Server) updateAgent(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	var body store.Agent
	if err := readJSON(r, &body); err != nil || body.ID == "" {
		writeErr(w, 400, "缺少智能体编号")
		return
	}
	old, err := s.Store.GetAgent(body.ID)
	if err != nil || !store.CanWriteAgent(u, old) {
		writeErr(w, 403, "无权修改该智能体")
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		body.Name = old.Name
	}
	if body.ShareType == "" {
		body.ShareType = old.ShareType
	}
	if !store.AllowedShare(u, body.ShareType) {
		writeErr(w, 403, "当前角色不能使用该共享范围")
		return
	}
	old.Name = body.Name
	old.Description = body.Description
	old.SystemPrompt = body.SystemPrompt
	old.ShareType = body.ShareType
	old.KBIDs = s.filterReadableKB(u, body.KBIDs)
	old.PluginIDs = body.PluginIDs
	if body.ShareType == "group" {
		old.Department = u.Department
	} else if body.Department != "" {
		old.Department = body.Department
	}
	if err := s.Store.UpdateAgent(old); err != nil {
		writeErr(w, 500, "更新失败")
		return
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "agent_update", ResourceType: "agent", ResourceID: old.ID, OperationDetail: "更新智能体 " + old.Name})
	writeJSON(w, 200, old)
}

func (s *Server) deleteAgent(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	id := r.URL.Query().Get("id")
	old, err := s.Store.GetAgent(id)
	if err != nil || !store.CanWriteAgent(u, old) {
		writeErr(w, 403, "无权删除该智能体")
		return
	}
	if err := s.Store.DeleteAgent(id); err != nil {
		writeErr(w, 500, "删除失败")
		return
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "agent_delete", ResourceType: "agent", ResourceID: id, OperationDetail: "删除智能体 " + old.Name})
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

func (s *Server) listAgents(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListAgents(u)
	if err != nil {
		writeErr(w, 500, "读取智能体失败")
		return
	}
	if items == nil {
		items = []store.Agent{}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) listPlugins(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.mustUser(w, r); !ok {
		return
	}
	items, err := s.Store.ListPlugins()
	if err != nil {
		writeErr(w, 500, "读取插件失败")
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) createKB(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	var k store.KB
	if err := readJSON(r, &k); err != nil || strings.TrimSpace(k.Name) == "" {
		writeErr(w, 400, "请填写知识库名称")
		return
	}
	if k.ShareType == "" {
		k.ShareType = "private"
	}
	if !store.AllowedShare(u, k.ShareType) {
		writeErr(w, 403, "当前角色不能使用该共享范围")
		return
	}
	k.ID = store.NewID()
	k.TenantID = u.TenantID
	k.OwnerID = u.ID
	k.Department = u.Department
	k.ACLUserIDs = "[]"
	k.CreatedAt = store.Now()
	if err := s.Store.CreateKB(k); err != nil {
		writeErr(w, 500, "创建知识库失败")
		return
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "kb_create", ResourceType: "knowledge", ResourceID: k.ID, OperationDetail: "创建知识库 " + k.Name})
	writeJSON(w, 200, k)
}

func (s *Server) listKB(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListKB(u)
	if err != nil {
		writeErr(w, 500, "读取知识库失败")
		return
	}
	if items == nil {
		items = []store.KB{}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) upload(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 20<<20+1024)
	if err := r.ParseMultipartForm(21 << 20); err != nil {
		writeErr(w, 400, "文件过大或格式不正确，单个文件请小于 20MB")
		return
	}
	kbID := r.FormValue("kb_id")
	kb, err := s.Store.GetKB(kbID)
	if err != nil || !store.CanWriteKB(u, kb) {
		writeErr(w, 403, "无权向该知识库上传")
		return
	}
	file, hdr, err := r.FormFile("file")
	if err != nil {
		writeErr(w, 400, "请选择文件")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, 20<<20+1))
	if err != nil || len(data) > 20<<20 {
		writeErr(w, 400, "单个文件请小于 20MB")
		return
	}
	name := filepath.Base(hdr.Filename)
	doc := store.Document{ID: store.NewID(), KBID: kb.ID, FileName: name, Status: "uploading", UploadUserID: u.ID, UploadTime: store.Now()}
	if err := s.Store.CreateDocument(doc); err != nil {
		writeErr(w, 500, "登记文档失败")
		return
	}
	terms, _ := s.Store.WhitelistTerms(u.TenantID)
	eng := desensitizer(terms)
	doc, err = ingest.Process(s.Store, eng, s.DataKey, doc, data)
	if err != nil {
		writeErr(w, 500, "处理文档失败")
		return
	}
	op := "upload"
	result := "success"
	if doc.Status == "blocked" {
		op = "desensitize_block"
		result = "blocked"
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: op, ResourceType: "document", ResourceID: doc.ID, OperationDetail: "上传 " + name + " 状态=" + doc.Status, Result: result})
	writeJSON(w, 200, doc)
}

func (s *Server) listDocs(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	kb, err := s.Store.GetKB(r.URL.Query().Get("kb_id"))
	if err != nil || !store.CanReadKB(u, kb) {
		writeErr(w, 403, "无权查看该知识库")
		return
	}
	items, err := s.Store.ListDocuments(kb.ID)
	if err != nil {
		writeErr(w, 500, "读取文档失败")
		return
	}
	if items == nil {
		items = []store.Document{}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) getDoc(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	doc, err := s.Store.GetDocument(r.URL.Query().Get("id"))
	if err != nil {
		writeErr(w, 404, "文档不存在")
		return
	}
	kb, err := s.Store.GetKB(doc.KBID)
	if err != nil || !store.CanReadKB(u, kb) {
		writeErr(w, 403, "无权查看该文档")
		return
	}
	writeJSON(w, 200, doc)
}

func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	var body struct {
		KBIDs []string `json:"kb_ids"`
		Query string   `json:"query"`
	}
	if err := readJSON(r, &body); err != nil || strings.TrimSpace(body.Query) == "" {
		writeErr(w, 400, "请输入检索问题")
		return
	}
	allowed := s.filterReadableKB(u, body.KBIDs)
	chunks, err := s.Store.ListChunks(allowed)
	if err != nil {
		writeErr(w, 500, "检索失败")
		return
	}
	ragChunks := make([]rag.Chunk, 0, len(chunks))
	for _, c := range chunks {
		ragChunks = append(ragChunks, rag.Chunk{ID: c.ID, DocID: c.DocID, KBID: c.KBID, Text: c.Text, Meta: c.MetaJSON, Vector: c.Vector})
	}
	hits := rag.Retrieve(body.Query, ragChunks, 5, 1800)
	type item struct {
		DocID    string  `json:"doc_id"`
		KBID     string  `json:"kb_id"`
		FileName string  `json:"file_name"`
		Snippet  string  `json:"snippet"`
		Score    float64 `json:"score"`
	}
	out := make([]item, 0, len(hits))
	for _, h := range hits {
		name := ""
		if doc, err := s.Store.GetDocument(h.Chunk.DocID); err == nil {
			name = doc.FileName
		}
		sn := h.Chunk.Text
		rs := []rune(sn)
		if len(rs) > 180 {
			sn = string(rs[:180])
		}
		out = append(out, item{DocID: h.Chunk.DocID, KBID: h.Chunk.KBID, FileName: name, Snippet: sn, Score: h.Score})
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "retrieve", ResourceType: "knowledge", OperationDetail: "手动检索 命中=" + itoa(len(out))})
	writeJSON(w, 200, map[string]any{"items": out})
}

func (s *Server) listResources(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListResources(u)
	if err != nil {
		writeErr(w, 500, "读取资源失败")
		return
	}
	if items == nil {
		items = []store.Resource{}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) download(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	res, err := s.Store.GetResource(r.URL.Query().Get("id"))
	if err != nil {
		writeErr(w, 404, "资源不存在")
		return
	}
	owner, err := s.Store.UserByID(res.UserID)
	if err != nil {
		writeErr(w, 404, "资源不存在")
		return
	}
	allowed := u.Role == "admin" || (u.Role == "school_admin" && u.TenantID == res.TenantID) || res.UserID == u.ID || (u.Role == "group_lead" && owner.Department == u.Department && owner.TenantID == u.TenantID)
	if !allowed {
		writeErr(w, 403, "无权下载该资源")
		return
	}
	f, err := os.Open(res.FilePath)
	if err != nil {
		writeErr(w, 404, "文件已丢失")
		return
	}
	defer f.Close()
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "download", ResourceType: "resource", ResourceID: res.ID, OperationDetail: "下载生成资源"})
	w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+res.ID+".docx\"")
	_, _ = io.Copy(w, f)
}

func (s *Server) listAudit(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListAudit(u, 80)
	if err != nil {
		writeErr(w, 500, "读取审计日志失败")
		return
	}
	if items == nil {
		items = []store.Audit{}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) listWhitelist(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListWhitelist(u.TenantID)
	if err != nil {
		writeErr(w, 500, "读取白名单失败")
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) addWhitelist(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && u.Role != "school_admin" {
		writeErr(w, 403, "只有管理员可以维护白名单")
		return
	}
	var body struct {
		Term string `json:"term"`
	}
	if err := readJSON(r, &body); err != nil || strings.TrimSpace(body.Term) == "" {
		writeErr(w, 400, "请填写词语")
		return
	}
	if len([]rune(strings.TrimSpace(body.Term))) > 32 {
		writeErr(w, 400, "词语请控制在 32 字以内")
		return
	}
	item, err := s.Store.AddWhitelist(u.TenantID, body.Term)
	if err != nil {
		writeErr(w, 400, "该词已在白名单中")
		return
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "whitelist_update", ResourceType: "whitelist", ResourceID: item.ID, OperationDetail: "新增白名单词"})
	writeJSON(w, 200, item)
}

func (s *Server) deleteWhitelist(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && u.Role != "school_admin" {
		writeErr(w, 403, "只有管理员可以维护白名单")
		return
	}
	id := r.URL.Query().Get("id")
	if err := s.Store.DeleteWhitelist(id, u.TenantID); err != nil {
		writeErr(w, 500, "删除失败")
		return
	}
	_ = s.Store.AddAudit(store.Audit{TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "whitelist_update", ResourceType: "whitelist", ResourceID: id, OperationDetail: "删除白名单词"})
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

func (s *Server) learningStats(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListLearningStats(u)
	if err != nil {
		writeErr(w, 500, "读取学情汇总失败")
		return
	}
	if items == nil {
		items = []store.LearningStat{}
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) static(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		writeErr(w, 404, "接口不存在")
		return
	}
	dir := s.StaticDir
	if dir == "" {
		for _, c := range []string{"../frontend/dist", "frontend/dist", "/srv/web"} {
			if st, err := os.Stat(filepath.Join(c, "index.html")); err == nil && !st.IsDir() {
				dir = c
				break
			}
		}
	}
	if dir == "" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte("<!doctype html><meta charset=utf-8><title>校本智教</title><p>前端尚未构建。请在 frontend 目录执行 npm install 与 npm run build。</p>"))
		return
	}
	path := filepath.Clean(r.URL.Path)
	if path == "/" || path == "." {
		path = "/index.html"
	}
	full := filepath.Join(dir, path)
	if !strings.HasPrefix(full, filepath.Clean(dir)) {
		writeErr(w, 400, "路径不正确")
		return
	}
	if st, err := os.Stat(full); err != nil || st.IsDir() {
		full = filepath.Join(dir, "index.html")
	}
	http.ServeFile(w, r, full)
}

func (s *Server) filterReadableKB(u store.User, ids []string) []string {
	var out []string
	for _, id := range ids {
		kb, err := s.Store.GetKB(id)
		if err == nil && store.CanReadKB(u, kb) {
			out = append(out, id)
		}
	}
	if out == nil {
		return []string{}
	}
	return out
}

func (s *Server) mustUser(w http.ResponseWriter, r *http.Request) (store.User, bool) {
	h := r.Header.Get("Authorization")
	token := strings.TrimPrefix(h, "Bearer ")
	if token == "" || token == h {
		writeErr(w, 401, "请先登录")
		return store.User{}, false
	}
	uid, err := auth.Parse(s.Secret, token)
	if err != nil {
		writeErr(w, 401, err.Error())
		return store.User{}, false
	}
	u, err := s.Store.UserByID(uid)
	if err != nil || u.Status != "active" {
		writeErr(w, 401, "请先登录")
		return store.User{}, false
	}
	return u, true
}

func desensitizer(terms []string) *desensitize.Engine {
	if len(terms) == 0 {
		return desensitize.New(nil)
	}
	return desensitize.FromList(terms)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	return dec.Decode(v)
}

func ipOf(r *http.Request) string {
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i > 0 {
		return host[:i]
	}
	return host
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [16]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
