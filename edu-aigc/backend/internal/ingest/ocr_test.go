package ingest

import "testing"

func TestResolveOCR(t *testing.T) {
	if c := ResolveOCR("auto", false, false); c.OK {
		t.Fatal("两个引擎都没有时应归档")
	}
	if c := ResolveOCR("auto", true, true); c.Engine != "paddle" || !c.OK {
		t.Fatalf("自动模式应优先 PaddleOCR: %+v", c)
	}
	if c := ResolveOCR("auto", true, false); c.Engine != "tesseract" || !c.OK {
		t.Fatalf("只有 Tesseract 时应选用它: %+v", c)
	}
	if c := ResolveOCR("tesseract", false, true); c.OK {
		t.Fatal("指定了未安装的 Tesseract 时不能改用别的引擎冒充")
	}
	if c := ResolveOCR("paddle", false, false); c.OK || c.Reason == "" {
		t.Fatal("指定了未安装的 PaddleOCR 时应说明原因")
	}
	if c := ResolveOCR("none", true, true); c.OK {
		t.Fatal("关闭 OCR 后即使安装了引擎也不识别")
	}
}
