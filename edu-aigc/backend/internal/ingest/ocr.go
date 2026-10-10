package ingest

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

type OCRError struct {
	Reason string
}

func (e *OCRError) Error() string { return e.Reason }

func (e *OCRError) Is(target error) bool { return target == ErrNeedOCR }

type OCRChoice struct {
	Engine string
	OK     bool
	Reason string
}

func ResolveOCR(pref string, hasTesseract, hasPaddle bool) OCRChoice {
	switch strings.TrimSpace(pref) {
	case "none":
		return OCRChoice{Reason: "学校已关闭图片 OCR。图片只加密归档，不会识别，也不会送入大模型。"}
	case "tesseract":
		if hasTesseract {
			return OCRChoice{Engine: "tesseract", OK: true}
		}
		return OCRChoice{Engine: "tesseract", Reason: "学校选择了 Tesseract，但本机未安装。图片已加密归档，不会送入大模型。"}
	case "paddle":
		if hasPaddle {
			return OCRChoice{Engine: "paddle", OK: true}
		}
		return OCRChoice{Engine: "paddle", Reason: "学校选择了 PaddleOCR，但本机未安装。图片已加密归档，不会送入大模型。"}
	default:
		if hasPaddle {
			return OCRChoice{Engine: "paddle", OK: true}
		}
		if hasTesseract {
			return OCRChoice{Engine: "tesseract", OK: true}
		}
		return OCRChoice{Reason: "未安装 PaddleOCR 或 Tesseract。图片已加密归档，不会提取文字，也不会送入大模型。"}
	}
}

var (
	detectOnce sync.Once
	hasT       bool
	hasP       bool
)

func DetectEngines() (tesseract, paddle bool) {
	detectOnce.Do(func() {
		_, err := exec.LookPath("tesseract")
		hasT = err == nil
		if _, err := exec.LookPath("paddleocr"); err == nil {
			hasP = true
			return
		}
		cmd := exec.Command("python3", "-c", "import paddleocr")
		hasP = cmd.Run() == nil
	})
	return hasT, hasP
}

func ocrImage(filename string, data []byte, pref string) (string, error) {
	t, p := DetectEngines()
	choice := ResolveOCR(pref, t, p)
	if !choice.OK {
		return "", &OCRError{Reason: choice.Reason}
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
	var cmd *exec.Cmd
	if choice.Engine == "paddle" {
		if _, err := exec.LookPath("paddleocr"); err == nil {
			cmd = exec.Command("paddleocr", "ocr", "-i", path, "--lang", "ch")
		} else {
			cmd = exec.Command("python3", "-m", "paddleocr", "ocr", "-i", path, "--lang", "ch")
		}
	} else {
		cmd = exec.Command("tesseract", path, "stdout", "-l", "chi_sim+eng")
	}
	out, err := cmd.Output()
	if err != nil {
		return "", &OCRError{Reason: "OCR 引擎运行失败，图片已加密归档，不会送入大模型。"}
	}
	text := strings.TrimSpace(string(out))
	if text == "" {
		return "", &OCRError{Reason: "OCR 没有识别到文字。图片已加密归档，不会送入大模型。"}
	}
	return text, nil
}
