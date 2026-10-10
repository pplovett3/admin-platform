package httpapi

import (
	"net/http"
	"strings"

	"edu-aigc/internal/identity"
	"edu-aigc/internal/ingest"
	"edu-aigc/internal/modelgw"
	"edu-aigc/internal/store"
)

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	cfg, _ := s.Store.Settings(u.TenantID)
	writeJSON(w, 200, s.settingsView(cfg))
}

func (s *Server) putSettings(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && u.Role != "school_admin" {
		writeErr(w, 403, "只有学校管理员可以修改学校设定")
		return
	}
	var body struct {
		ModelBaseURL      string `json:"model_base_url"`
		ModelName         string `json:"model_name"`
		ModelAPIKey       string `json:"model_api_key"`
		ClearModelKey     bool   `json:"clear_model_key"`
		OCREngine         string `json:"ocr_engine"`
		IdentityMode      string `json:"identity_mode"`
		CurriculumVersion string `json:"curriculum_version"`
		CurriculumSource  string `json:"curriculum_source"`
		CurriculumNote    string `json:"curriculum_note"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, 400, "请求格式不正确")
		return
	}
	cfg, _ := s.Store.Settings(u.TenantID)
	cfg.TenantID = u.TenantID
	cfg.ModelBaseURL = strings.TrimSpace(body.ModelBaseURL)
	cfg.ModelName = strings.TrimSpace(body.ModelName)
	cfg.OCREngine = store.NormalizeOCR(body.OCREngine)
	cfg.IdentityMode = store.NormalizeIdentity(body.IdentityMode)
	cfg.CurriculumVersion = strings.TrimSpace(body.CurriculumVersion)
	cfg.CurriculumSource = strings.TrimSpace(body.CurriculumSource)
	cfg.CurriculumNote = strings.TrimSpace(body.CurriculumNote)
	switch {
	case body.ClearModelKey:
		cfg.ModelAPIKey = ""
	case keepMaskedKey(body.ModelAPIKey):
		// 留空或掩码表示不改已保存的密钥。
	default:
		cfg.ModelAPIKey = strings.TrimSpace(body.ModelAPIKey)
	}
	if err := s.Store.SaveSettings(cfg); err != nil {
		writeErr(w, 500, "保存学校设定失败")
		return
	}
	gw := s.effectiveGateway(cfg)
	_ = s.Store.AddAudit(store.Audit{
		TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "settings_update",
		ResourceType: "settings", ResourceID: u.TenantID,
		OperationDetail: "更新学校设定 课标=" + boolCN(cfg.CurriculumVersion != "" || cfg.CurriculumSource != "") + " OCR=" + cfg.OCREngine + " 身份=" + cfg.IdentityMode + " 出校=" + boolCN(gw.LessonCanLeaveCampus()),
	})
	saved, _ := s.Store.Settings(u.TenantID)
	writeJSON(w, 200, s.settingsView(saved))
}

func (s *Server) settingsView(cfg store.SchoolSettings) map[string]any {
	gw := s.effectiveGateway(cfg)
	hasT, hasP := ingest.DetectEngines()
	active := identity.Active(cfg.IdentityMode)
	return map[string]any{
		"model_base_url":        cfg.ModelBaseURL,
		"model_name":            cfg.ModelName,
		"model_api_key_set":     strings.TrimSpace(cfg.ModelAPIKey) != "",
		"lesson_egress":         gw.LessonCanLeaveCampus(),
		"ocr_engine":            cfg.OCREngine,
		"ocr_available":         map[string]bool{"tesseract": hasT, "paddle": hasP},
		"identity_mode":         cfg.IdentityMode,
		"identity_active":       active.Mode(),
		"identity_providers":    identity.Catalog(cfg.IdentityMode),
		"curriculum_version":    cfg.CurriculumVersion,
		"curriculum_source":     cfg.CurriculumSource,
		"curriculum_note":       cfg.CurriculumNote,
		"using_demo_curriculum": cfg.UsingDemo(),
		"curriculum_label":      cfg.CurriculumLabel(),
	}
}

func (s *Server) effectiveGateway(cfg store.SchoolSettings) modelgw.Gateway {
	return modelgw.Overlay(s.Gateway, cfg.ModelBaseURL, cfg.ModelAPIKey, cfg.ModelName)
}

func keepMaskedKey(key string) bool {
	key = strings.TrimSpace(key)
	if key == "" {
		return true
	}
	for _, r := range key {
		if r != '*' && r != '•' && r != '·' {
			return false
		}
	}
	return true
}

func (s *Server) listGroups(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListGroups(u)
	if err != nil {
		writeErr(w, 500, "读取教研组失败")
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) saveGroup(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && u.Role != "school_admin" {
		writeErr(w, 403, "只有学校管理员可以维护教研组")
		return
	}
	var g store.ResearchGroup
	if err := readJSON(r, &g); err != nil {
		writeErr(w, 400, "请求格式不正确")
		return
	}
	if g.ID == "" {
		g.ID = store.NewID()
		g.CreatedAt = store.Now()
	} else {
		old, err := s.Store.GetGroup(g.ID)
		if err != nil || (u.Role != "admin" && old.TenantID != u.TenantID) {
			writeErr(w, 404, "教研组不存在")
			return
		}
		if g.CreatedAt == "" {
			g.CreatedAt = old.CreatedAt
		}
	}
	g.TenantID = u.TenantID
	if u.Role == "admin" && g.TenantID == "" {
		g.TenantID = store.TenantID
	}
	if err := s.Store.SaveGroup(g); err != nil {
		writeErr(w, 400, err.Error())
		return
	}
	_ = s.Store.AddAudit(store.Audit{
		TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "group_save",
		ResourceType: "group", ResourceID: g.ID, OperationDetail: "保存教研组 " + g.Name + " 类型=" + g.Mode,
	})
	writeJSON(w, 200, g)
}

func (s *Server) deleteGroup(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && u.Role != "school_admin" {
		writeErr(w, 403, "只有学校管理员可以维护教研组")
		return
	}
	id := r.URL.Query().Get("id")
	g, err := s.Store.GetGroup(id)
	if err != nil || (u.Role != "admin" && g.TenantID != u.TenantID) {
		writeErr(w, 404, "教研组不存在")
		return
	}
	if err := s.Store.DeleteGroup(id, g.TenantID); err != nil {
		writeErr(w, 500, "删除教研组失败")
		return
	}
	_ = s.Store.AddAudit(store.Audit{
		TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "group_delete",
		ResourceType: "group", ResourceID: id, OperationDetail: "删除教研组 " + g.Name,
	})
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

func (s *Server) addMember(w http.ResponseWriter, r *http.Request) {
	s.changeMember(w, r, true)
}

func (s *Server) removeMember(w http.ResponseWriter, r *http.Request) {
	s.changeMember(w, r, false)
}

func (s *Server) changeMember(w http.ResponseWriter, r *http.Request, add bool) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && u.Role != "school_admin" {
		writeErr(w, 403, "只有学校管理员可以调整教研组成员")
		return
	}
	groupID := r.URL.Query().Get("group_id")
	userID := r.URL.Query().Get("user_id")
	if add {
		var body struct {
			GroupID string `json:"group_id"`
			UserID  string `json:"user_id"`
		}
		if err := readJSON(r, &body); err != nil {
			writeErr(w, 400, "请求格式不正确")
			return
		}
		groupID, userID = body.GroupID, body.UserID
	}
	if groupID == "" || userID == "" {
		writeErr(w, 400, "请指定教研组和成员")
		return
	}
	g, err := s.Store.GetGroup(groupID)
	if err != nil || (u.Role != "admin" && g.TenantID != u.TenantID) {
		writeErr(w, 404, "教研组不存在")
		return
	}
	member, err := s.Store.UserByID(userID)
	if err != nil || member.TenantID != g.TenantID {
		writeErr(w, 404, "用户不存在")
		return
	}
	if add {
		err = s.Store.AddMember(groupID, userID)
	} else {
		err = s.Store.RemoveMember(groupID, userID)
	}
	if err != nil {
		writeErr(w, 500, "更新成员失败")
		return
	}
	action := "移出"
	if add {
		action = "加入"
	}
	_ = s.Store.AddAudit(store.Audit{
		TenantID: u.TenantID, UserID: u.ID, IP: ipOf(r), OperationType: "group_member",
		ResourceType: "group", ResourceID: groupID, OperationDetail: action + "成员 " + member.DisplayName,
	})
	writeJSON(w, 200, map[string]string{"ok": "true"})
}

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	u, ok := s.mustUser(w, r)
	if !ok {
		return
	}
	if u.Role != "admin" && u.Role != "school_admin" {
		writeErr(w, 403, "只有学校管理员可以查看账号列表")
		return
	}
	items, err := s.Store.ListUsers(u.TenantID)
	if err != nil {
		writeErr(w, 500, "读取账号失败")
		return
	}
	writeJSON(w, 200, map[string]any{"items": items})
}

func (s *Server) bindGroup(w http.ResponseWriter, u store.User, share, groupID string) (string, string, bool) {
	if share != "group" {
		return "", "", true
	}
	groupID = strings.TrimSpace(groupID)
	if groupID == "" {
		writeErr(w, 400, "教研组共享请选择教研组")
		return "", "", false
	}
	g, err := s.Store.GetGroup(groupID)
	if err != nil || (u.Role != "admin" && g.TenantID != u.TenantID) {
		writeErr(w, 404, "教研组不存在")
		return "", "", false
	}
	if u.Role != "admin" && u.Role != "school_admin" && !userInGroup(u, g.ID) {
		writeErr(w, 403, "只能共享到自己所在的教研组")
		return "", "", false
	}
	return g.ID, g.Name, true
}

func userInGroup(u store.User, groupID string) bool {
	for _, id := range u.GroupIDs {
		if id == groupID {
			return true
		}
	}
	return false
}

func boolCN(v bool) string {
	if v {
		return "是"
	}
	return "否"
}
