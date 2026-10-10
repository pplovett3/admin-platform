package ingest

import (
	"archive/zip"
	"bytes"
	"errors"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"unicode/utf8"
)

var ErrNeedOCR = errors.New("未安装本地 OCR 引擎")

func Extract(filename string, data []byte) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".txt", ".md", ".csv", ".json":
		return decodeText(data), nil
	case ".docx":
		return parseDocx(data)
	case ".xlsx":
		return parseXMLZip(data, []string{"xl/sharedStrings.xml", "xl/worksheets/"})
	case ".pdf":
		return parsePDF(data), nil
	case ".jpg", ".jpeg", ".png":
		return ocrImage(filename, data)
	default:
		return "", errors.New("暂不支持该文件类型，请上传 txt、md、csv、docx、xlsx、pdf 或图片")
	}
}

func decodeText(data []byte) string {
	if bytes.HasPrefix(data, []byte{0xEF, 0xBB, 0xBF}) {
		data = data[3:]
	}
	if utf8.Valid(data) {
		return strings.TrimSpace(string(data))
	}
	return strings.TrimSpace(string(data))
}

func parseDocx(data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", errors.New("无法读取 Word 文档")
	}
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			b, err := readZip(f)
			if err != nil {
				return "", err
			}
			return strings.TrimSpace(xmlToText(string(b))), nil
		}
	}
	return "", errors.New("Word 文档中没有正文")
}

func parseXMLZip(data []byte, prefixes []string) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", errors.New("无法读取表格文件")
	}
	var b strings.Builder
	for _, f := range zr.File {
		ok := false
		for _, p := range prefixes {
			if f.Name == p || strings.HasPrefix(f.Name, p) {
				ok = true
				break
			}
		}
		if !ok || !strings.HasSuffix(f.Name, ".xml") {
			continue
		}
		raw, err := readZip(f)
		if err != nil {
			continue
		}
		b.WriteString(xmlToText(string(raw)))
		b.WriteByte('\n')
	}
	text := strings.TrimSpace(b.String())
	if text == "" {
		return "", errors.New("表格中没有读到文本")
	}
	return text, nil
}

func readZip(f *zip.File) ([]byte, error) {
	r, err := f.Open()
	if err != nil {
		return nil, err
	}
	defer r.Close()
	return io.ReadAll(io.LimitReader(r, 20<<20))
}

func xmlToText(s string) string {
	s = strings.ReplaceAll(s, "</w:p>", "\n")
	s = strings.ReplaceAll(s, "</si>", "\n")
	s = strings.ReplaceAll(s, "</row>", "\n")
	s = strings.ReplaceAll(s, "<w:tab/>", "\t")
	re := regexp.MustCompile(`<[^>]+>`)
	s = re.ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&#10;", "\n")
	return s
}

var pdfString = regexp.MustCompile(`\((?:\\.|[^\\)]){2,}\)`)

func parsePDF(data []byte) string {
	var b strings.Builder
	for _, m := range pdfString.FindAll(data, -1) {
		s := string(m)
		if len(s) >= 2 {
			s = s[1 : len(s)-1]
		}
		s = strings.ReplaceAll(s, `\n`, "\n")
		s = strings.ReplaceAll(s, `\(`, "(")
		s = strings.ReplaceAll(s, `\)`, ")")
		if mostlyPrintable(s) {
			b.WriteString(s)
			b.WriteByte('\n')
		}
	}
	runs := hanRuns(data)
	if runs != "" {
		b.WriteString(runs)
	}
	return strings.TrimSpace(b.String())
}

func mostlyPrintable(s string) bool {
	if !utf8.ValidString(s) {
		return false
	}
	n := 0
	for _, r := range s {
		if r == '\n' || r == '\t' || r >= 32 {
			n++
		}
	}
	return n > 0
}

func hanRuns(data []byte) string {
	text := string(bytes.ToValidUTF8(data, nil))
	var b strings.Builder
	run := 0
	var cur strings.Builder
	flush := func() {
		if run >= 8 {
			b.WriteString(cur.String())
			b.WriteByte('\n')
		}
		cur.Reset()
		run = 0
	}
	for _, r := range text {
		if r >= 0x4e00 && r <= 0x9fff {
			cur.WriteRune(r)
			run++
			continue
		}
		if run > 0 && (r == '，' || r == '。' || r == '、' || r == '；') {
			cur.WriteRune(r)
			continue
		}
		flush()
	}
	flush()
	return strings.TrimSpace(b.String())
}

func ocrImage(filename string, data []byte) (string, error) {
	if _, err := exec.LookPath("tesseract"); err != nil {
		return "", ErrNeedOCR
	}
	dir, err := os.MkdirTemp("", "eduocr")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, filepath.Base(filename))
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return "", err
	}
	cmd := exec.Command("tesseract", path, "stdout", "-l", "chi_sim+eng")
	out, err := cmd.Output()
	if err != nil {
		return "", ErrNeedOCR
	}
	text := strings.TrimSpace(string(out))
	if text == "" {
		return "", errors.New("OCR 没有识别到文字")
	}
	return text, nil
}
