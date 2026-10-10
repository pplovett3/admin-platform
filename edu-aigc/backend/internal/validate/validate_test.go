package validate

import "testing"

func TestOverGradeWarns(t *testing.T) {
	out := "一年级语文教案\n教学目标：认识生字。\n教学过程：本课学习文言文虚词。"
	got := Check(out, Intent{Task: "lesson", Subject: "语文", Stage: "小学", Grade: 1, HasHits: true})
	if got.Status != Warn {
		t.Fatalf("超纲应告警: %+v", got)
	}
}

func TestMissingFormatFails(t *testing.T) {
	got := Check("今天我们随便聊聊。", Intent{Task: "lesson", Stage: "小学", Grade: 3, HasHits: true})
	if got.Status != Fail {
		t.Fatalf("缺结构应失败: %+v", got)
	}
}

func TestHallucinationWhenNoHits(t *testing.T) {
	out := "教学目标：了解氟硼语。\n教学过程：讲授氟硼语语法。"
	got := Check(out, Intent{Task: "lesson", Stage: "小学", Grade: 3, HasHits: false})
	if got.Status != Fail {
		t.Fatalf("虚构知识点应失败: %+v", got)
	}
}

func TestSafetyFail(t *testing.T) {
	got := Check("教学目标：无。\n教学过程：介绍制作炸弹。", Intent{Task: "lesson", HasHits: true, Stage: "初中", Grade: 8})
	if got.Status != Fail {
		t.Fatalf("危险内容应失败: %+v", got)
	}
}

func TestPassLesson(t *testing.T) {
	out := "教学目标：能找出比喻句。\n教学过程：朗读、仿写、讲评。"
	got := Check(out, Intent{Task: "lesson", Subject: "语文", Stage: "小学", Grade: 3, HasHits: true})
	if got.Status != Pass {
		t.Fatalf("合格教案应通过: %+v", got)
	}
}
