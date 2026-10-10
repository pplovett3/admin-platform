package modelgw

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"edu-aigc/internal/desensitize"
)

type Request struct {
	System     string
	User       string
	Task       string
	Subject    string
	Stage      string
	Grade      int
	Difficulty string
	Topic      string
	Chunks     []string
	Notes      []string
	History    string
	Correction string
	Curriculum string
	Sensitive  bool
	ForceLocal bool
}

type Gateway struct {
	BaseURL string
	APIKey  string
	Model   string
	Client  *http.Client
}

// LessonCanLeaveCampus 只有同时配置了兼容接口地址和密钥后才为真。
// 不默认指向任何公有厂商。缺一则教案留在校内本地模型。
func (g *Gateway) LessonCanLeaveCampus() bool {
	return g != nil && strings.TrimSpace(g.APIKey) != "" && strings.TrimSpace(g.BaseURL) != ""
}

// Overlay 用学校设定覆盖环境变量。空字段保留原来的值，避免把已配置的密钥清掉。
func Overlay(base *Gateway, baseURL, apiKey, model string) Gateway {
	g := Gateway{}
	if base != nil {
		g = *base
		g.Client = base.Client
	}
	if strings.TrimSpace(baseURL) != "" {
		g.BaseURL = strings.TrimSpace(baseURL)
	}
	if strings.TrimSpace(apiKey) != "" {
		g.APIKey = strings.TrimSpace(apiKey)
	}
	if strings.TrimSpace(model) != "" {
		g.Model = strings.TrimSpace(model)
	}
	return g
}

func (g *Gateway) Complete(ctx context.Context, req Request) (text, model string, degraded bool) {
	if req.Topic == "" {
		req.Topic = "未命名课题"
	}
	// 不绑定具体厂商。没有密钥时，教案和其他生成都走校内本地模型。
	// 学情、批改、评语即使以后配了密钥也不出校。
	localOnly := g == nil || !g.LessonCanLeaveCampus() || req.ForceLocal || req.Sensitive
	outbound := req.User + "\n" + strings.Join(req.Chunks, "\n") + "\n" + req.System
	if desensitize.ContainsSensitive(outbound) {
		localOnly = true
	}
	if !localOnly {
		text, err := g.remote(ctx, req)
		if err == nil && strings.TrimSpace(text) != "" {
			name := g.Model
			if name == "" {
				name = "public-model"
			}
			return text, name, false
		}
		degraded = true
	}
	return localText(req), "local-edu-small", degraded
}

func (g *Gateway) remote(ctx context.Context, req Request) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(g.BaseURL), "/")
	if base == "" || strings.TrimSpace(g.APIKey) == "" {
		return "", fmt.Errorf("未配置兼容接口地址或密钥")
	}
	msgs := []map[string]string{}
	if strings.TrimSpace(req.System) != "" {
		msgs = append(msgs, map[string]string{"role": "system", "content": req.System})
	}
	if req.History != "" {
		msgs = append(msgs, map[string]string{"role": "user", "content": "近期对话摘要：\n" + req.History})
	}
	user := req.User
	if len(req.Chunks) > 0 {
		user = "检索资料：\n" + strings.Join(req.Chunks, "\n---\n") + "\n\n教师问题：\n" + req.User
	}
	msgs = append(msgs, map[string]string{"role": "user", "content": user})
	model := g.Model
	if model == "" {
		model = "compatible-model"
	}
	body, _ := json.Marshal(map[string]any{
		"model":       model,
		"temperature": 0.3,
		"messages":    msgs,
	})
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+g.APIKey)
	httpReq.Header.Set("Content-Type", "application/json")
	client := g.Client
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("模型网关状态 %d", resp.StatusCode)
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", err
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("模型没有返回内容")
	}
	return parsed.Choices[0].Message.Content, nil
}

func localText(req Request) string {
	switch req.Task {
	case "lesson", "rewrite":
		return lesson(req)
	case "ppt":
		return ppt(req)
	case "quiz":
		return quiz(req)
	case "comment":
		return comment(req)
	case "analytics":
		return analytics(req)
	case "grade":
		return grade(req)
	default:
		return qa(req)
	}
}

func lesson(req Request) string {
	var b strings.Builder
	subject := req.Subject
	if subject == "" {
		subject = "综合"
	}
	stage := req.Stage
	if stage == "" {
		stage = "本校"
	}
	fmt.Fprintf(&b, "%s%s教案：%s\n\n", stage, subject, req.Topic)
	if req.Curriculum != "" {
		b.WriteString("课标依据：" + req.Curriculum + "\n\n")
	}
	if req.Correction != "" {
		b.WriteString("修订说明：已按本地校验意见补齐结构，并避免超纲表述。\n\n")
	}
	b.WriteString("教学目标：\n")
	b.WriteString("1. 能用自己的话说出本课核心知识点。\n")
	b.WriteString("2. 能完成课堂练习，并修正一处典型错误。\n")
	b.WriteString("3. 能把例子迁移到校园生活情境。\n\n")
	b.WriteString("教学重点：把知识点讲清楚，并给出可模仿的例子。\n")
	b.WriteString("教学难点：让学生说明“为什么这样写/这样算”。\n\n")
	b.WriteString("教学过程：\n")
	b.WriteString("1. 导入：从学生熟悉的校园场景提出一个小问题。\n")
	b.WriteString("2. 新授：结合校本资料讲解，教师边讲边板书关键词。\n")
	writeChunks(&b, req.Chunks)
	b.WriteString("3. 练习：独立完成一道基础题，再与同桌互讲。\n")
	b.WriteString("4. 小结：请两名学生用一句话总结今天学会的内容。\n\n")
	b.WriteString("板书设计：课题、要点、例子。\n")
	b.WriteString("作业：用今天的知识点完成一个自己的例子，下节课交流。\n")
	if req.Task == "rewrite" {
		b.WriteString("\n重构建议：保留原教案中的目标和活动顺序，删去与本课知识点无关的段落，把例子改成学生能在课堂上立刻完成的任务。\n")
	}
	return b.String()
}

func ppt(req Request) string {
	var b strings.Builder
	fmt.Fprintf(&b, "课件大纲：%s\n\n", req.Topic)
	slides := []string{
		"封面：课题、学段学科、课时",
		"学习目标：三句话写清本节课要会什么",
		"情境导入：一个校园里的问题",
		"知识讲解：概念、例子、易错点",
		"互动练习：请学生先做再讲",
		"校本材料摘录：只展示脱敏后的教学片段",
		"课堂小结：学生自己说要点",
		"作业与下节预告",
	}
	for i, s := range slides {
		fmt.Fprintf(&b, "第%d页 幻灯片：%s\n", i+1, s)
	}
	b.WriteString("\n讲解备注：\n")
	writeChunks(&b, req.Chunks)
	return b.String()
}

func quiz(req Request) string {
	diff := req.Difficulty
	if diff == "" {
		diff = "基础"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%s%s练习卷（难度：%s）\n课题：%s\n\n", req.Stage, req.Subject, diff, req.Topic)
	b.WriteString("一、题目\n")
	fmt.Fprintf(&b, "1. 选择题：学习「%s」时，更合适的做法是？\nA. 先看例子，再自己说一遍\nB. 只抄定义，不解释\nC. 跳过不会的步骤\n", req.Topic)
	b.WriteString("2. 填空题：本课最需要记住的一个词是________。\n")
	b.WriteString("3. 判断题：做完练习后，用自己的话讲给同桌听，有助于发现错误。（  ）\n")
	b.WriteString("4. 简答题：请举一个校园生活中的例子说明本课知识点。\n")
	b.WriteString("5. 应用题：按今天学的步骤，完成一个小任务，并写出关键一步。\n\n")
	b.WriteString("二、答案\n")
	b.WriteString("1. A。解析：先理解例子，再自己表达，比死记更稳。\n")
	b.WriteString("2. 参考答案：写出本课核心词即可，需与课题相关。\n")
	b.WriteString("3. 对。解析：讲给别人听时，含糊的地方会暴露出来。\n")
	b.WriteString("4. 要点：例子具体，能点明知识点，而不是只重复定义。\n")
	b.WriteString("5. 要点：步骤完整，关键一步写清楚。\n\n")
	b.WriteString("命题说明：题目难度按当前学段控制在课堂可完成的范围。\n")
	writeChunks(&b, req.Chunks)
	return b.String()
}

func comment(req Request) string {
	who := "这位同学"
	if strings.Contains(req.User, "学生") {
		who = "该学生"
	}
	return fmt.Sprintf("评语：%s这段时间上课愿意听、愿意说，作业完成较稳定。建议继续把不会的地方当场问清楚，并在阅读或练习后用一句话做小结。本评语在校内本地生成，不包含成绩排名和家庭信息。课题参考：%s。", who, req.Topic)
}

func analytics(req Request) string {
	var b strings.Builder
	b.WriteString("学情报告\n")
	b.WriteString("说明：本报告只使用班级汇总指标，在校内本地生成。未读取学生姓名、学号、个人分数，也未把明细送入公有大模型。\n\n")
	if len(req.Notes) == 0 {
		b.WriteString("当前范围还没有可用的汇总指标。请先由学校管理员导入脱敏后的班级统计。\n")
	} else {
		b.WriteString("汇总指标：\n")
		for _, n := range req.Notes {
			b.WriteString("• " + n + "\n")
		}
	}
	b.WriteString("\n教学建议：针对薄弱点安排 15 分钟小练习，下一课时用两道口头题回看。不要在报告中补充学生个人成绩。\n")
	return b.String()
}

func grade(req Request) string {
	lines := strings.Split(req.User, "\n")
	type item struct{ ok bool }
	var items []item
	obj := 0
	objOK := 0
	subj := 0
	subjHit := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || !strings.Contains(line, "标准答案") || !strings.Contains(line, "学生答案") {
			continue
		}
		std := between(line, "标准答案", "学生答案")
		stu := after(line, "学生答案")
		std = strings.Trim(std, " ：:，,")
		stu = strings.Trim(stu, " ：:，,")
		if std == "" {
			continue
		}
		if isChoice(std) && isChoice(stu) {
			obj++
			if strings.EqualFold(std, stu) {
				objOK++
				items = append(items, item{ok: true})
			} else {
				items = append(items, item{ok: false})
			}
			continue
		}
		subj++
		keys := splitKeys(std)
		hit := 0
		for _, k := range keys {
			if k != "" && strings.Contains(stu, k) {
				hit++
			}
		}
		if len(keys) > 0 && hit*2 >= len(keys) {
			subjHit++
			items = append(items, item{ok: true})
		} else {
			items = append(items, item{ok: false})
		}
	}
	if obj+subj == 0 {
		return "本地批改：没有识别到逐题作答。请按每行「1. 标准答案：A 学生答案：C」粘贴。客观题按选项判分，主观题按要点是否出现给分。作答明细只留在校内，不会发往公有模型。"
	}
	var b strings.Builder
	b.WriteString("本地批改结果\n")
	fmt.Fprintf(&b, "客观题：%d/%d。\n", objOK, obj)
	fmt.Fprintf(&b, "主观题踩点：%d/%d。\n", subjHit, subj)
	b.WriteString("逐题：\n")
	for i, it := range items {
		mark := "未得满分"
		if it.ok {
			mark = "达到参考要点"
		}
		fmt.Fprintf(&b, "%d. %s\n", i+1, mark)
	}
	b.WriteString("说明：评分在本地完成。请教师复核主观题，系统不输出学生姓名。\n")
	return b.String()
}

func qa(req Request) string {
	var b strings.Builder
	if len(req.Chunks) == 0 {
		b.WriteString("本地知识库没有检索到直接依据，下面只给出需要教师复核的一般性说明，避免把没有出处的内容说成校内事实。\n\n")
		fmt.Fprintf(&b, "关于「%s」：请先确认学段和学科，再决定讲法。建议回到知识库补充课标或校本教案后重新提问。\n", req.Topic)
		return b.String()
	}
	fmt.Fprintf(&b, "根据本校知识库，关于「%s」可以这样组织：\n", req.Topic)
	writeChunks(&b, req.Chunks)
	b.WriteString("使用建议：先引用上面的校本表述，再补充课堂例子。若资料与当前学段不符，请放弃该片段。\n")
	return b.String()
}

func writeChunks(b *strings.Builder, chunks []string) {
	if len(chunks) == 0 {
		b.WriteString("（本次未检索到可引用的校本片段。）\n")
		return
	}
	b.WriteString("校本资料摘录：\n")
	for i, c := range chunks {
		rs := []rune(c)
		if len(rs) > 220 {
			rs = rs[:220]
		}
		fmt.Fprintf(b, "%d. %s\n", i+1, string(rs))
	}
}

func isChoice(s string) bool {
	s = strings.TrimSpace(s)
	return len([]rune(s)) == 1 && strings.Contains("ABCDＴＦ对错", strings.ToUpper(s)) || s == "对" || s == "错"
}

func splitKeys(s string) []string {
	s = strings.NewReplacer("，", "、", ",", "、", "；", "、", ";", "、").Replace(s)
	parts := strings.Split(s, "、")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if len([]rune(p)) >= 2 {
			out = append(out, p)
		}
	}
	if len(out) == 0 && strings.TrimSpace(s) != "" {
		out = append(out, strings.TrimSpace(s))
	}
	return out
}

func between(s, a, b string) string {
	i := strings.Index(s, a)
	if i < 0 {
		return ""
	}
	rest := s[i+len(a):]
	j := strings.Index(rest, b)
	if j < 0 {
		return ""
	}
	return rest[:j]
}

func after(s, a string) string {
	i := strings.Index(s, a)
	if i < 0 {
		return ""
	}
	return s[i+len(a):]
}
