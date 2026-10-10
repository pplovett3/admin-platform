package desensitize

import (
	"strings"
	"testing"
)

func TestWhitelistAndStudentName(t *testing.T) {
	e := New(nil)
	in := "课文作者李白写了静夜思。小明和小红在做题。学生张三本次得分85分，手机号13812345678，学号20230018。"
	got := e.Run(in)
	if got.Blocked {
		t.Fatalf("不应拦截: %+v", got)
	}
	if strings.Contains(got.Text, "张三") {
		t.Fatalf("真实姓名应被替换: %s", got.Text)
	}
	if strings.Contains(got.Text, "13812345678") {
		t.Fatalf("手机号应被替换: %s", got.Text)
	}
	if strings.Contains(got.Text, "85") {
		t.Fatalf("精确分数应模糊: %s", got.Text)
	}
	if !strings.Contains(got.Text, "李白") || !strings.Contains(got.Text, "小明") || !strings.Contains(got.Text, "小红") {
		t.Fatalf("白名单被误杀: %s", got.Text)
	}
	if !strings.Contains(got.Text, "学生A") {
		t.Fatalf("应映射为学生A: %s", got.Text)
	}
}

func TestConsistentAlias(t *testing.T) {
	e := New(nil)
	in := "学生张三得分90分。张三的错题在第二题。学生李四成绩70分。"
	got := e.Run(in)
	if strings.Count(got.Text, "学生A") < 2 {
		t.Fatalf("同一文档内张三应保持同一代号: %s", got.Text)
	}
	if !strings.Contains(got.Text, "学生B") {
		t.Fatalf("李四应为学生B: %s", got.Text)
	}
}

func TestBlockRoster(t *testing.T) {
	e := New(nil)
	in := "三年级一班成绩表\n姓名,学号,语文,数学,总分\n张三,001,85,90,175\n李四,002,70,80,150\n王五,003,88,92,180\n"
	got := e.Run(in)
	if !got.Blocked || got.Level != LevelBlock {
		t.Fatalf("全班成绩表应三级拦截: %+v", got)
	}
	if got.Text != "" {
		t.Fatalf("拦截后不应返回可入库正文")
	}
}

func TestBlockPsychAndSecret(t *testing.T) {
	e := New(nil)
	if !New(nil).Run("学生心理档案：张三近期情绪低落").Blocked {
		t.Fatal("心理档案应拦截")
	}
	if !e.Run("绝密资料：未公开试卷答案 1.A 2.B").Blocked {
		t.Fatal("未公开试卷应拦截")
	}
}

func TestMaskAddress(t *testing.T) {
	e := New(nil)
	in := "第一单元教案\n教学目标：理解比喻句。\n\n家庭住址：北京市海淀区中关村大街1号，请家访。\n\n教学过程：朗读课文。"
	got := e.Run(in)
	if got.Blocked {
		t.Fatalf("地址段落应屏蔽而不是整篇拦截: %+v", got)
	}
	if strings.Contains(got.Text, "中关村") {
		t.Fatalf("地址应被屏蔽: %s", got.Text)
	}
	if !strings.Contains(got.Text, "已屏蔽") {
		t.Fatalf("应出现二级屏蔽标记: %s", got.Text)
	}
	if !strings.Contains(got.Text, "比喻句") {
		t.Fatalf("教学段落应保留: %s", got.Text)
	}
	if got.Level != LevelMask {
		t.Fatalf("level=%d", got.Level)
	}
}

func TestAdminWhitelist(t *testing.T) {
	e := New([]string{"王二小"})
	got := e.Run("歌曲里的王二小是英雄人物。学生赵六得分59分。")
	if !strings.Contains(got.Text, "王二小") {
		t.Fatalf("扩展白名单失效: %s", got.Text)
	}
	if strings.Contains(got.Text, "赵六") {
		t.Fatalf("赵六应脱敏: %s", got.Text)
	}
}
