package store

import (
	"fmt"
	"strings"
)

type SchoolSettings struct {
	TenantID           string `json:"tenant_id"`
	ModelBaseURL       string `json:"model_base_url"`
	ModelAPIKey        string `json:"-"`
	ModelName          string `json:"model_name"`
	OCREngine          string `json:"ocr_engine"`
	IdentityMode       string `json:"identity_mode"`
	IdentityConfig     string `json:"identity_config_json"`
	CurriculumVersion  string `json:"curriculum_version"`
	CurriculumSource   string `json:"curriculum_source"`
	CurriculumNote     string `json:"curriculum_note"`
}

func (c SchoolSettings) UsingDemo() bool {
	return strings.TrimSpace(c.CurriculumVersion) == "" && strings.TrimSpace(c.CurriculumSource) == ""
}

func (c SchoolSettings) CurriculumLabel() string {
	if c.UsingDemo() {
		return "学校尚未指定权威课标或教材版本。知识库中的摘录是平台演示文本，正式教学前请在学校设定里填写版本和来源，或上传学校自己的文件替换。"
	}
	version := strings.TrimSpace(c.CurriculumVersion)
	if version == "" {
		version = "学校自定义"
	}
	source := strings.TrimSpace(c.CurriculumSource)
	if source == "" {
		source = "学校自定义"
	}
	note := strings.TrimSpace(c.CurriculumNote)
	if note != "" {
		note = " " + note
	}
	return fmt.Sprintf("以学校设定的文本为准：版本「%s」，来源「%s」。%s", version, source, note)
}

func NormalizeOCR(engine string) string {
	switch strings.TrimSpace(engine) {
	case "tesseract", "paddle", "none", "auto":
		return engine
	default:
		return "auto"
	}
}

func NormalizeIdentity(mode string) string {
	switch strings.TrimSpace(mode) {
	case "local", "cas", "oauth":
		return mode
	default:
		return "local"
	}
}

func (s *Store) Settings(tenantID string) (SchoolSettings, error) {
	var c SchoolSettings
	err := s.db.QueryRow(`SELECT tenant_id, model_base_url, model_api_key, model_name, ocr_engine, identity_mode, identity_config_json, curriculum_version, curriculum_source, curriculum_note FROM school_settings WHERE tenant_id=?`, tenantID).
		Scan(&c.TenantID, &c.ModelBaseURL, &c.ModelAPIKey, &c.ModelName, &c.OCREngine, &c.IdentityMode, &c.IdentityConfig, &c.CurriculumVersion, &c.CurriculumSource, &c.CurriculumNote)
	if err != nil {
		c = SchoolSettings{TenantID: tenantID, OCREngine: "auto", IdentityMode: "local", IdentityConfig: "{}"}
		return c, nil
	}
	c.OCREngine = NormalizeOCR(c.OCREngine)
	c.IdentityMode = NormalizeIdentity(c.IdentityMode)
	return c, nil
}

func (s *Store) SaveSettings(c SchoolSettings) error {
	c.OCREngine = NormalizeOCR(c.OCREngine)
	c.IdentityMode = NormalizeIdentity(c.IdentityMode)
	if strings.TrimSpace(c.IdentityConfig) == "" {
		c.IdentityConfig = "{}"
	}
	_, err := s.db.Exec(`INSERT INTO school_settings (tenant_id, model_base_url, model_api_key, model_name, ocr_engine, identity_mode, identity_config_json, curriculum_version, curriculum_source, curriculum_note)
		VALUES (?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(tenant_id) DO UPDATE SET
			model_base_url=excluded.model_base_url,
			model_api_key=excluded.model_api_key,
			model_name=excluded.model_name,
			ocr_engine=excluded.ocr_engine,
			identity_mode=excluded.identity_mode,
			identity_config_json=excluded.identity_config_json,
			curriculum_version=excluded.curriculum_version,
			curriculum_source=excluded.curriculum_source,
			curriculum_note=excluded.curriculum_note`,
		c.TenantID, strings.TrimSpace(c.ModelBaseURL), c.ModelAPIKey, strings.TrimSpace(c.ModelName), c.OCREngine, c.IdentityMode, c.IdentityConfig,
		strings.TrimSpace(c.CurriculumVersion), strings.TrimSpace(c.CurriculumSource), strings.TrimSpace(c.CurriculumNote))
	return err
}
