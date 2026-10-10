// Package validate 在本地检查大模型输出是否符合学段课标、格式与内容安全。
package validate

import "strings"

type Status string

const (
	Pass Status = "pass"
	Warn Status = "warn"
	Fail Status = "fail"
)

type Intent struct {
	Task       string
	Subject    string
	Stage      string
	Grade      int
	Difficulty string
	HasHits    bool
}

type Result struct {
	Status     Status   `json:"status"`
	ErrorList  []string `json:"error_list"`
	Suggestion string   `json:"suggestion"`
}

func Check(output string, intent Intent) Result {
	var errs []string
	status := Pass
	add := func(st Status, msg string) {
		errs = append(errs, msg)
		if st == Fail || (st == Warn && status != Fail) {
			status = st
		}
		if st == Fail {
			status = Fail
		}
	}

	for _, bad := range []string{"如何杀人", "自杀方法", "色情内容", "制作炸弹", "制作毒品", "制毒步骤"} {
		if strings.Contains(output, bad) {
			add(Fail, "内容安全：输出包含不允许的危险或不良内容")
			break
		}
	}

	if msg := overGrade(output, intent); msg != "" {
		add(Warn, msg)
	}
	if !intent.HasHits && (intent.Task == "lesson" || intent.Task == "quiz" || intent.Task == "ppt" || intent.Task == "qa") {
		add(Warn, "本地知识库没有检索到依据，生成内容可能包含幻觉，请教师复核")
	}
	if strings.Contains(output, "氟硼语") {
		add(Fail, "知识点校验：输出包含知识库中不存在的虚构知识点")
	}
	if strings.Contains(output, "光合作用") && (strings.Contains(output, "不需要光") || strings.Contains(output, "不需要光照")) {
		add(Fail, "知识点校验：与科学常识冲突（光合作用需要光）")
	}

	if intent.Task == "quiz" {
		if intent.Difficulty == "竞赛" && intent.Grade > 0 && intent.Grade <= 2 {
			add(Warn, "难度校验：低年级不宜直接使用竞赛难度")
		}
		if !strings.Contains(output, "答案") {
			add(Fail, "格式校验：试卷缺少答案部分")
		}
		if !strings.Contains(output, "题") {
			add(Fail, "格式校验：试卷缺少题目")
		}
	}
	if intent.Task == "lesson" || intent.Task == "rewrite" {
		if !strings.Contains(output, "教学目标") {
			add(Fail, "格式校验：教案缺少教学目标")
		}
		if !strings.Contains(output, "教学过程") {
			add(Fail, "格式校验：教案缺少教学过程")
		}
	}
	if intent.Task == "ppt" && !strings.Contains(output, "幻灯") && !strings.Contains(output, "页") {
		add(Fail, "格式校验：课件大纲缺少分页结构")
	}

	sug := ""
	switch status {
	case Fail:
		sug = "请按告警补齐必要结构，删除超纲、虚构和不安全表述后再生一版。"
	case Warn:
		sug = "结果可用，但请教师确认学段匹配与知识库依据。"
	default:
		sug = "校验通过。"
	}
	return Result{Status: status, ErrorList: errs, Suggestion: sug}
}

func overGrade(output string, intent Intent) string {
	if intent.Grade == 0 && intent.Stage == "" {
		return ""
	}
	g := intent.Grade
	stage := intent.Stage
	advanced := []string{}
	switch {
	case stage == "小学" && g > 0 && g <= 2:
		advanced = []string{"文言文", "虚词", "导数", "微积分", "二次函数", "化学方程式", "牛顿定律", "议论文"}
	case stage == "小学" && g >= 3 && g <= 4:
		advanced = []string{"微积分", "导数", "牛顿定律", "化学方程式", "二次函数", "系统文言文"}
	case stage == "小学" && g >= 5:
		advanced = []string{"微积分", "导数", "立体几何证明"}
	case stage == "初中":
		advanced = []string{"微积分", "导数", "偏微分方程"}
	}
	for _, w := range advanced {
		if strings.Contains(output, w) {
			return "课标合规：检测到可能超纲的内容「" + w + "」，与当前学段不匹配"
		}
	}
	return ""
}
