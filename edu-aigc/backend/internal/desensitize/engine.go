// Package desensitize 在本地识别教育文档中的个人敏感信息，并按三级策略改写。
// 一级替换后可入库；二级整段屏蔽后可入库；三级拦截，禁止进入向量库。
package desensitize

import (
	"regexp"
	"strings"
	"unicode"
)

type Level int

const (
	LevelNone    Level = 0
	LevelReplace Level = 1
	LevelMask    Level = 2
	LevelBlock   Level = 3
)

type Event struct {
	Type   string `json:"type"`
	Action string `json:"action"`
	Detail string `json:"detail"`
}

type Result struct {
	Level   Level   `json:"level"`
	Text    string  `json:"text"`
	Events  []Event `json:"events"`
	Blocked bool    `json:"blocked"`
	Reason  string  `json:"reason"`
}

type Engine struct {
	Whitelist map[string]struct{}
}

func New(extra []string) *Engine {
	return FromList(append(DefaultTerms(), extra...))
}

func DefaultTerms() []string {
	out := make([]string, len(defaultWhitelist))
	copy(out, defaultWhitelist)
	return out
}

func FromList(terms []string) *Engine {
	e := &Engine{Whitelist: map[string]struct{}{}}
	for _, w := range terms {
		w = strings.TrimSpace(w)
		if w != "" {
			e.Whitelist[w] = struct{}{}
		}
	}
	return e
}

var defaultWhitelist = []string{
	"李白", "杜甫", "白居易", "王维", "苏轼", "苏东坡", "李清照", "辛弃疾", "屈原", "孔子", "孟子", "庄子", "荀子", "韩非子",
	"司马迁", "曹操", "曹植", "陶渊明", "王维", "杜牧", "韩愈", "柳宗元", "欧阳修", "王安石", "陆游", "文天祥",
	"闰土", "孔乙己", "祥林嫂", "阿Q", "鲁达", "林黛玉", "贾宝玉", "孙悟空", "猪八戒", "武松", "宋江",
	"小明", "小红", "小华", "小刚", "小丽", "小强", "小芳", "小军", "小杰", "小美",
}

var (
	reIDCard   = regexp.MustCompile(`[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]`)
	rePhone    = regexp.MustCompile(`1[3-9]\d{9}`)
	reTel      = regexp.MustCompile(`0\d{2,3}-\d{7,8}`)
	reEmail    = regexp.MustCompile(`[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}`)
	reQQ       = regexp.MustCompile(`(?i)(?:QQ|qq)\s*[:：]?\s*\d{5,12}`)
	reWechat   = regexp.MustCompile(`微信(?:号)?\s*[:：]?\s*[A-Za-z][-_A-Za-z0-9]{5,19}`)
	reStuNo    = regexp.MustCompile(`学号\s*[:：]?\s*[A-Za-z0-9]{4,24}`)
	reRoll     = regexp.MustCompile(`学籍号\s*[:：]?\s*[A-Za-z0-9]{6,24}`)
	reScore    = regexp.MustCompile(`(?:得分|成绩|考了|得了|分数为|分数是)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)\s*分?`)
	reRank     = regexp.MustCompile(`(?:排名|名次)\s*[:：]?\s*第?\s*\d+\s*名?|第\s*\d+\s*名`)
	reSalary   = regexp.MustCompile(`(?:工资|薪资|月薪)\s*[:：]?\s*\d+(?:\.\d+)?\s*元?`)
	reAddrLine = regexp.MustCompile(`(?:家庭住址|家庭地址|户籍地址|户籍地|现住址)\s*[:：].*`)
)

var stopNames = map[string]struct{}{
	"我们": {}, "他们": {}, "她们": {}, "你们": {}, "自己": {}, "这个": {}, "那个": {}, "可以": {}, "进行": {},
	"教学": {}, "目标": {}, "过程": {}, "学生": {}, "教师": {}, "老师": {}, "课文": {}, "作者": {}, "内容": {},
	"问题": {}, "答案": {}, "知识": {}, "能力": {}, "方法": {}, "小学": {}, "初中": {}, "高中": {}, "一年": {},
	"二年": {}, "三年": {}, "四年": {}, "五年": {}, "六年": {}, "七年": {}, "八年": {}, "九年": {}, "年级": {},
	"语文": {}, "数学": {}, "英语": {}, "物理": {}, "化学": {}, "生物": {}, "历史": {}, "地理": {}, "政治": {},
	"科学": {}, "道德": {}, "学校": {}, "班级": {}, "学期": {}, "单元": {}, "题目": {}, "分数": {}, "成绩": {},
	"手机": {}, "家庭": {}, "住址": {}, "北京": {}, "上海": {}, "广州": {}, "深圳": {}, "本次": {}, "本次考试": {},
	"全班": {}, "同学": {}, "家长": {}, "课程": {}, "课时": {}, "板书": {}, "作业": {}, "导入": {}, "小结": {},
	"练习": {}, "阅读": {}, "写作": {}, "口语": {}, "听力": {}, "比喻": {}, "拟人": {}, "排比": {}, "夸张": {},
	"反问": {}, "设问": {}, "总分": {}, "平均": {}, "优秀": {}, "及格": {}, "薄弱": {}, "知识点": {}, "课标": {},
	"教案": {}, "课件": {}, "试卷": {}, "评语": {}, "学情": {}, "隐私": {}, "脱敏": {}, "拦截": {}, "屏蔽": {},
	"较高": {}, "中等": {}, "待提高": {}, "个人": {}, "信息": {}, "已经": {}, "包括": {}, "以下": {}, "如上": {},
	"第一": {}, "第二": {}, "第三": {}, "第四": {}, "第五": {}, "其中": {}, "以及": {}, "或者": {}, "如果": {},
	"但是": {}, "因为": {}, "所以": {}, "然后": {}, "最后": {}, "开始": {}, "结束": {}, "今天": {}, "明天": {},
	"昨天": {}, "上午": {}, "下午": {}, "晚上": {}, "分钟": {}, "小时": {}, "本节": {}, "本课": {}, "本文": {},
	"段落": {}, "句子": {}, "词语": {}, "汉字": {}, "拼音": {}, "生字": {},
	"组词": {}, "造句": {}, "仿写": {}, "概括": {}, "中心": {}, "思想": {}, "感情": {}, "修辞": {}, "手法": {},
	"说明": {}, "议论": {}, "记叙": {}, "描写": {}, "抒情": {}, "环境": {}, "人物": {}, "情节": {}, "主题": {},
	"小数": {}, "整数": {}, "加法": {}, "减法": {}, "乘法": {}, "除法": {}, "方程": {}, "应用": {},
	"面积": {}, "周长": {}, "体积": {}, "图形": {}, "三角": {}, "圆形": {}, "正方形": {}, "长方": {}, "诗人": {},
}

func (e *Engine) Run(raw string) Result {
	text := clean(raw)
	if text == "" {
		return Result{Level: LevelNone, Text: ""}
	}
	events := []Event{}

	if reason := blockReason(text); reason != "" {
		return Result{
			Level:   LevelBlock,
			Text:    "",
			Blocked: true,
			Reason:  reason,
			Events:  []Event{{Type: "intercept", Action: "block", Detail: reason}},
		}
	}

	paras := splitParas(text)
	masked := 0
	for i, p := range paras {
		if shouldMaskParagraph(p) {
			paras[i] = "【本段包含隐私信息，已屏蔽】"
			masked++
		}
	}
	if masked > 0 {
		events = append(events, Event{Type: "paragraph", Action: "mask", Detail: "已按二级策略屏蔽隐私段落"})
	}
	text = strings.Join(paras, "\n\n")

	names := e.detectNames(text)
	alias := map[string]string{}
	seq := 0
	for _, n := range names {
		if _, ok := alias[n]; ok {
			continue
		}
		seq++
		alias[n] = "学生" + aliasLetter(seq)
	}
	if len(alias) > 0 {
		// 长名字优先，避免短名截断。
		ordered := make([]string, 0, len(alias))
		for n := range alias {
			ordered = append(ordered, n)
		}
		for i := 0; i < len(ordered); i++ {
			for j := i + 1; j < len(ordered); j++ {
				if len([]rune(ordered[j])) > len([]rune(ordered[i])) {
					ordered[i], ordered[j] = ordered[j], ordered[i]
				}
			}
		}
		for _, n := range ordered {
			text = strings.ReplaceAll(text, n, alias[n])
		}
		events = append(events, Event{Type: "person_name", Action: "replace", Detail: "真实姓名已映射为一致的学生代号"})
	}

	replacer := []struct {
		re      *regexp.Regexp
		to      string
		typ     string
		bounded bool
	}{
		{reIDCard, "【身份证已脱敏】", "id_card", true},
		{rePhone, "【手机号已脱敏】", "phone", true},
		{reTel, "【固话已脱敏】", "tel", false},
		{reEmail, "【邮箱已脱敏】", "email", false},
		{reQQ, "【QQ已脱敏】", "qq", false},
		{reWechat, "【微信已脱敏】", "wechat", false},
		{reStuNo, "学号【学号已脱敏】", "student_no", false},
		{reRoll, "学籍号【学籍号已脱敏】", "roll_no", false},
		{reSalary, "【薪资已脱敏】", "salary", false},
		{reRank, "【排名已脱敏】", "rank", false},
	}
	for _, r := range replacer {
		var next string
		var ok bool
		if r.bounded {
			next, ok = replaceBounded(text, r.re, r.to)
		} else if r.re.MatchString(text) {
			next, ok = r.re.ReplaceAllString(text, r.to), true
		}
		if ok {
			text = next
			events = append(events, Event{Type: r.typ, Action: "replace", Detail: "已替换为脱敏占位"})
		}
	}
	text = fuzzScores(text, &events)

	level := LevelNone
	if len(events) > 0 {
		level = LevelReplace
	}
	for _, ev := range events {
		if ev.Action == "mask" {
			level = LevelMask
		}
	}
	// 二次确认：改写后仍残留强标识则升级拦截，避免带入检索库。
	if reIDCard.MatchString(text) || rePhone.MatchString(text) {
		return Result{
			Level: LevelBlock, Blocked: true, Text: "",
			Reason: "脱敏后仍残留身份证或手机号，已拦截入库",
			Events: append(events, Event{Type: "residual", Action: "block", Detail: "残留强标识"}),
		}
	}
	return Result{Level: level, Text: strings.TrimSpace(text), Events: events}
}

func blockReason(text string) string {
	if strings.Contains(text, "心理档案") || strings.Contains(text, "心理咨询记录") || strings.Contains(text, "学生心理") {
		return "文档包含学生心理档案，禁止入库"
	}
	if strings.Contains(text, "未公开试卷") || strings.Contains(text, "内部评分细则") || strings.Contains(text, "绝密资料") {
		return "文档包含校内未公开涉密材料，禁止入库"
	}
	ids := reIDCard.FindAllString(text, -1)
	phones := rePhone.FindAllString(text, -1)
	if len(ids) >= 3 {
		return "文档包含大量身份证号，禁止入库"
	}
	if len(phones) >= 5 {
		return "文档包含大量手机号，禁止入库"
	}
	if looksLikeRoster(text) {
		return "文档包含完整全班实名成绩或学籍名单，禁止入库"
	}
	return ""
}

func looksLikeRoster(text string) bool {
	lines := strings.Split(text, "\n")
	header := false
	data := 0
	namesWithScore := 0
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.Contains(line, "姓名") && (strings.Contains(line, "分数") || strings.Contains(line, "成绩") || strings.Contains(line, "语文") || strings.Contains(line, "数学") || strings.Contains(line, "总分") || strings.Contains(line, "学号")) {
			header = true
			continue
		}
		if header && rosterDataLine(line) {
			data++
		}
		if nameAndScoreLine(line) {
			namesWithScore++
		}
	}
	if header && data >= 3 {
		return true
	}
	return namesWithScore >= 3
}

func rosterDataLine(line string) bool {
	fields := splitFields(line)
	if len(fields) < 2 {
		return false
	}
	name := strings.TrimSpace(fields[0])
	if !isHanName(name) {
		return false
	}
	nums := 0
	for _, f := range fields[1:] {
		f = strings.TrimSpace(f)
		if regexp.MustCompile(`^\d{1,3}(?:\.\d+)?$`).MatchString(f) {
			nums++
		}
	}
	return nums >= 1
}

func nameAndScoreLine(line string) bool {
	if !regexp.MustCompile(`[\p{Han}]{2,3}`).MatchString(line) {
		return false
	}
	return regexp.MustCompile(`(?:得分|成绩|考了|语文|数学|英语|总分)\s*[:：]?\s*\d{1,3}`).MatchString(line) &&
		regexp.MustCompile(`(?:学生|同学|姓名)`).MatchString(line)
}

func splitFields(line string) []string {
	line = strings.ReplaceAll(line, "，", ",")
	line = strings.ReplaceAll(line, "\t", ",")
	if strings.Contains(line, ",") {
		return strings.Split(line, ",")
	}
	return strings.Fields(line)
}

func shouldMaskParagraph(p string) bool {
	if reAddrLine.MatchString(p) {
		return true
	}
	if strings.Contains(p, "个性化评语") || strings.Contains(p, "家庭情况") {
		return true
	}
	if reIDCard.MatchString(p) && rePhone.MatchString(p) {
		return true
	}
	return false
}

func (e *Engine) detectNames(text string) []string {
	rs := []rune(text)
	seen := map[string]struct{}{}
	var out []string
	add := func(name string) {
		name = strings.TrimSpace(name)
		if !isHanName(name) {
			return
		}
		if _, ok := e.Whitelist[name]; ok {
			return
		}
		if _, ok := stopNames[name]; ok {
			return
		}
		if _, ok := seen[name]; ok {
			return
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	prefixes := []string{"姓名：", "姓名:", "姓名", "学生", "同学"}
	for i := 0; i < len(rs); i++ {
		for _, p := range prefixes {
			pr := []rune(p)
			if !hasPrefixRunes(rs[i:], pr) {
				continue
			}
			j := i + len(pr)
			for j < len(rs) && (rs[j] == ' ' || rs[j] == '：' || rs[j] == ':') {
				j++
			}
			add(takeName(rs[j:]))
		}
	}
	for _, suf := range []string{"的得分", "的成绩", "的错题", "的排名", "的学号", "得分", "成绩", "错题", "排名", "学号"} {
		from := 0
		for {
			p := strings.Index(text[from:], suf)
			if p < 0 {
				break
			}
			abs := from + p
			add(lookbackName([]rune(text[:abs])))
			from = abs + len(suf)
			if from >= len(text) {
				break
			}
		}
	}
	return out
}

func hasPrefixRunes(s, p []rune) bool {
	if len(s) < len(p) {
		return false
	}
	for i := range p {
		if s[i] != p[i] {
			return false
		}
	}
	return true
}

func takeName(rs []rune) string {
	max := 0
	for max < 3 && max < len(rs) && unicode.Is(unicode.Han, rs[max]) && !isNameStop(rs[max]) {
		max++
	}
	if max < 2 {
		return ""
	}
	for n := max; n >= 2; n-- {
		if nameBoundary(rs[n:]) {
			return string(rs[:n])
		}
	}
	return ""
}

func isNameStop(r rune) bool {
	switch r {
	case '的', '了', '和', '与', '在', '是', '为', '有', '及', '或', '并', '而', '被', '把', '从', '对', '将', '这', '那':
		return true
	default:
		return false
	}
}

func nameBoundary(rs []rune) bool {
	if len(rs) == 0 {
		return true
	}
	if !unicode.Is(unicode.Han, rs[0]) {
		return true
	}
	s := string(rs)
	for _, w := range []string{"本次", "得分", "成绩", "学号", "错题", "排名", "同学", "考了", "得了", "的", "在", "是"} {
		if strings.HasPrefix(s, w) {
			return true
		}
	}
	return false
}

func lookbackName(before []rune) string {
	if len(before) == 0 {
		return ""
	}
	i := len(before)
	if before[i-1] == '的' {
		i--
	}
	end := i
	n := 0
	for i > 0 && n < 3 && unicode.Is(unicode.Han, before[i-1]) && !isNameStop(before[i-1]) {
		i--
		n++
	}
	if n < 2 {
		return ""
	}
	if i > 0 && unicode.Is(unicode.Han, before[i-1]) {
		return ""
	}
	return string(before[i:end])
}

func isHanName(s string) bool {
	rs := []rune(s)
	if len(rs) < 2 || len(rs) > 3 {
		return false
	}
	for _, r := range rs {
		if !unicode.Is(unicode.Han, r) {
			return false
		}
	}
	return true
}

func fuzzScores(text string, events *[]Event) string {
	changed := false
	text = reScore.ReplaceAllStringFunc(text, func(m string) string {
		sub := reScore.FindStringSubmatch(m)
		if len(sub) < 2 {
			return m
		}
		changed = true
		return strings.Replace(m, sub[1], scoreWord(sub[1]), 1)
	})
	// 仅模糊紧邻学科或“得”字的分数，避免把“85分钟”或课文页码误伤。
	reCtx := regexp.MustCompile(`(语文|数学|英语|物理|化学|生物|历史|地理|科学|总分|平均分)\s*[:：]?\s*(\d{1,3}(?:\.\d+)?)`)
	text = reCtx.ReplaceAllStringFunc(text, func(m string) string {
		sub := reCtx.FindStringSubmatch(m)
		if len(sub) < 3 {
			return m
		}
		changed = true
		return sub[1] + scoreWord(sub[2])
	})
	if changed {
		*events = append(*events, Event{Type: "score", Action: "replace", Detail: "精确分数已模糊化"})
	}
	// 清理孤立的“分”字重复，如 “较高分数分”
	text = strings.ReplaceAll(text, "分数分", "分数")
	return text
}

func scoreWord(num string) string {
	n := 0
	for _, r := range num {
		if r == '.' {
			break
		}
		if r < '0' || r > '9' {
			continue
		}
		n = n*10 + int(r-'0')
	}
	switch {
	case n >= 90:
		return "较高分数"
	case n >= 75:
		return "中等偏上分数"
	case n >= 60:
		return "及格分数"
	default:
		return "待提高分数"
	}
}

func aliasLetter(n int) string {
	if n <= 0 {
		n = 1
	}
	s := ""
	for n > 0 {
		n--
		s = string(rune('A'+n%26)) + s
		n /= 26
	}
	return s
}

func clean(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= '０' && r <= '９':
			b.WriteRune(r - '０' + '0')
		case r >= 'Ａ' && r <= 'Ｚ':
			b.WriteRune(r - 'Ａ' + 'A')
		case r >= 'ａ' && r <= 'ｚ':
			b.WriteRune(r - 'ａ' + 'a')
		default:
			b.WriteRune(r)
		}
	}
	return strings.TrimSpace(b.String())
}

func replaceBounded(text string, re *regexp.Regexp, to string) (string, bool) {
	locs := re.FindAllStringIndex(text, -1)
	if len(locs) == 0 {
		return text, false
	}
	var b strings.Builder
	last := 0
	changed := false
	for _, loc := range locs {
		start, end := loc[0], loc[1]
		if start > 0 && text[start-1] >= '0' && text[start-1] <= '9' {
			continue
		}
		if end < len(text) && text[end] >= '0' && text[end] <= '9' {
			continue
		}
		b.WriteString(text[last:start])
		b.WriteString(to)
		last = end
		changed = true
	}
	b.WriteString(text[last:])
	if !changed {
		return text, false
	}
	return b.String(), true
}

func splitParas(s string) []string {
	parts := strings.Split(s, "\n\n")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{s}
	}
	return out
}

// ContainsSensitive 用于 Prompt 组装前的二次扫描。
func ContainsSensitive(text string) bool {
	if reIDCard.MatchString(text) || rePhone.MatchString(text) || reEmail.MatchString(text) {
		return true
	}
	if strings.Contains(text, "心理档案") || strings.Contains(text, "学籍号") {
		return true
	}
	return false
}
