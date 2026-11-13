// Package web 把已构建的 Vue 页面嵌进可执行文件。
package web

import "embed"

//go:embed all:ui
var Dist embed.FS
