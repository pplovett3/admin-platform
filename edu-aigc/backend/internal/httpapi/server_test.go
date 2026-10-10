package httpapi

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"edu-aigc/internal/ingest"
	"edu-aigc/internal/secure"
	"edu-aigc/internal/store"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	dir := t.TempDir()
	st, err := store.Open(filepath.Join(dir, "app.db"), dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { st.Close() })
	if err := st.Migrate(); err != nil {
		t.Fatal(err)
	}
	if err := st.Seed(); err != nil {
		t.Fatal(err)
	}
	srv := &Server{Store: st, Secret: []byte("test-secret"), DataKey: secure.KeyFrom("test-key"), DailyLimit: 50}
	return httptest.NewServer(srv.Handler())
}

func login(t *testing.T, base, username string) string {
	t.Helper()
	res := do(t, http.MethodPost, base+"/api/auth/login", "", map[string]string{"username": username, "password": store.DemoPassword})
	if res.StatusCode != 200 {
		b, _ := io.ReadAll(res.Body)
		t.Fatalf("登录失败 %s %s", username, b)
	}
	var body struct {
		Token string `json:"token"`
	}
	decode(t, res, &body)
	if body.Token == "" {
		t.Fatal("缺少 token")
	}
	return body.Token
}

func do(t *testing.T, method, url, token string, payload any) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	if payload != nil {
		if err := json.NewEncoder(&buf).Encode(payload); err != nil {
			t.Fatal(err)
		}
	}
	req, err := http.NewRequest(method, url, &buf)
	if err != nil {
		t.Fatal(err)
	}
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { res.Body.Close() })
	return res
}

func decode(t *testing.T, res *http.Response, v any) {
	t.Helper()
	if err := json.NewDecoder(res.Body).Decode(v); err != nil {
		t.Fatal(err)
	}
}

func uploadText(t *testing.T, base, token, kbID, name, content string) map[string]any {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("kb_id", kbID)
	part, err := w.CreateFormFile("file", name)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write([]byte(content))
	_ = w.Close()
	req, err := http.NewRequest(http.MethodPost, base+"/api/knowledge/upload", &buf)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatalf("上传失败 %d %v", res.StatusCode, body)
	}
	return body
}

func TestVerticalSlice(t *testing.T) {
	ts := newTestServer(t)
	defer ts.Close()
	teacher := login(t, ts.URL, "teacher")
	math := login(t, ts.URL, "math")
	school := login(t, ts.URL, "school")

	res := do(t, http.MethodGet, ts.URL+"/api/agent/list", teacher, nil)
	var agents struct {
		Items []store.Agent `json:"items"`
	}
	decode(t, res, &agents)
	seenMath := false
	seenYuwen := false
	for _, a := range agents.Items {
		if a.ID == store.AgentMath {
			seenMath = true
		}
		if a.ID == store.AgentYuwen {
			seenYuwen = true
		}
	}
	if !seenYuwen || seenMath {
		t.Fatalf("语文教师应看到语文助手、看不到数学组智能体: %+v", agents.Items)
	}

	kbRes := do(t, http.MethodPost, ts.URL+"/api/knowledge/create", teacher, map[string]string{
		"name": "语文教师私有库", "description": "权限隔离", "share_type": "private",
	})
	var kb store.KB
	decode(t, kbRes, &kb)
	secret := "校本暗号青禾砚台只在语文私有库出现。"
	doc := uploadText(t, ts.URL, teacher, kb.ID, "note.txt", "学生张三本次得分85分，手机号13812345678。"+secret)
	if doc["status"] != "finished" {
		t.Fatalf("普通含隐私文档应脱敏后入库: %v", doc)
	}
	if strings.Contains(doc["preview"].(string), "张三") || strings.Contains(doc["preview"].(string), "13812345678") || strings.Contains(doc["preview"].(string), "85") {
		t.Fatalf("预览仍含敏感信息: %v", doc["preview"])
	}
	if !strings.Contains(doc["preview"].(string), "青禾砚台") {
		t.Fatalf("教学句子应保留: %v", doc["preview"])
	}

	roster := "姓名,学号,语文,数学,总分\n张三,001,85,90,175\n李四,002,70,80,150\n王五,003,88,92,180\n"
	blocked := uploadText(t, ts.URL, teacher, kb.ID, "roster.csv", roster)
	if blocked["status"] != "blocked" {
		t.Fatalf("成绩表应拦截: %v", blocked)
	}

	searchOwn := do(t, http.MethodPost, ts.URL+"/api/knowledge/search", teacher, map[string]any{"kb_ids": []string{kb.ID}, "query": "青禾砚台"})
	var ownHits struct {
		Items []struct {
			Snippet string `json:"snippet"`
		} `json:"items"`
	}
	decode(t, searchOwn, &ownHits)
	if len(ownHits.Items) == 0 || !strings.Contains(ownHits.Items[0].Snippet, "青禾砚台") {
		t.Fatalf("所有者应检索到私有库: %+v", ownHits)
	}
	searchOther := do(t, http.MethodPost, ts.URL+"/api/knowledge/search", math, map[string]any{"kb_ids": []string{kb.ID}, "query": "青禾砚台"})
	var otherHits struct {
		Items []struct {
			Snippet string `json:"snippet"`
		} `json:"items"`
	}
	decode(t, searchOther, &otherHits)
	for _, it := range otherHits.Items {
		if strings.Contains(it.Snippet, "青禾砚台") {
			t.Fatal("数学教师不应检索到语文私有库")
		}
	}

	convRes := do(t, http.MethodPost, ts.URL+"/api/chat/conversation", teacher, map[string]string{"agent_id": store.AgentYuwen})
	var conv store.Conversation
	decode(t, convRes, &conv)
	msgRes := do(t, http.MethodPost, ts.URL+"/api/chat/message", teacher, map[string]string{
		"conversation_id": conv.ID, "content": "请根据知识库写一份三年级语文比喻句教案",
	})
	var reply struct {
		Assistant struct {
			Content string `json:"content"`
		} `json:"assistant_message"`
		Validation struct {
			Status string `json:"status"`
		} `json:"validation"`
		Citations []struct {
			FileName string `json:"file_name"`
		} `json:"citations"`
		Model      string `json:"model"`
		ResourceID string `json:"resource_id"`
	}
	decode(t, msgRes, &reply)
	if !strings.Contains(reply.Assistant.Content, "教学目标") || !strings.Contains(reply.Assistant.Content, "教学过程") {
		t.Fatalf("教案应包含规定结构: %s", reply.Assistant.Content)
	}
	if reply.Validation.Status == "fail" {
		t.Fatalf("比喻句教案不应校验失败: %+v", reply.Validation)
	}
	if len(reply.Citations) == 0 {
		t.Fatal("应引用语文知识库")
	}
	if reply.Model != "local-edu-small" {
		t.Fatalf("无密钥时应走本地模型: %s", reply.Model)
	}
	if reply.ResourceID == "" {
		t.Fatal("教案应导出资源")
	}

	warnRes := do(t, http.MethodPost, ts.URL+"/api/chat/message", teacher, map[string]string{
		"conversation_id": conv.ID, "content": "请写一份一年级语文文言文教案",
	})
	var warn struct {
		Validation struct {
			Status    string   `json:"status"`
			ErrorList []string `json:"error_list"`
		} `json:"validation"`
	}
	decode(t, warnRes, &warn)
	if warn.Validation.Status != "warn" {
		t.Fatalf("超纲应告警: %+v", warn.Validation)
	}

	reportConv := do(t, http.MethodPost, ts.URL+"/api/chat/conversation", teacher, map[string]string{"agent_id": store.AgentReport})
	var rc store.Conversation
	decode(t, reportConv, &rc)
	report := do(t, http.MethodPost, ts.URL+"/api/chat/message", teacher, map[string]string{
		"conversation_id": rc.ID, "content": "请根据青禾砚台做学情分析",
	})
	var rr struct {
		Assistant struct {
			Content string `json:"content"`
		} `json:"assistant_message"`
	}
	decode(t, report, &rr)
	if strings.Contains(rr.Assistant.Content, "青禾砚台") {
		t.Fatal("学情分析不应检索教学库原文")
	}
	if !strings.Contains(rr.Assistant.Content, "汇总") {
		t.Fatalf("应返回汇总学情: %s", rr.Assistant.Content)
	}
	if strings.Contains(rr.Assistant.Content, "数学") && strings.Contains(rr.Assistant.Content, "三年级2班") {
		t.Fatal("语文教师不应看到数学组汇总")
	}

	dl := do(t, http.MethodGet, ts.URL+"/api/resource/download?id="+reply.ResourceID, teacher, nil)
	blob, _ := io.ReadAll(dl.Body)
	if dl.StatusCode != 200 || !bytes.Contains(blob, []byte("显性水印")) || !bytes.Contains(blob, []byte("EduTrace")) {
		t.Fatalf("导出的文档应带水印 status=%d", dl.StatusCode)
	}

	audit := do(t, http.MethodGet, ts.URL+"/api/audit/log/list", school, nil)
	var logs struct {
		Items []store.Audit `json:"items"`
	}
	decode(t, audit, &logs)
	found := false
	for _, a := range logs.Items {
		if a.UserID == store.UserTeacher && a.OperationType == "chat" {
			found = true
			if strings.Contains(a.OperationDetail, "青禾砚台") || strings.Contains(a.OperationDetail, "教案：") {
				t.Fatal("审计日志不应保存提示词或正文")
			}
		}
	}
	if !found {
		t.Fatal("学校管理员应看到教师对话审计")
	}
	mathAudit := do(t, http.MethodGet, ts.URL+"/api/audit/log/list", math, nil)
	var mlogs struct {
		Items []store.Audit `json:"items"`
	}
	decode(t, mathAudit, &mlogs)
	for _, a := range mlogs.Items {
		if a.UserID == store.UserTeacher {
			t.Fatal("数学教师不应看到语文教师审计")
		}
	}
}

func TestSchoolDecisions(t *testing.T) {
	ts := newTestServer(t)
	defer ts.Close()
	school := login(t, ts.URL, "school")
	teacher := login(t, ts.URL, "teacher")
	groupsRes := do(t, http.MethodGet, ts.URL+"/api/groups", teacher, nil)
	if groupsRes.StatusCode != 200 {
		t.Fatalf("教研组列表应能返回 %d", groupsRes.StatusCode)
	}
	var listed struct {
		Items []store.ResearchGroup `json:"items"`
	}
	decode(t, groupsRes, &listed)
	if len(listed.Items) < 2 {
		t.Fatalf("语文教师应同时属于多个教研组: %+v", listed.Items)
	}
	math := login(t, ts.URL, "math")
	lead := login(t, ts.URL, "lead")

	cfgRes := do(t, http.MethodGet, ts.URL+"/api/settings", teacher, nil)
	var cfg struct {
		LessonEgress        bool   `json:"lesson_egress"`
		IdentityActive      string `json:"identity_active"`
		UsingDemoCurriculum bool   `json:"using_demo_curriculum"`
		OCREngine           string `json:"ocr_engine"`
	}
	if cfgRes.StatusCode != 200 {
		t.Fatalf("教师应能读取学校设定 %d", cfgRes.StatusCode)
	}
	decode(t, cfgRes, &cfg)
	if cfg.LessonEgress || cfg.IdentityActive != "local" || !cfg.UsingDemoCurriculum || cfg.OCREngine != "auto" {
		t.Fatalf("默认应留在校内本地模型并使用演示课标: %+v", cfg)
	}

	denied := do(t, http.MethodPost, ts.URL+"/api/knowledge/create", school, map[string]string{
		"name": "未选组", "share_type": "group",
	})
	if denied.StatusCode != 400 {
		t.Fatalf("教研组共享必须选择组: %d", denied.StatusCode)
	}

	groupRes := do(t, http.MethodPost, ts.URL+"/api/groups", school, map[string]string{
		"name": "校本阅读小组", "mode": "custom", "description": "跨学科自定义组",
	})
	if groupRes.StatusCode != 200 {
		b, _ := io.ReadAll(groupRes.Body)
		t.Fatalf("创建自定义组失败 %s", b)
	}
	var group store.ResearchGroup
	decode(t, groupRes, &group)
	add := do(t, http.MethodPost, ts.URL+"/api/groups/members", school, map[string]string{
		"group_id": group.ID, "user_id": store.UserTeacher,
	})
	if add.StatusCode != 200 {
		t.Fatal("语文教师应能加入自定义组")
	}
	kbRes := do(t, http.MethodPost, ts.URL+"/api/knowledge/create", school, map[string]string{
		"name": "校本阅读资料", "share_type": "group", "group_id": group.ID,
	})
	if kbRes.StatusCode != 200 {
		b, _ := io.ReadAll(kbRes.Body)
		t.Fatalf("按组创建知识库失败 %s", b)
	}
	var kb store.KB
	decode(t, kbRes, &kb)
	hasT, hasP := ingest.DetectEngines()
	ocrPref := "none"
	if !hasP {
		ocrPref = "paddle"
	} else if !hasT {
		ocrPref = "tesseract"
	}
	ocrSet := do(t, http.MethodPut, ts.URL+"/api/settings", school, map[string]any{"ocr_engine": ocrPref, "identity_mode": "local"})
	if ocrSet.StatusCode != 200 {
		t.Fatal("设置 OCR 引擎失败")
	}

	const phrase = "青瓷笔山校本口令"
	uploadText(t, ts.URL, school, kb.ID, "阅读.txt", "本组资料："+phrase+"。其他组不能检索。")
	find := searchKB(t, ts.URL, teacher, kb.ID, phrase)
	if !strings.Contains(find, phrase) {
		t.Fatalf("同组成员应检索到资料: %s", find)
	}
	hidden := searchKB(t, ts.URL, math, kb.ID, phrase)
	if strings.Contains(hidden, phrase) {
		t.Fatal("未加入该组的数学教师不应检索到资料")
	}

	png := uploadBytes(t, ts.URL, school, kb.ID, "scan.png", tinyPNG(t))
	if png["status"] != "failed" {
		t.Fatalf("无可用 OCR 时应归档图片: %v", png)
	}
	msg, _ := png["error_message"].(string)
	if !strings.Contains(msg, "归档") && !strings.Contains(msg, "Paddle") && !strings.Contains(msg, "Tesseract") {
		t.Fatalf("归档原因应说明引擎: %s", msg)
	}

	saved := do(t, http.MethodPut, ts.URL+"/api/settings", school, map[string]any{
		"curriculum_version": "校本实验版",
		"curriculum_source":  "学校教务处",
		"ocr_engine":         "auto",
		"identity_mode":      "local",
	})
	if saved.StatusCode != 200 {
		b, _ := io.ReadAll(saved.Body)
		t.Fatalf("保存课标失败 %s", b)
	}
	convRes := do(t, http.MethodPost, ts.URL+"/api/chat/conversation", teacher, map[string]string{"agent_id": store.AgentYuwen})
	var conv store.Conversation
	decode(t, convRes, &conv)
	msgRes := do(t, http.MethodPost, ts.URL+"/api/chat/message", teacher, map[string]string{
		"conversation_id": conv.ID, "content": "请写一份三年级语文比喻句教案",
	})
	var reply struct {
		Assistant struct {
			Content string `json:"content"`
		} `json:"assistant_message"`
		Validation struct {
			Status    string   `json:"status"`
			ErrorList []string `json:"error_list"`
		} `json:"validation"`
	}
	decode(t, msgRes, &reply)
	if !strings.Contains(reply.Assistant.Content, "版本「校本实验版」") {
		t.Fatalf("教案应写明学校设定的版本: %s", reply.Assistant.Content)
	}
	if strings.Contains(reply.Assistant.Content, "尚未指定") || strings.Contains(strings.Join(reply.Validation.ErrorList, " "), "尚未指定") {
		t.Fatalf("已指定版本后不应再警告演示摘录: %+v %s", reply.Validation, reply.Assistant.Content)
	}

	switched := do(t, http.MethodPut, ts.URL+"/api/settings", school, map[string]any{
		"curriculum_version": "校本实验版",
		"curriculum_source":  "学校教务处",
		"identity_mode":      "cas",
		"ocr_engine":         "auto",
	})
	if switched.StatusCode != 200 {
		t.Fatal("保存身份意向失败")
	}
	var after struct {
		IdentityMode   string `json:"identity_mode"`
		IdentityActive string `json:"identity_active"`
		LessonEgress   bool   `json:"lesson_egress"`
	}
	decode(t, switched, &after)
	if after.IdentityMode != "cas" || after.IdentityActive != "local" || after.LessonEgress {
		t.Fatalf("未启用插件时仍应本地登录且教案不出校: %+v", after)
	}
	if login(t, ts.URL, "teacher") == "" {
		t.Fatal("选择 CAS 后本地密码登录应仍然可用")
	}

	assertStats(t, ts.URL, teacher, true, false)
	assertStats(t, ts.URL, lead, false, false)
	assertStats(t, ts.URL, math, true, true)
}

func searchKB(t *testing.T, base, token, kbID, query string) string {
	t.Helper()
	res := do(t, http.MethodPost, base+"/api/knowledge/search", token, map[string]any{
		"kb_ids": []string{kbID}, "query": query,
	})
	var body struct {
		Items []struct {
			Snippet string `json:"snippet"`
		} `json:"items"`
	}
	decode(t, res, &body)
	var b strings.Builder
	for _, it := range body.Items {
		b.WriteString(it.Snippet)
	}
	return b.String()
}

func assertStats(t *testing.T, base, token string, wantGrade, forbidYuwen bool) {
	t.Helper()
	res := do(t, http.MethodGet, base+"/api/learning/stats", token, nil)
	var body struct {
		Items []struct {
			Summary string `json:"summary"`
		} `json:"items"`
	}
	decode(t, res, &body)
	var all string
	for _, it := range body.Items {
		all += it.Summary
	}
	if wantGrade != strings.Contains(all, "年级汇总") {
		t.Fatalf("年级汇总可见性不符 want=%v text=%s", wantGrade, all)
	}
	if forbidYuwen && strings.Contains(all, "三年级1班") {
		t.Fatalf("不应看到语文班汇总: %s", all)
	}
}

func uploadBytes(t *testing.T, base, token, kbID, name string, content []byte) map[string]any {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	_ = w.WriteField("kb_id", kbID)
	part, err := w.CreateFormFile("file", name)
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write(content)
	_ = w.Close()
	req, err := http.NewRequest(http.MethodPost, base+"/api/knowledge/upload", &buf)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	var body map[string]any
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != 200 {
		t.Fatalf("上传失败 %d %v", res.StatusCode, body)
	}
	return body
}

func tinyPNG(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := png.Encode(&buf, image.NewNRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}
