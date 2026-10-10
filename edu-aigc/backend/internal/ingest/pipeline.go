package ingest

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"

	"edu-aigc/internal/desensitize"
	"edu-aigc/internal/rag"
	"edu-aigc/internal/secure"
	"edu-aigc/internal/store"
)

func Process(st *store.Store, eng *desensitize.Engine, key []byte, doc store.Document, data []byte) (store.Document, error) {
	origName := doc.ID + filepath.Ext(doc.FileName) + ".bin"
	origPath := filepath.Join(st.DataDir(), "original-files", origName)
	enc, err := secure.Encrypt(key, data)
	if err != nil {
		return doc, err
	}
	if err := os.WriteFile(origPath, enc, 0o600); err != nil {
		return doc, err
	}
	doc.OriginalPath = origPath
	doc.Status = "desensitizing"
	_ = st.SaveDocumentState(doc)

	text, err := Extract(doc.FileName, data)
	if err != nil {
		if errors.Is(err, ErrNeedOCR) {
			arch := filepath.Join(st.DataDir(), "privacy-archive", doc.ID+".bin")
			_ = os.WriteFile(arch, enc, 0o600)
			doc.Status = "failed"
			doc.ErrorMessage = "图片已加密归档。当前环境没有本地 OCR，未提取文字，也不会把图片送入大模型。"
			doc.Preview = ""
			_ = st.SaveDocumentState(doc)
			return doc, nil
		}
		doc.Status = "failed"
		doc.ErrorMessage = err.Error()
		_ = st.SaveDocumentState(doc)
		return doc, nil
	}
	if strings.TrimSpace(text) == "" {
		doc.Status = "failed"
		doc.ErrorMessage = "没有从文件中提取到可用文本"
		_ = st.SaveDocumentState(doc)
		return doc, nil
	}

	result := eng.Run(text)
	rawLog, _ := json.Marshal(result.Events)
	doc.DesensitizeLog = string(rawLog)
	doc.Level = int(result.Level)
	doc.SensitiveFlag = result.Level > 0
	if result.Blocked {
		arch := filepath.Join(st.DataDir(), "privacy-archive", doc.ID+".bin")
		_ = os.WriteFile(arch, enc, 0o600)
		doc.Status = "blocked"
		doc.ErrorMessage = result.Reason
		doc.Preview = ""
		doc.DesensitizedPath = ""
		_ = st.SaveDocumentState(doc)
		return doc, nil
	}

	doc.Status = "vectoring"
	_ = st.SaveDocumentState(doc)
	clean := result.Text
	plainPath := filepath.Join(st.DataDir(), "desensitized-files", doc.ID+".txt")
	if err := os.WriteFile(plainPath, []byte(clean), 0o600); err != nil {
		return doc, err
	}
	doc.DesensitizedPath = plainPath
	doc.Preview = clip(clean, 1500)
	parts := Split(clean, 380, 60)
	if len(parts) > 80 {
		parts = parts[:80]
		doc.ErrorMessage = "文档较长，仅索引前 80 个切片"
	}
	meta := guessMeta(doc.FileName, clean)
	chunks := make([]store.Chunk, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if utf8.RuneCountInString(p) < 8 {
			continue
		}
		id := store.NewID()
		vec, _ := json.Marshal(rag.Embed(p))
		chunks = append(chunks, store.Chunk{
			ID: id, DocID: doc.ID, KBID: doc.KBID, Text: p, MetaJSON: meta, VectorID: id, VectorJSON: string(vec),
		})
	}
	if err := st.InsertChunks(chunks); err != nil {
		doc.Status = "failed"
		doc.ErrorMessage = "切片写入失败"
		_ = st.SaveDocumentState(doc)
		return doc, err
	}
	doc.Status = "finished"
	_ = st.SaveDocumentState(doc)
	return doc, nil
}

func Split(text string, size, overlap int) []string {
	rs := []rune(text)
	if len(rs) == 0 {
		return nil
	}
	if size <= overlap {
		overlap = size / 5
	}
	var out []string
	for start := 0; start < len(rs); {
		end := start + size
		if end > len(rs) {
			end = len(rs)
		}
		part := strings.TrimSpace(string(rs[start:end]))
		if part != "" {
			out = append(out, part)
		}
		if end == len(rs) {
			break
		}
		next := end - overlap
		if next <= start {
			next = end
		}
		start = next
	}
	return out
}

func guessMeta(name, text string) string {
	blob := name + "\n" + text
	subject := firstHit(blob, []string{"道德与法治", "语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "科学"})
	stage, grade := "", 0
	switch {
	case strings.Contains(blob, "一年级"):
		stage, grade = "小学", 1
	case strings.Contains(blob, "二年级"):
		stage, grade = "小学", 2
	case strings.Contains(blob, "三年级"):
		stage, grade = "小学", 3
	case strings.Contains(blob, "四年级"):
		stage, grade = "小学", 4
	case strings.Contains(blob, "五年级"):
		stage, grade = "小学", 5
	case strings.Contains(blob, "六年级"):
		stage, grade = "小学", 6
	case strings.Contains(blob, "七年级"):
		stage, grade = "初中", 7
	case strings.Contains(blob, "八年级"):
		stage, grade = "初中", 8
	case strings.Contains(blob, "九年级"):
		stage, grade = "初中", 9
	case strings.Contains(blob, "高一"), strings.Contains(blob, "高二"), strings.Contains(blob, "高三"), strings.Contains(blob, "高中"):
		stage = "高中"
	case strings.Contains(blob, "初中"):
		stage = "初中"
	case strings.Contains(blob, "小学"):
		stage = "小学"
	}
	docType := "material"
	switch {
	case strings.Contains(blob, "课标"):
		docType = "curriculum"
	case strings.Contains(blob, "教案"):
		docType = "lesson"
	case strings.Contains(blob, "试卷"), strings.Contains(blob, "练习"):
		docType = "exam"
	}
	kp := subject
	if strings.Contains(blob, "比喻") {
		kp = "比喻句"
	}
	if strings.Contains(blob, "分数") && subject == "数学" {
		kp = "分数初步"
	}
	raw, _ := json.Marshal(map[string]any{
		"grade": grade, "stage": stage, "subject": subject, "doc_type": docType, "knowledge_point": kp,
	})
	return string(raw)
}

func firstHit(blob string, words []string) string {
	for _, w := range words {
		if strings.Contains(blob, w) {
			return w
		}
	}
	return ""
}

func clip(s string, n int) string {
	rs := []rune(s)
	if len(rs) <= n {
		return s
	}
	return string(rs[:n])
}
