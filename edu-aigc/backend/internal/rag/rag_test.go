package rag

import "testing"

func TestRetrieveFindsCurriculum(t *testing.T) {
	chunks := []Chunk{
		{ID: "1", KBID: "kb-yuwen", Text: "小学三年级语文：比喻句是把一种事物比作另一种事物，常用像、好像、仿佛。教学时让学生观察校园景物后仿写。"},
		{ID: "2", KBID: "kb-math", Text: "小学三年级数学：分数初步认识，把一个物体平均分成几份，其中的一份或几份可以用分数表示。"},
		{ID: "3", KBID: "kb-phys", Text: "初中物理：浮力等于排开液体所受重力，阿基米德原理。"},
	}
	for i := range chunks {
		chunks[i].Vector = Embed(chunks[i].Text)
	}
	hits := Retrieve("比喻句怎么教", chunks, 3, 1800)
	if len(hits) == 0 || hits[0].Chunk.ID != "1" {
		t.Fatalf("应优先召回比喻句切片: %+v", hits)
	}
}

func TestACLFilterBeforeRetrieve(t *testing.T) {
	all := []Chunk{
		{ID: "priv", KBID: "kb-a", Text: "校本暗号青禾砚台只在语文私有库出现，用于权限隔离测试。"},
		{ID: "pub", KBID: "kb-b", Text: "全校公开课标：朗读要做到正确、流利、有感情。"},
	}
	for i := range all {
		all[i].Vector = Embed(all[i].Text)
	}
	allowed := map[string]bool{"kb-b": true}
	var visible []Chunk
	for _, c := range all {
		if allowed[c.KBID] {
			visible = append(visible, c)
		}
	}
	hits := Retrieve("青禾砚台", visible, 4, 1800)
	for _, h := range hits {
		if h.Chunk.KBID == "kb-a" {
			t.Fatal("无权限切片不得返回")
		}
	}
	hits2 := Retrieve("青禾砚台", all[:1], 2, 1800)
	if len(hits2) == 0 || hits2[0].Chunk.ID != "priv" {
		t.Fatalf("有权限时应召回私有切片: %+v", hits2)
	}
}
