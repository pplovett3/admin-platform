package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

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
