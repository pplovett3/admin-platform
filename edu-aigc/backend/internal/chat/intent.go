package chat

import "strings"

type Intent struct {
	Task       string
	Subject    string
	Stage      string
	Grade      int
	Difficulty string
	NeedsRAG   bool
	Sensitive  bool
	HasHits    bool
}

func Detect(text, agentName string) Intent {
	in := Intent{Task: "qa", NeedsRAG: true}
	switch {
	case strings.Contains(text, "学情"):
		in.Task = "analytics"
		in.NeedsRAG = false
		in.Sensitive = true
	case strings.Contains(text, "批改") || strings.Contains(text, "判分") || strings.Contains(text, "标准答案"):
		in.Task = "grade"
		in.NeedsRAG = false
		in.Sensitive = true
	case strings.Contains(text, "评语"):
		in.Task = "comment"
		in.NeedsRAG = false
		in.Sensitive = true
	case strings.Contains(text, "重构") || strings.Contains(text, "改写教案"):
		in.Task = "rewrite"
	case strings.Contains(text, "课件") || strings.Contains(text, "PPT") || strings.Contains(text, "ppt") || strings.Contains(text, "幻灯"):
		in.Task = "ppt"
	case strings.Contains(text, "试卷") || strings.Contains(text, "出题") || strings.Contains(text, "练习题") || strings.Contains(text, "组卷"):
		in.Task = "quiz"
	case strings.Contains(text, "教案") || strings.Contains(text, "教学设计") || strings.Contains(text, "教学计划") || strings.Contains(text, "教研总结"):
		in.Task = "lesson"
	}
	for _, s := range []string{"道德与法治", "语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "科学"} {
		if strings.Contains(text, s) || strings.Contains(agentName, s) {
			in.Subject = s
			break
		}
	}
	type g struct {
		w     string
		grade int
		stage string
	}
	order := []g{
		{"一年级", 1, "小学"}, {"二年级", 2, "小学"}, {"三年级", 3, "小学"}, {"四年级", 4, "小学"},
		{"五年级", 5, "小学"}, {"六年级", 6, "小学"}, {"七年级", 7, "初中"}, {"八年级", 8, "初中"},
		{"九年级", 9, "初中"}, {"高一", 10, "高中"}, {"高二", 11, "高中"}, {"高三", 12, "高中"},
	}
	for _, item := range order {
		if strings.Contains(text, item.w) {
			in.Grade = item.grade
			in.Stage = item.stage
			break
		}
	}
	if in.Stage == "" {
		switch {
		case strings.Contains(text, "小学") || strings.Contains(agentName, "小学"):
			in.Stage = "小学"
		case strings.Contains(text, "初中"):
			in.Stage = "初中"
		case strings.Contains(text, "高中"):
			in.Stage = "高中"
		}
	}
	switch {
	case strings.Contains(text, "竞赛") || strings.Contains(text, "奥数"):
		in.Difficulty = "竞赛"
	case strings.Contains(text, "提高"):
		in.Difficulty = "提高"
	default:
		in.Difficulty = "基础"
	}
	return in
}
