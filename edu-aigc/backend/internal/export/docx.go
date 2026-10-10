package export

import (
	"archive/zip"
	"html"
	"os"
	"strings"
)

// WriteDocx 生成带显性水印和隐形溯源属性的 docx。
func WriteDocx(path, title, body, watermark, trace string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	zw := zip.NewWriter(f)
	defer zw.Close()
	files := map[string]string{
		"[Content_Types].xml":          contentTypes(),
		"_rels/.rels":                  rootRels(),
		"docProps/core.xml":            coreXML(title),
		"docProps/custom.xml":          customXML(trace),
		"word/document.xml":            documentXML(title, body, watermark),
		"word/footer.xml":              footerXML(watermark),
		"word/_rels/document.xml.rels": docRels(),
	}
	for name, content := range files {
		w, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			return err
		}
		if _, err := w.Write([]byte(content)); err != nil {
			return err
		}
	}
	return nil
}

func contentTypes() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/footer.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>
</Types>`
}

func rootRels() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>
</Relationships>`
}

func docRels() string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer.xml"/>
</Relationships>`
}

func coreXML(title string) string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>` + xmlText(title) + `</dc:title>
  <dc:creator>校本智教平台</dc:creator>
</cp:coreProperties>`
}

func customXML(trace string) string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="EduTrace">
    <vt:lpwstr>` + xmlText(trace) + `</vt:lpwstr>
  </property>
</Properties>`
}

func documentXML(title, body, watermark string) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	b.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`)
	b.WriteString(`<w:body>`)
	b.WriteString(paragraph("显性水印：" + watermark))
	b.WriteString(paragraph(title))
	for _, line := range strings.Split(body, "\n") {
		b.WriteString(paragraph(line))
	}
	b.WriteString(`<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter"/></w:sectPr>`)
	b.WriteString(`</w:body></w:document>`)
	return b.String()
}

func footerXML(watermark string) string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>` + xmlText("显性水印："+watermark) + `</w:t></w:r></w:p></w:ftr>`
}

func paragraph(text string) string {
	if strings.TrimSpace(text) == "" {
		return `<w:p/>`
	}
	return `<w:p><w:r><w:t xml:space="preserve">` + xmlText(text) + `</w:t></w:r></w:p>`
}

func xmlText(s string) string {
	return html.EscapeString(s)
}
